require("dotenv").config();
const axios = require("axios");

const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = "https://api.openweathermap.org/data/2.5";

/**
 * Buscar previsão do tempo para uma localização
 */
async function buscarPrevisao(latitude, longitude) {
  if (!API_KEY) {
    console.error("❌ OpenWeather API Key não configurada");
    return null;
  }

  try {
    // API de previsão 5 dias (a cada 3 horas)
    const url = `${BASE_URL}/forecast`;
    const response = await axios.get(url, {
      params: {
        lat: latitude,
        lon: longitude,
        appid: API_KEY,
        units: "metric", // Celsius
        lang: "pt_br",
      },
    });

    const previsao = processarPrevisao(response.data);
    console.log("✅ Previsão do tempo obtida");
    return previsao;
  } catch (error) {
    console.error("❌ Erro ao buscar previsão:", error.message);
    return null;
  }
}

/**
 * Processar dados da API para formato simplificado
 */
function processarPrevisao(data) {
  const proximasHoras = data.list.slice(0, 8); // Próximas 24 horas

  // Calcular total de chuva prevista (24h)
  let chuvaPrevista = 0;
  proximasHoras.forEach((item) => {
    if (item.rain && item.rain["3h"]) {
      chuvaPrevista += item.rain["3h"];
    }
  });

  // Pegar dados atuais (primeira previsão)
  const atual = proximasHoras[0];
  const chuvaAtual3h = atual.rain && atual.rain["3h"] ? atual.rain["3h"] : 0;

  // ==========================================
  // PROCESSAR PREVISÃO DIÁRIA (5 DIAS)
  // ==========================================
  const diasMap = {};

  data.list.forEach((item) => {
    const dataObj = new Date(item.dt * 1000);
    const diaMes = `${dataObj.getDate()}/${dataObj.getMonth() + 1}`;
    
    if (!diasMap[diaMes]) {
      diasMap[diaMes] = {
        data: diaMes,
        chuva: 0,
        temp_min: item.main.temp_min,
        temp_max: item.main.temp_max
      };
    }

    // Somar chuva
    if (item.rain && item.rain["3h"]) {
      diasMap[diaMes].chuva += item.rain["3h"];
    }

    // Atualizar min/max
    if (item.main.temp_min < diasMap[diaMes].temp_min) diasMap[diaMes].temp_min = item.main.temp_min;
    if (item.main.temp_max > diasMap[diaMes].temp_max) diasMap[diaMes].temp_max = item.main.temp_max;
  });

  // Converter para array e pegar os próximos 5-7 dias
  const previsaoDiaria = Object.values(diasMap).slice(0, 7);

  return {
    temperatura: atual.main.temp,
    umidade: atual.main.humidity,
    vento: atual.wind.speed,
    descricao: atual.weather[0].description,
    chuva_proximas_24h: chuvaPrevista,
    risco_chuva_intensa: chuvaPrevista > 30, // > 30mm = intenso
    chuva_atual_3h: chuvaAtual3h, // Adicionado chuva nas próximas 3 horas
    timestamp: new Date().toISOString(),
    // Novo campo com dados diários
    dias: previsaoDiaria
  };
}

/**
 * Determinar se há risco com base em clima + solo
 */
function calcularRiscoCombinado(medicao, previsaoClima) {
  let nivel = medicao.nivel_risco; // Risco base (do solo)

  // Se já está ALTO, e tem chuva prevista forte
  if (nivel === "ALTO" && previsaoClima.risco_chuva_intensa) {
    return "CRITICO";
  }

  // Se está MÉDIO, mas tem chuva forte prevista
  if (nivel === "MEDIO" && previsaoClima.chuva_proximas_24h > 40) {
    return "ALTO";
  }

  // Se solo saturado + chuva moderada prevista
  if (medicao.umidade_solo > 60 && previsaoClima.chuva_proximas_24h > 20) {
    return "ALTO";
  }

  return nivel;
}

module.exports = {
  buscarPrevisao,
  calcularRiscoCombinado,
};
