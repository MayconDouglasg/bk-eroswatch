/**
 * CONTROLLER: Medições
 * Gerencia dados coletados pelos sensores
 */

const supabase = require("../config/supabase");
const {
  buscarPrevisao,
  calcularRiscoCombinado,
} = require("../config/openweather");

const {
  enviarMensagem,
  formatarAlertaCompleto,
  formatarAlertaSimples,
} = require("../config/telegram");

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
// 1. CRIAR NOVA MEDIÇÃO (ESP32 envia dados)
// ============================================
async function criarMedicao(req, res) {
  try {
    console.log("\n📌 [MEDIÇÃO] Iniciando criação de medição...");
    console.log("   Payload:", JSON.stringify(req.body));

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
      console.error("❌ Campos obrigatórios faltando");
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

    if (error) {
      console.error("❌ Erro ao inserir:", error);
      throw error;
    }

    const medicaoInserida = data[0];
    console.log(`✅ Medição inserida: ID ${medicaoInserida.id}`);

    // Buscar dados do sensor
    console.log("📍 Buscando dados do sensor...");
    const { data: sensor, error: sensorError } = await supabase
      .from("sensores")
      .select("*")
      .eq("id", sensor_id)
      .single();

    if (sensorError) {
      console.error("❌ Erro ao buscar sensor:", sensorError);
    } else {
      console.log(`✅ Sensor: ${sensor?.identificador} (${sensor?.regiao})`);
    }

    // Buscar previsão do tempo COM CACHE
    console.log("🌤️ Buscando previsão do clima...");
    let previsao = null;
    if (sensor && sensor.latitude && sensor.longitude) {
      previsao = await buscarPrevisaoComCache(
        sensor_id,
        sensor.latitude,
        sensor.longitude
      );
      if (previsao) {
        console.log(`✅ Previsão: ${previsao.chuva_proximas_24h}mm chuva`);
      }
    }

    // Calcular taxa de erosão
    const erosao = calcularTaxaErosao(medicaoInserida, previsao);
    console.log(`📊 Erosão: ${erosao?.taxa} t/ha (${erosao?.risco})`);

    // Recalcular risco combinando solo + clima
    let riscoFinal = nivel_risco;
    if (previsao) {
      riscoFinal = calcularRiscoCombinado(medicaoInserida, previsao);
      console.log(`⚠️ Risco ajustado: ${nivel_risco} → ${riscoFinal}`);
    }

    // ========================================
    // ENVIAR ALERTAS PARA TELEGRAM
    // ========================================
    console.log("\n🔔 [TELEGRAM] Verificando necessidade de alerta...");
    console.log(`   Nível de risco: ${riscoFinal}`);

    if (riscoFinal === "CRITICO" || riscoFinal === "ALTO") {
      console.log(`🚨 [TELEGRAM] Enviando alerta ${riscoFinal}...`);

      try {
        // Formatar mensagem completa com plano de ação
        const mensagem = formatarAlertaCompleto(
          medicaoInserida,
          sensor,
          previsao
        );

        console.log("📨 [TELEGRAM] Conteúdo da mensagem:");
        console.log(mensagem);

        // Enviar para Telegram
        const enviado = await enviarMensagem(mensagem);

        if (enviado) {
          console.log("✅ [TELEGRAM] Mensagem enviada com sucesso!");
        } else {
          console.error("❌ [TELEGRAM] Falha ao enviar");
        }
      } catch (telegramError) {
        console.error("❌ [TELEGRAM] Erro:", telegramError);
      }

      // Registrar alerta no banco de dados
      try {
        const nivelCriticidade = riscoFinal === "CRITICO" ? "CRITICO" : "ALTO";
        await supabase.from("alertas").insert([
          {
            sensor_id,
            medicao_id: medicaoInserida.id,
            tipo_alerta: `RISCO_${riscoFinal}`,
            nivel_criticidade: nivelCriticidade,
            mensagem: `Risco ${riscoFinal}: Taxa de Erosão ${erosao?.taxa} t/ha`,
            status: "ativo",
          },
        ]);
        console.log("✅ Alerta registrado no banco");
      } catch (dbError) {
        console.error("❌ Erro ao registrar alerta:", dbError);
      }
    } else {
      console.log(`ℹ️ [TELEGRAM] Sem alerta necessário (risco: ${riscoFinal})`);
    }

    // Atualizar risco se mudou
    if (riscoFinal !== medicaoInserida.nivel_risco) {
      await supabase
        .from("medicoes")
        .update({ nivel_risco: riscoFinal })
        .eq("id", medicaoInserida.id);
    }

    console.log("✅ Processo concluído\n");

    res.status(201).json({
      success: true,
      message: "Medição registrada com sucesso",
      data: {
        ...medicaoInserida,
        nivel_risco: riscoFinal,
        erosao,
      },
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

// ============================================
// 4. ESTATÍSTICAS GERAIS
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

    if (sensor_id) {
      query = query.eq("sensor_id", sensor_id);
    }

    const { data: ultimasMedicoes, error: error1 } = await query;

    let contagemQuery = supabase
      .from("medicoes")
      .select("nivel_risco")
      .gte(
        "timestamp",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      );

    if (sensor_id) {
      contagemQuery = contagemQuery.eq("sensor_id", sensor_id);
    }

    const { data: contagemRisco, error: error2 } = await contagemQuery;

    if (error1 || error2) throw error1 || error2;

    // Normalizar nivel_risco
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
  buscarMedicoesPorPeriodo,
  buscarEstatisticas,
  buscarPrevisaoComCache,
};
