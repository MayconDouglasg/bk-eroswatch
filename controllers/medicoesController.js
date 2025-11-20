/**
 * CONTROLLER: Medições
 * Gerencia dados coletados pelos sensores
 */

const supabase = require("../config/supabase");
const {
  buscarPrevisao,
  calcularRiscoCombinado,
} = require("../config/openweather");

const { enviarMensagem, formatarAlerta } = require("../config/telegram");
const { calcularTaxaErosao } = require("./erosaoController");

// ============================================
// CACHE: Previsão do tempo (1 hora)
// ============================================
let cachePrevisao = {};

async function buscarPrevisaoComCache(sensorId, latitude, longitude) {
  const agora = Date.now();
  const cache = cachePrevisao[sensorId];

  // Se cache existe e tem menos de 1 hora
  if (cache && agora - cache.timestamp < 3600000) {
    console.log("📦 Usando previsão do cache");
    return cache.dados;
  }

  // Buscar nova previsão
  const previsao = await buscarPrevisao(latitude, longitude);

  // Salvar no cache
  if (previsao) {
    cachePrevisao[sensorId] = {
      dados: previsao,
      timestamp: agora,
    };
  }

  return previsao;
}

// ============================================
// FUNÇÃO AUXILIAR: Enviar alerta crítico
// ============================================
async function enviarAlertaCritico(sensor_id, medicao, previsao) {
  try {
    const mensagem = `🚨 ALERTA CRÍTICO!\nSensor: ${sensor_id}\nRisco: CRÍTICO\nChuva prevista: ${previsao.chuva_proximas_24h}mm`;
    await enviarMensagem(mensagem);
    console.log("🚨 Alerta crítico enviado");
  } catch (error) {
    console.error("❌ Erro ao enviar alerta crítico:", error);
  }
}

