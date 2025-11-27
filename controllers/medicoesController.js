/**
 * CONTROLLER: Medições v2.0
 * Gerencia dados coletados pelos sensores
 * ATUALIZADO: Algoritmo Geotécnico Avançado (Dinâmico via DB)
 */

const supabase = require("../config/supabase");
const {
  buscarPrevisao,
  calcularRiscoCombinado,
} = require("../config/openweather");

const {
  enviarMensagem,
  formatarAlertaCompleto,
} = require("../config/telegram");

const { calcularTaxaErosao } = require("./erosaoController");
const { criarAlertaAutomatico } = require("./alertasController");

// ============================================
// CACHE: Tipos de Solo (1 hora)
// ============================================
let cacheTiposSolo = {
  dados: null,
  timestamp: 0
};

async function getParametrosSolo(tipoSoloNome) {
  const agora = Date.now();
  
  // Atualizar cache se necessário
  if (!cacheTiposSolo.dados || agora - cacheTiposSolo.timestamp > 3600000) {
    console.log("🔄 Atualizando cache de tipos de solo...");
    const { data, error } = await supabase.from('tipos_solo').select('*');
    if (!error && data) {
      cacheTiposSolo.dados = {};
      data.forEach(t => {
        cacheTiposSolo.dados[t.nome] = {
          saturacaoCritica: parseFloat(t.saturacao_critica),
          saturacaoTotal: parseFloat(t.saturacao_total),
          anguloAtritoCritico: parseFloat(t.angulo_atrito_critico),
          coeficienteCoesao: parseFloat(t.coeficiente_coesao)
        };
      });
      cacheTiposSolo.timestamp = agora;
    } else {
      console.error("❌ Erro ao buscar tipos de solo:", error);
    }
  }

  // Fallback seguro se o cache falhar ou tipo não existir
  const defaults = {
    saturacaoCritica: 60.0,
    saturacaoTotal: 85.0,
    anguloAtritoCritico: 32.0,
    coeficienteCoesao: 0.1
  };

  if (cacheTiposSolo.dados && cacheTiposSolo.dados[tipoSoloNome]) {
    return cacheTiposSolo.dados[tipoSoloNome];
  }

  console.warn(`⚠️ Tipo de solo '${tipoSoloNome}' não encontrado no cache. Usando defaults.`);
  return defaults;
}

// ============================================
// CACHE: Previsão do tempo (1 hora)
// ============================================
let cachePrevisao = {};

async function buscarPrevisaoComCache(sensorId, latitude, longitude) {
  const agora = Date.now();
  const cache = cachePrevisao[sensorId];

  if (cache && agora - cache.timestamp < 3600000) {
    return cache.dados;
  }

  const previsao = await buscarPrevisao(latitude, longitude);

  if (previsao) {
    cachePrevisao[sensorId] = {
      dados: previsao,
      timestamp: agora,
    };
  }

  return previsao;
}

