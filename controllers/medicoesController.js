/**
 * CONTROLLER: Medições v2.0
 * Gerencia dados coletados pelos sensores
 * ATUALIZADO: Suporte ao algoritmo geotécnico avançado
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
const { criarAlertaAutomatico } = require("./alertasController");

// ============================================
// CACHE: Previsão do tempo (1 hora)
// ============================================
let cachePrevisao = {};

async function buscarPrevisaoComCache(sensorId, latitude, longitude) {
  const agora = Date.now();
  const cache = cachePrevisao[sensorId];

  if (cache && agora - cache.timestamp < 3600000) {
    console.log("📦 Usando previsão do cache");
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
// 1. CRIAR NOVA MEDIÇÃO (ESP32 envia dados)
// ============================================
async function criarMedicao(req, res) {
  try {
    console.log("\n📌 [MEDIÇÃO v2.0] Iniciando criação de medição...");
    console.log("   Payload:", JSON.stringify(req.body, null, 2));

    const {
      sensor_id,
      umidade_solo,
      temperatura_solo,
      umidade_ar,
      temperatura_ar,
      inclinacao_graus,
      nivel_risco,
      alerta_chuva,
      // ===== NOVOS CAMPOS DO ALGORITMO AVANÇADO =====
      indice_risco,
      recomendacao,
      fator_saturacao,
      fator_inclinacao,
      fator_interacao,
      fator_chuva,
      perda_coesao,
    } = req.body;

    // ========================================
    // VALIDAÇÕES
    // ========================================
    if (!sensor_id || !nivel_risco) {
      console.error("❌ Campos obrigatórios faltando");
      return res.status(400).json({
        error: "Campos obrigatórios: sensor_id, nivel_risco",
      });
    }

    // Validar nível de risco
    const niveisValidos = ["BAIXO", "MEDIO", "ALTO", "CRITICO"];
    if (!niveisValidos.includes(nivel_risco)) {
      return res.status(400).json({
        error: `Nível de risco inválido. Use: ${niveisValidos.join(", ")}`,
      });
    }

    // Validar ranges
    if (umidade_solo < 0 || umidade_solo > 100) {
      return res.status(400).json({
        error: "Umidade do solo deve estar entre 0 e 100%",
      });
    }

    if (inclinacao_graus < 0 || inclinacao_graus > 90) {
      return res.status(400).json({
        error: "Inclinação deve estar entre 0 e 90 graus",
      });
    }

    if (
      indice_risco !== undefined &&
      (indice_risco < 0 || indice_risco > 100)
    ) {
      return res.status(400).json({
        error: "Índice de risco deve estar entre 0 e 100",
      });
    }

    // ----------------------------
    // VALIDAÇÃO TEMPERATURA SOLO
    // ----------------------------
    const TEMP_SOLO_MIN = parseFloat(process.env.TEMPERATURA_SOLO_MIN ?? -10);
    const TEMP_SOLO_MAX = parseFloat(process.env.TEMPERATURA_SOLO_MAX ?? 60);

    if (
      temperatura_solo !== undefined &&
      (temperatura_solo < TEMP_SOLO_MIN || temperatura_solo > TEMP_SOLO_MAX)
    ) {
      console.warn(
        `⚠️ temperatura_solo ${temperatura_solo} fora do intervalo [${TEMP_SOLO_MIN}, ${TEMP_SOLO_MAX}]`
      );
      return res.status(400).json({
        error: "temperatura_solo fora do intervalo permitido",
        allowed_range: { min: TEMP_SOLO_MIN, max: TEMP_SOLO_MAX },
        valor_recebido: temperatura_solo,
      });
    }

    console.log("✅ Validações OK");

    // ========================================
    // INSERIR NO BANCO
    // ========================================
    const dadosMedicao = {
      sensor_id,
      umidade_solo,
      temperatura_solo,
      umidade_ar,
      temperatura_ar,
      inclinacao_graus,
      nivel_risco,
      alerta_chuva: alerta_chuva || false,
    };

    // Adicionar novos campos se fornecidos
    if (indice_risco !== undefined) dadosMedicao.indice_risco = indice_risco;
    if (recomendacao) dadosMedicao.recomendacao = recomendacao;
    if (fator_saturacao !== undefined)
      dadosMedicao.fator_saturacao = fator_saturacao;
    if (fator_inclinacao !== undefined)
      dadosMedicao.fator_inclinacao = fator_inclinacao;
    if (fator_interacao !== undefined)
      dadosMedicao.fator_interacao = fator_interacao;
    if (fator_chuva !== undefined) dadosMedicao.fator_chuva = fator_chuva;
    if (perda_coesao !== undefined) dadosMedicao.perda_coesao = perda_coesao;

    console.log("📝 Dados a inserir:", Object.keys(dadosMedicao));

    const { data, error } = await supabase
      .from("medicoes")
      .insert([dadosMedicao])
      .select();

    if (error) {
      console.error("❌ Erro ao inserir:", error);
      throw error;
    }

    const medicaoInserida = data[0];
    console.log(`✅ Medição inserida: ID ${medicaoInserida.id}`);
    console.log(`   Índice de Risco: ${medicaoInserida.indice_risco || "N/A"}`);
    console.log(`   Nível: ${medicaoInserida.nivel_risco}`);

    // ========================================
    // BUSCAR DADOS DO SENSOR
    // ========================================
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
      console.log(`   Tipo de Solo: ${sensor?.tipo_solo || "NÃO CONFIGURADO"}`);
    }

    // ========================================
    // BUSCAR PREVISÃO DO TEMPO COM CACHE
    // ========================================
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

        // Salvar previsão no banco
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
      }
    }

    // ========================================
    // CALCULAR TAXA DE EROSÃO
    // ========================================
    const erosao = calcularTaxaErosao(medicaoInserida, previsao);
    console.log(`📊 Erosão: ${erosao?.taxa} t/ha (${erosao?.risco})`);

    // ========================================
    // RECALCULAR RISCO COMBINANDO SOLO + CLIMA
    // ========================================
    let riscoFinal = nivel_risco;
    if (previsao) {
      riscoFinal = calcularRiscoCombinado(medicaoInserida, previsao);
      console.log(`⚠️ Risco ajustado: ${nivel_risco} → ${riscoFinal}`);

      // Atualizar no banco se mudou
      if (riscoFinal !== nivel_risco) {
        await supabase
          .from("medicoes")
          .update({ nivel_risco: riscoFinal })
          .eq("id", medicaoInserida.id);

        medicaoInserida.nivel_risco = riscoFinal;
      }
    }

    // ========================================
    // CRIAR ALERTA AUTOMÁTICO
    // ========================================
    console.log("\n🔔 [ALERTAS] Verificando necessidade de alerta...");
    console.log(`   Nível de risco final: ${riscoFinal}`);
    console.log(`   Índice numérico: ${indice_risco || "N/A"}`);

    let alertaCriado = null;

    if (riscoFinal === "CRITICO" || riscoFinal === "ALTO") {
      console.log(`🚨 Criando alerta automático (${riscoFinal})...`);

      // Usar o novo sistema de alertas automáticos
      alertaCriado = await criarAlertaAutomatico({
        ...medicaoInserida,
        sensor,
        previsao,
        erosao,
      });

      if (alertaCriado) {
        console.log(`✅ Alerta criado: ID ${alertaCriado.id}`);

        // ========================================
        // ENVIAR PARA TELEGRAM
        // ========================================
        console.log("📨 [TELEGRAM] Enviando notificação...");
        try {
          const mensagem = formatarAlertaCompleto(
            medicaoInserida,
            sensor,
            previsao,
            erosao
          );

          const enviado = await enviarMensagem(mensagem);

          if (enviado) {
            console.log("✅ [TELEGRAM] Mensagem enviada!");
          } else {
            console.error("❌ [TELEGRAM] Falha ao enviar");
          }
        } catch (telegramError) {
          console.error("❌ [TELEGRAM] Erro:", telegramError.message);
        }
      }
    } else {
      console.log(`ℹ️ Sem necessidade de alerta (risco: ${riscoFinal})`);
    }

    console.log("✅ Processo concluído\n");

    // ========================================
    // RESPOSTA
    // ========================================
    res.status(201).json({
      success: true,
      message: "Medição registrada com sucesso",
      data: {
        medicao: {
          ...medicaoInserida,
          nivel_risco: riscoFinal,
        },
        erosao,
        alerta: alertaCriado
          ? {
              id: alertaCriado.id,
              tipo: alertaCriado.tipo_alerta,
              criticidade: alertaCriado.nivel_criticidade,
            }
          : null,
        algoritmo_v2: {
          indice_risco: indice_risco || null,
          fatores: {
            saturacao: fator_saturacao || null,
            inclinacao: fator_inclinacao || null,
            interacao: fator_interacao || null,
            chuva: fator_chuva || null,
            perda_coesao: perda_coesao || null,
          },
        },
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