// ============================================
// 1. CRIAR NOVA MEDIÇÃO (ESP32 envia dados)
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
      nivel_risco,
      alerta_chuva,
    } = req.body;

    // Validação básica
    if (!sensor_id || !nivel_risco) {
      return res.status(400).json({
        error: "Campos obrigatórios: sensor_id, nivel_risco",
      });
    }

    // Inserir no banco
    const { data, error } = await supabase
      .from("medicoes")
      .insert([
        {
          sensor_id,
          umidade_solo,
          temperatura_solo,
          umidade_ar,
          temperatura_ar,
          inclinacao_graus,
          nivel_risco,
          alerta_chuva: alerta_chuva || false,
        },
      ])
      .select();

    if (error) throw error;

    // Buscar previsão do tempo COM CACHE
    const { data: sensor } = await supabase
      .from("sensores")
      .select("latitude, longitude")
      .eq("id", sensor_id)
      .single();

    if (sensor && sensor.latitude && sensor.longitude) {
      const previsao = await buscarPrevisaoComCache(
        sensor_id,
        sensor.latitude,
        sensor.longitude
      );

      if (previsao) {
        // Armazenar previsão no banco
        await supabase.from("previsoes_clima").insert([
          {
            sensor_id,
            temperatura: previsao.temperatura,
            umidade: previsao.umidade,
            vento: previsao.vento,
            descricao: previsao.descricao,
            chuva_proximas_24h: previsao.chuva_proximas_24h,
            risco_chuva_intensa: previsao.risco_chuva_intensa,
          },
        ]);

        // Recalcular risco combinando solo + clima
        const riscoFinal = calcularRiscoCombinado(data[0], previsao);

        // Se risco mudou para mais grave, atualizar
        if (riscoFinal !== data[0].nivel_risco) {
          await supabase
            .from("medicoes")
            .update({ nivel_risco: riscoFinal })
            .eq("id", data[0].id);

          console.log(
            `⚠️ Risco ajustado: ${data[0].nivel_risco} → ${riscoFinal} (clima)`
          );
        }

        // Se CRITICO, enviar alerta urgente
        if (riscoFinal === "CRITICO") {
          await enviarAlertaCritico(sensor_id, data[0], previsao);
        }
      }
    }

    // Se risco ALTO ou CRITICO, enviar alerta ao Telegram
    if (nivel_risco === "ALTO" || nivel_risco === "CRITICO") {
      // Buscar dados do sensor
      const { data: sensorData } = await supabase
        .from("sensores")
        .select("*")
        .eq("id", sensor_id)
        .single();

      // Formatar e enviar mensagem
      const mensagem = formatarAlerta(data[0], sensorData);
      await enviarMensagem(mensagem);

      // Criar alerta no banco
      await criarAlertaAutomatico(
        sensor_id,
        data[0].id,
        umidade_solo,
        inclinacao_graus
      );
    }

    console.log(
      `✅ Medição criada: Sensor ${sensor_id} - Risco ${nivel_risco}`
    );

    res.status(201).json({
      success: true,
      message: "Medição registrada com sucesso",
      data: data[0],
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
        sensores (identificador, regiao)
      `
      )
      .order("timestamp", { ascending: false })
      .limit(limite);

    // Filtrar por sensor específico (opcional)
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
// 3. BUSCAR MEDIÇÕES POR PERÍODO
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

/**
 * 4. ESTATÍSTICAS GERAIS
 */
async function buscarEstatisticas(req, res) {
  try {
    // Última medição de cada sensor
    const { data: ultimasMedicoes, error: error1 } = await supabase
      .from("medicoes")
      .select(
        `
        id,
        sensor_id,
        sensores (identificador, regiao),
        umidade_solo,
        temperatura_solo,
        inclinacao_graus,
        nivel_risco,
        timestamp
      `
      )
      .order("timestamp", { ascending: false })
      .limit(10);

    // Contagem por nível de risco
    const { data: contagemRisco, error: error2 } = await supabase
      .from("medicoes")
      .select("nivel_risco")
      .gte(
        "timestamp",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      );

    if (error1 || error2) throw error1 || error2;

    // Calcular estatísticas
    const stats = {
      baixo: contagemRisco.filter((m) => m.nivel_risco === "BAIXO").length,
      medio: contagemRisco.filter((m) => m.nivel_risco === "MEDIO").length,
      alto: contagemRisco.filter((m) => m.nivel_risco === "ALTO").length,
      critico: contagemRisco.filter((m) => m.nivel_risco === "CRITICO").length,
    };

    // Enriquecer últimas medições com dados de clima e erosão
    const medicoesMelhores = await Promise.all(
      ultimasMedicoes.map(async (med) => {
        // Buscar previsão do clima
        const { data: previsao } = await supabase
          .from("previsoes_clima")
          .select("*")
          .eq("sensor_id", med.sensor_id)
          .order("timestamp", { ascending: false })
          .limit(1)
          .single();

        // Calcular erosão
        const erosao = calcularTaxaErosao(med, previsao);

        return {
          ...med,
          previsao,
          erosao,
        };
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

// ============================================
// FUNÇÃO AUXILIAR: Criar alerta automático
// ============================================
async function criarAlertaAutomatico(
  sensor_id,
  medicao_id,
  umidade,
  inclinacao
) {
  try {
    let mensagem = `Solo saturado (${umidade}%) e inclinação crítica (${inclinacao}°). Risco iminente de deslizamento!`;

    await supabase.from("alertas").insert([
      {
        sensor_id,
        medicao_id,
        tipo_alerta: "RISCO_ALTO",
        nivel_criticidade: "ALTO",
        mensagem,
        status: "ativo",
      },
    ]);

    console.log(`⚠️ Alerta criado automaticamente para sensor ${sensor_id}`);
  } catch (error) {
    console.error("❌ Erro ao criar alerta automático:", error);
  }
}

module.exports = {
  criarMedicao,
  buscarMedicoesRecentes,
  buscarMedicoesPorPeriodo,
  buscarEstatisticas,
  buscarPrevisaoComCache,
};