// ============================================
// ALGORITMO AVANÇADO DE RISCO (Portado do ESP32)
// ============================================
function calcularRiscoAvancado(dados, paramsSolo) {
  const { umidade_solo, inclinacao_graus, alerta_chuva } = dados;
  const { saturacaoCritica, saturacaoTotal, anguloAtritoCritico, coeficienteCoesao } = paramsSolo;

  // ===== 1. ANÁLISE DE SATURAÇÃO DO SOLO (Peso 35%) =====
  let fatorSaturacao = 0.0;

  if (umidade_solo < saturacaoCritica) {
    fatorSaturacao = (umidade_solo / saturacaoCritica) * 0.3;
  } else if (umidade_solo < saturacaoTotal) {
    const proporcao = (umidade_solo - saturacaoCritica) / (saturacaoTotal - saturacaoCritica);
    fatorSaturacao = 0.3 + (proporcao * 0.4);
  } else {
    fatorSaturacao = 0.7 + ((umidade_solo - saturacaoTotal) / (100 - saturacaoTotal)) * 0.3;
  }

  // ===== 2. ANÁLISE DE INCLINAÇÃO (Peso 35%) =====
  let fatorInclinacao = 0.0;

  if (inclinacao_graus < 15.0) {
    fatorInclinacao = (inclinacao_graus / 15.0) * 0.2;
  } else if (inclinacao_graus < 30.0) {
    const proporcao = (inclinacao_graus - 15.0) / 15.0;
    fatorInclinacao = 0.2 + (proporcao * 0.3);
  } else if (inclinacao_graus < anguloAtritoCritico) {
    const proporcao = (inclinacao_graus - 30.0) / (anguloAtritoCritico - 30.0);
    fatorInclinacao = 0.5 + (proporcao * 0.3);
  } else {
    fatorInclinacao = 0.8 + Math.min(0.2, (inclinacao_graus - anguloAtritoCritico) / 10.0);
  }

  // ===== 3. INTERAÇÃO SATURAÇÃO-INCLINAÇÃO (Peso 20%) =====
  let perdaCoesao = 1.0;
  if (umidade_solo > saturacaoCritica) {
    const proporcaoSat = (umidade_solo - saturacaoCritica) / (saturacaoTotal - saturacaoCritica);
    perdaCoesao = 1.0 - (coeficienteCoesao * proporcaoSat);
  }
  
  const fatorInteracao = fatorSaturacao * fatorInclinacao * perdaCoesao; 

  // ===== 4. FATOR CHUVA INTENSA (Peso 10%) =====
  let fatorChuva = 0.0;
  if (alerta_chuva) {
    if (umidade_solo > saturacaoCritica) {
      fatorChuva = 0.3;
    } else {
      fatorChuva = 0.15;
    }
  }

  // ===== 5. CÁLCULO DO ÍNDICE DE RISCO TOTAL =====
  let indiceRisco = (fatorSaturacao * 0.35) +
                    (fatorInclinacao * 0.35) +
                    (fatorInteracao * 0.20) +
                    (fatorChuva * 0.10);

  indiceRisco = Math.min(100, Math.max(0, indiceRisco * 100));

  // ===== 6. CLASSIFICAÇÃO E RECOMENDAÇÕES =====
  let nivelRisco = "BAIXO";
  let recomendacao = "Condições normais. Monitoramento de rotina suficiente.";

  if (indiceRisco < 30) {
    nivelRisco = "BAIXO";
    recomendacao = "Condições normais. Monitoramento de rotina suficiente.";
  } else if (indiceRisco < 55) {
    nivelRisco = "MEDIO";
    if (umidade_solo > 60) {
      recomendacao = "Atenção: Solo com umidade elevada. Evitar cortes/aterros. Monitorar drenagem.";
    } else {
      recomendacao = "Atenção: Inclinação significativa. Verificar estabilidade do talude e vegetação.";
    }
  } else if (indiceRisco < 75) {
    nivelRisco = "ALTO";
    recomendacao = "ALERTA: Condições críticas detectadas. Vistoriar área, preparar evacuação preventiva.";
  } else {
    nivelRisco = "CRITICO";
    recomendacao = "PERIGO IMINENTE! Solo saturado + inclinação crítica. EVACUAR ÁREA IMEDIATAMENTE!";
  }

  // Alerta especial para chuva + saturação
  if (alerta_chuva && umidade_solo > saturacaoCritica) {
    nivelRisco = "CRITICO";
    recomendacao = "EMERGÊNCIA: Chuva intensa prevista com solo já saturado. RISCO EXTREMO DE DESLIZAMENTO!";
    if (indiceRisco < 75) indiceRisco = 85.0;
  }

  return {
    indiceRisco,
    nivelRisco,
    recomendacao,
    fatores: {
      saturacao: fatorSaturacao,
      inclinacao: fatorInclinacao,
      interacao: fatorInteracao,
      chuva: fatorChuva,
      perdaCoesao
    }
  };
}


// ============================================
// 1. CRIAR NOVA MEDIÇÃO
// ============================================
async function criarMedicao(req, res) {
  try {
    const {
      sensor_id,
      umidade_solo,
      temperatura_solo,
      umidade_ar,
      temperatura_ar,
      inclinacao_graus,
      alerta_chuva
    } = req.body;

    if (!sensor_id) {
      return res.status(400).json({ error: "Sensor ID obrigatório" });
    }

    // 1. Buscar Sensor
    const { data: sensor, error: sensorError } = await supabase
      .from("sensores")
      .select("*")
      .eq("id", sensor_id)
      .single();

    if (sensorError || !sensor) {
      return res.status(404).json({ error: "Sensor não encontrado" });
    }

    // 2. Obter Parâmetros do Solo (Dinâmico)
    // Se tiver calibração customizada no sensor, usa ela. Se não, busca do tipo de solo.
    let paramsSolo = { ...await getParametrosSolo(sensor.tipo_solo) };
    
    // Sobrescrever com calibração específica do sensor se existir
    if (sensor.saturacao_critica) paramsSolo.saturacaoCritica = sensor.saturacao_critica;
    if (sensor.saturacao_total) paramsSolo.saturacaoTotal = sensor.saturacao_total;
    if (sensor.angulo_atrito_critico) paramsSolo.anguloAtritoCritico = sensor.angulo_atrito_critico;
    if (sensor.coeficiente_coesao) paramsSolo.coeficienteCoesao = sensor.coeficiente_coesao;

    // 3. Calcular Risco (Algoritmo Avançado)
    const analiseRisco = calcularRiscoAvancado({
      umidade_solo: parseFloat(umidade_solo),
      inclinacao_graus: parseFloat(inclinacao_graus),
      alerta_chuva: alerta_chuva
    }, paramsSolo);

    console.log(`\n🧠 Análise Avançada (Sensor ${sensor.identificador}):`);
    console.log(`   Solo: ${sensor.tipo_solo} | Risco: ${analiseRisco.nivelRisco} (${analiseRisco.indiceRisco.toFixed(1)}%)`);

    // 4. Inserir Medição
    const dadosMedicao = {
      sensor_id,
      umidade_solo,
      temperatura_solo,
      umidade_ar,
      temperatura_ar,
      inclinacao_graus,
      alerta_chuva: alerta_chuva || false,
      nivel_risco: analiseRisco.nivelRisco,
      indice_risco: analiseRisco.indiceRisco,
      recomendacao: analiseRisco.recomendacao,
      fator_saturacao: analiseRisco.fatores.saturacao,
      fator_inclinacao: analiseRisco.fatores.inclinacao,
      fator_interacao: analiseRisco.fatores.interacao,
      fator_chuva: analiseRisco.fatores.chuva,
      perda_coesao: analiseRisco.fatores.perdaCoesao
    };

    const { data, error } = await supabase
      .from("medicoes")
      .insert([dadosMedicao])
      .select()
      .single();

    if (error) throw error;

    // 5. Processar Previsão e Alertas
    const previsao = await buscarPrevisaoComCache(sensor_id, sensor.latitude, sensor.longitude);
    const erosao = calcularTaxaErosao(data, previsao);

    let alertaCriado = null;
    if (analiseRisco.nivelRisco === "CRITICO" || analiseRisco.nivelRisco === "ALTO") {
      alertaCriado = await criarAlertaAutomatico({
        ...data,
        sensor,
        previsao,
        erosao
      });

      if (alertaCriado) {
        try {
          const msg = formatarAlertaCompleto(data, sensor, previsao, erosao);
          await enviarMensagem(msg);
        } catch (e) {
          console.error("Erro Telegram:", e.message);
        }
      }
    }

    res.status(201).json({
      success: true,
      data: {
        medicao: data,
        analise: analiseRisco,
        alerta: alertaCriado ? { id: alertaCriado.id } : null
      }
    });

  } catch (error) {
    console.error("❌ Erro ao criar medição:", error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 2. BUSCAR MEDIÇÕES RECENTES
// ============================================
async function buscarMedicoesRecentes(req, res) {
  try {
    const limite = parseInt(req.query.limite) || 50;
    const sensor_id = req.query.sensor_id;

    let query = supabase
      .from("medicoes")
      .select(
        `
        *,
        sensores (identificador, regiao, tipo_solo)
      `
      )
      .order("timestamp", { ascending: false })
      .limit(limite);

    if (sensor_id) {
      query = query.eq("sensor_id", sensor_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      quantidade: data.length,
      data,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar medições:", error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 3. BUSCAR ÚLTIMA MEDIÇÃO DE UM SENSOR
// ============================================
async function obterUltimaMedicao(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("medicoes")
      .select(
        `
        *,
        sensores (
          identificador,
          regiao,
          tipo_solo,
          saturacao_critica,
          saturacao_total,
          angulo_atrito_critico
        )
      `
      )
      .eq("sensor_id", id)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar última medição:", error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 4. BUSCAR HISTÓRICO COM FILTROS
// ============================================
async function obterHistoricoMedicoes(req, res) {
  try {
    const { id } = req.params;
    const { horas = 24, nivel_risco } = req.query;

    let query = supabase
      .from("medicoes")
      .select("*")
      .eq("sensor_id", id)
      .gte(
        "timestamp",
        new Date(Date.now() - horas * 60 * 60 * 1000).toISOString()
      )
      .order("timestamp", { ascending: false });

    if (nivel_risco) {
      query = query.eq("nivel_risco", nivel_risco);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calcular estatísticas do período
    const stats = {
      total: data.length,
      indice_risco_medio:
        data.reduce((sum, m) => sum + (m.indice_risco || 0), 0) / data.length,
      indice_risco_maximo: Math.max(...data.map((m) => m.indice_risco || 0)),
      umidade_media:
        data.reduce((sum, m) => sum + m.umidade_solo, 0) / data.length,
      por_nivel: {
        BAIXO: data.filter((m) => m.nivel_risco === "BAIXO").length,
        MEDIO: data.filter((m) => m.nivel_risco === "MEDIO").length,
        ALTO: data.filter((m) => m.nivel_risco === "ALTO").length,
        CRITICO: data.filter((m) => m.nivel_risco === "CRITICO").length,
      },
    };

    res.json({
      success: true,
      periodo_horas: horas,
      estatisticas: stats,
      medicoes: data,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar histórico:", error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 5. BUSCAR MEDIÇÕES POR PERÍODO
// ============================================
async function buscarMedicoesPorPeriodo(req, res) {
  try {
    const { sensor_id, data_inicio, data_fim } = req.query;

    if (!sensor_id || !data_inicio || !data_fim) {
      return res.status(400).json({
        error: "Parâmetros obrigatórios: sensor_id, data_inicio, data_fim",
      });
    }

    const { data, error } = await supabase
      .from("medicoes")
      .select("*")
      .eq("sensor_id", sensor_id)
      .gte("timestamp", data_inicio)
      .lte("timestamp", data_fim)
      .order("timestamp", { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      periodo: { inicio: data_inicio, fim: data_fim },
      quantidade: data.length,
      data,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar medições por período:", error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 6. ESTATÍSTICAS GERAIS
// ============================================
async function buscarEstatisticas(req, res) {
  try {
    const sensor_id = req.query.sensor_id;

    let query = supabase
      .from("medicoes")
      .select(
        `
        id,
        sensor_id,
        sensores (identificador, regiao, tipo_solo),
        umidade_solo,
        temperatura_solo,
        umidade_ar,
        temperatura_ar,
        inclinacao_graus,
        nivel_risco,
        indice_risco,
        timestamp
      `
      )
      .order("timestamp", { ascending: false })
      .limit(10);

    if (sensor_id) {
      query = query.eq("sensor_id", sensor_id);
    }

    const { data: ultimasMedicoes, error: error1 } = await query;

    let contagemQuery = supabase
      .from("medicoes")
      .select("nivel_risco, indice_risco")
      .gte(
        "timestamp",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      );

    if (sensor_id) {
      contagemQuery = contagemQuery.eq("sensor_id", sensor_id);
    }

    const { data: contagemRisco, error: error2 } = await contagemQuery;

    if (error1 || error2) throw error1 || error2;

    const normalized = (v) =>
      String(v || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();

    const stats = {
      baixo: contagemRisco.filter((m) => normalized(m.nivel_risco) === "BAIXO")
        .length,
      medio: contagemRisco.filter((m) => normalized(m.nivel_risco) === "MEDIO")
        .length,
      alto: contagemRisco.filter((m) => normalized(m.nivel_risco) === "ALTO")
        .length,
      critico: contagemRisco.filter(
        (m) => normalized(m.nivel_risco) === "CRITICO"
      ).length,
      indice_medio:
        contagemRisco.reduce((sum, m) => sum + (m.indice_risco || 0), 0) /
        contagemRisco.length,
    };

    const medicoesMelhores = await Promise.all(
      ultimasMedicoes.map(async (med) => {
        const { data: previsao } = await supabase
          .from("previsoes_clima")
          .select("*")
          .eq("sensor_id", med.sensor_id)
          .order("timestamp", { ascending: false })
          .limit(1)
          .single();

        const erosao = calcularTaxaErosao(med, previsao);
        return { ...med, previsao, erosao };
      })
    );

    res.json({
      success: true,
      ultimasMedicoes: medicoesMelhores,
      estatisticasUltimas24h: stats,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar estatísticas:", error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  criarMedicao,
  buscarMedicoesRecentes,
  obterUltimaMedicao,
  obterHistoricoMedicoes,
  buscarMedicoesPorPeriodo,
  buscarEstatisticas,
  buscarPrevisaoComCache,
};
