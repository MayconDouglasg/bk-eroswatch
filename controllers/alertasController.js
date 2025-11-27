/**
 * CONTROLLER: Alertas v2.0
 * Gerencia alertas críticos do sistema
 * ATUALIZADO: Sistema inteligente baseado no algoritmo geotécnico
 */

const supabase = require("../config/supabase");

// ============================================
// CRIAR ALERTA AUTOMÁTICO (NOVO SISTEMA)
// ============================================
async function criarAlertaAutomatico(dados) {
  try {
    const {
      sensor_id,
      id: medicao_id,
      nivel_risco,
      indice_risco,
      umidade_solo,
      inclinacao_graus,
      alerta_chuva,
      recomendacao,
      sensor,
      previsao,
      erosao,
    } = dados;

    // Não criar alerta se risco for BAIXO
    if (nivel_risco === "BAIXO") {
      console.log("   ℹ️ Risco BAIXO - Sem necessidade de alerta");
      return null;
    }

    console.log(`   🔍 Analisando condições para alerta ${nivel_risco}...`);

    // ========================================
    // DETERMINAR TIPO E CRITICIDADE DO ALERTA
    // ========================================
    let tipo_alerta = "RISCO_ALTO";
    let nivel_criticidade = nivel_risco;
    let mensagem = recomendacao || "Condições de risco detectadas";

    // ===== CASOS ESPECÍFICOS =====
    if (nivel_risco === "CRITICO") {
      tipo_alerta = "RISCO_CRITICO";

      // Caso 1: Chuva + Solo Saturado (MAIS PERIGOSO)
      if (alerta_chuva && umidade_solo > 70) {
        tipo_alerta = "CHUVA_INTENSA";
        mensagem = `EMERGÊNCIA: Chuva intensa prevista com solo saturado (${umidade_solo.toFixed(
          1
        )}%). RISCO EXTREMO DE DESLIZAMENTO! EVACUAR IMEDIATAMENTE!`;
        console.log("   🚨 CRÍTICO: Chuva + Saturação");
      }
      // Caso 2: Solo Totalmente Saturado
      else if (umidade_solo > 90) {
        tipo_alerta = "SATURACAO_SOLO";
        mensagem = `PERIGO IMINENTE: Solo totalmente saturado (${umidade_solo.toFixed(
          1
        )}%) + inclinação ${inclinacao_graus.toFixed(
          1
        )}°. Pressão neutra máxima. EVACUAR ÁREA!`;
        console.log("   🚨 CRÍTICO: Saturação Total");
      }
      // Caso 3: Ângulo Crítico Excedido
      else if (inclinacao_graus > 30) {
        tipo_alerta = "ANGULO_ATRITO_EXCEDIDO";
        mensagem = `ALERTA MÁXIMO: Inclinação crítica (${inclinacao_graus.toFixed(
          1
        )}°) excede ângulo de atrito natural. Umidade: ${umidade_solo.toFixed(
          1
        )}%. Risco iminente de ruptura!`;
        console.log("   🚨 CRÍTICO: Ângulo Excedido");
      }
      // Caso genérico CRÍTICO
      else {
        mensagem = `PERIGO CRÍTICO: Índice de risco ${indice_risco?.toFixed(
          1
        )}/100. Condições extremas de instabilidade do solo. Ação imediata necessária!`;
        console.log("   🚨 CRÍTICO: Genérico");
      }
    } else if (nivel_risco === "ALTO") {
      // Caso 1: Saturação Crítica
      if (umidade_solo > 75) {
        tipo_alerta = "SATURACAO_CRITICA";
        mensagem = `ALERTA: Solo em saturação crítica (${umidade_solo.toFixed(
          1
        )}%). Perda de coesão iniciada. Preparar evacuação preventiva.`;
        console.log("   ⚠️ ALTO: Saturação Crítica");
      }
      // Caso 2: Inclinação + Perda de Coesão
      else if (inclinacao_graus > 25 && umidade_solo > 60) {
        tipo_alerta = "PERDA_COESAO";
        mensagem = `ALERTA: Inclinação elevada (${inclinacao_graus.toFixed(
          1
        )}°) + umidade ${umidade_solo.toFixed(
          1
        )}%. Solo perdendo coesão. Monitorar atentamente.`;
        console.log("   ⚠️ ALTO: Perda de Coesão");
      }
      // Caso 3: Inclinação Crítica
      else if (inclinacao_graus > 20) {
        tipo_alerta = "INCLINACAO_CRITICA";
        mensagem = `ATENÇÃO: Inclinação crítica detectada (${inclinacao_graus.toFixed(
          1
        )}°). Verificar estabilidade do talude e vegetação.`;
        console.log("   ⚠️ ALTO: Inclinação Crítica");
      }
      // Caso genérico ALTO
      else {
        tipo_alerta = "RISCO_ALTO";
        mensagem = `ATENÇÃO: Condições de alto risco. Índice: ${indice_risco?.toFixed(
          1
        )}/100. Vistoriar área.`;
        console.log("   ⚠️ ALTO: Genérico");
      }
    } else if (nivel_risco === "MEDIO") {
      // Médio só gera alerta se houver chuva prevista
      if (alerta_chuva) {
        tipo_alerta = "CHUVA_INTENSA";
        mensagem = `AVISO: Chuva intensa prevista. Umidade atual: ${umidade_solo.toFixed(
          1
        )}%. Monitorar evolução.`;
        console.log("   🟡 MÉDIO: Chuva Prevista");
      } else {
        console.log("   ℹ️ MÉDIO sem chuva - Sem alerta");
        return null; // Não criar alerta para MÉDIO sem chuva
      }
    }

    // ========================================
    // MONTAR CONTEXTO JSON
    // ========================================
    const contexto_alerta = {
      umidade_solo,
      inclinacao_graus,
      indice_risco: indice_risco || null,
      alerta_chuva,
      tipo_solo: sensor?.tipo_solo || null,
      saturacao_critica: sensor?.saturacao_critica || null,
      angulo_atrito_critico: sensor?.angulo_atrito_critico || null,
      timestamp: new Date().toISOString(),
    };

    // Adicionar dados de previsão se disponível
    if (previsao) {
      contexto_alerta.previsao = {
        chuva_24h: previsao.chuva_proximas_24h,
        descricao: previsao.descricao,
        risco_chuva_intensa: previsao.risco_chuva_intensa,
      };
    }

    // Adicionar dados de erosão se disponível
    if (erosao) {
      contexto_alerta.erosao = {
        taxa: erosao.taxa,
        risco: erosao.risco,
      };
    }

    // ========================================
    // INSERIR ALERTA NO BANCO
    // ========================================
    console.log(`   💾 Salvando alerta: ${tipo_alerta}`);

    const { data, error } = await supabase
      .from("alertas")
      .insert([
        {
          sensor_id,
          medicao_id,
          tipo_alerta,
          nivel_criticidade,
          mensagem,
          contexto_alerta,
          status: "ativo",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("   ❌ Erro ao inserir alerta:", error);
      throw error;
    }

    console.log(`   ✅ Alerta criado: ID ${data.id}`);
    console.log(
      `   📋 Tipo: ${tipo_alerta} | Criticidade: ${nivel_criticidade}`
    );

    return data;
  } catch (error) {
    console.error("❌ Erro ao criar alerta automático:", error);
    return null;
  }
}

// ============================================
// 1. BUSCAR ALERTAS ATIVOS
// ============================================
async function buscarAlertasAtivos(req, res) {
  try {
    const { data, error } = await supabase
      .from("alertas")
      .select(
        `
        *,
        sensores (
          identificador, 
          regiao,
          tipo_solo
        ),
        medicoes (
          umidade_solo,
          inclinacao_graus,
          indice_risco,
          nivel_risco
        )
      `
      )
      .eq("status", "ativo")
      .order("nivel_criticidade", { ascending: false })
      .order("timestamp", { ascending: false });

    if (error) throw error;

    // Agrupar por criticidade
    const porCriticidade = {
      CRITICO: data.filter((a) => a.nivel_criticidade === "CRITICO"),
      ALTO: data.filter((a) => a.nivel_criticidade === "ALTO"),
      MEDIO: data.filter((a) => a.nivel_criticidade === "MEDIO"),
      BAIXO: data.filter((a) => a.nivel_criticidade === "BAIXO"),
    };

    res.json({
      success: true,
      total: data.length,
      por_criticidade: {
        critico: porCriticidade.CRITICO.length,
        alto: porCriticidade.ALTO.length,
        medio: porCriticidade.MEDIO.length,
        baixo: porCriticidade.BAIXO.length,
      },
      alertas: data,
      agrupados: porCriticidade,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar alertas ativos:", error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 2. CRIAR ALERTA MANUALMENTE
// ============================================
async function criarAlerta(req, res) {
  try {
    const {
      sensor_id,
      medicao_id,
      tipo_alerta,
      nivel_criticidade,
      mensagem,
      contexto_alerta,
    } = req.body;

    if (!sensor_id || !tipo_alerta || !mensagem) {
      return res.status(400).json({
        error: "Campos obrigatórios: sensor_id, tipo_alerta, mensagem",
      });
    }

    // Validar tipo de alerta
    const tiposValidos = [
      "RISCO_ALTO",
      "RISCO_CRITICO",
      "CHUVA_INTENSA",
      "SATURACAO_SOLO",
      "SATURACAO_CRITICA",
      "INCLINACAO_CRITICA",
      "PERDA_COESAO",
      "ANGULO_ATRITO_EXCEDIDO",
      "FALHA_SENSOR",
      "OFFLINE",
    ];

    if (!tiposValidos.includes(tipo_alerta)) {
      return res.status(400).json({
        error: `Tipo de alerta inválido. Use: ${tiposValidos.join(", ")}`,
      });
    }

    const { data, error } = await supabase
      .from("alertas")
      .insert([
        {
          sensor_id,
          medicao_id,
          tipo_alerta,
          nivel_criticidade: nivel_criticidade || "MEDIO",
          mensagem,
          contexto_alerta: contexto_alerta || null,
          status: "ativo",
        },
      ])
      .select();

    if (error) throw error;

    console.log(
      `⚠️ Alerta manual criado: ${tipo_alerta} - Sensor ${sensor_id}`
    );

    res.status(201).json({
      success: true,
      message: "Alerta criado com sucesso",
      data: data[0],
    });
  } catch (error) {
    console.error("❌ Erro ao criar alerta:", error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 3. RESOLVER ALERTA
// ============================================
async function resolverAlerta(req, res) {
  try {
    const { id } = req.params;
    const { resolvido_por, observacoes } = req.body;

    const { data, error } = await supabase
      .from("alertas")
      .update({
        status: "resolvido",
        resolvido_em: new Date().toISOString(),
        resolvido_por: resolvido_por || "Sistema",
        observacoes,
      })
      .eq("id", id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Alerta não encontrado" });
    }

    console.log(`✅ Alerta ${id} resolvido por ${resolvido_por || "Sistema"}`);

    res.json({
      success: true,
      message: "Alerta resolvido",
      data: data[0],
    });
  } catch (error) {
    console.error("❌ Erro ao resolver alerta:", error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 4. RESOLVER TODOS OS ALERTAS DE UM SENSOR
// ============================================
async function resolverAlertasSensor(req, res) {
  try {
    const { sensor_id } = req.params;
    const { resolvido_por, observacoes } = req.body;

    const { data, error } = await supabase
      .from("alertas")
      .update({
        status: "resolvido",
        resolvido_em: new Date().toISOString(),
        resolvido_por: resolvido_por || "Sistema",
        observacoes: observacoes || "Resolução em lote",
      })
      .eq("sensor_id", sensor_id)
      .eq("status", "ativo")
      .select();

    if (error) throw error;

    console.log(`✅ ${data.length} alertas resolvidos do sensor ${sensor_id}`);

    res.json({
      success: true,
      message: `${data.length} alertas resolvidos`,
      data,
    });
  } catch (error) {
    console.error("❌ Erro ao resolver alertas:", error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 5. IGNORAR ALERTA (Falso Positivo)
// ============================================
async function ignorarAlerta(req, res) {
  try {
    const { id } = req.params;
    const { ignorado_por, motivo } = req.body;

    const { data, error } = await supabase
      .from("alertas")
      .update({
        status: "ignorado",
        resolvido_em: new Date().toISOString(), // Usamos o mesmo campo de data
        resolvido_por: ignorado_por || "Admin",
        observacoes: motivo || "Marcado como falso positivo"
      })
      .eq("id", id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Alerta não encontrado" });
    }

    console.log(`🚫 Alerta ${id} ignorado por ${ignorado_por || "Admin"}`);

    res.json({
      success: true,
      message: "Alerta ignorado (falso positivo)",
      data: data[0],
    });
  } catch (error) {
    console.error("❌ Erro ao ignorar alerta:", error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 6. BUSCAR HISTÓRICO DE ALERTAS
// ============================================
async function buscarHistoricoAlertas(req, res) {
  try {
    const limite = parseInt(req.query.limite) || 20;
    const sensor_id = req.query.sensor_id;
    const tipo_alerta = req.query.tipo_alerta;
    const nivel_criticidade = req.query.nivel_criticidade;

    let query = supabase
      .from("alertas")
      .select(
        `
        *,
        sensores (identificador, regiao, tipo_solo),
        medicoes (
          umidade_solo,
          inclinacao_graus,
          indice_risco,
          nivel_risco
        )
      `
      )
      .order("timestamp", { ascending: false })
      .limit(limite);

    if (sensor_id) {
      query = query.eq("sensor_id", sensor_id);
    }

    if (tipo_alerta) {
      query = query.eq("tipo_alerta", tipo_alerta);
    }

    if (nivel_criticidade) {
      query = query.eq("nivel_criticidade", nivel_criticidade);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      quantidade: data.length,
      alertas: data,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar histórico:", error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 7. ESTATÍSTICAS DE ALERTAS
// ============================================
async function buscarEstatisticasAlertas(req, res) {
  try {
    const { sensor_id, dias = 7 } = req.query;

    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - parseInt(dias));

    let query = supabase
      .from("alertas")
      .select("*")
      .gte("timestamp", dataInicio.toISOString());

    if (sensor_id) {
      query = query.eq("sensor_id", sensor_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calcular estatísticas
    const stats = {
      total: data.length,
      ativos: data.filter((a) => a.status === "ativo").length,
      resolvidos: data.filter((a) => a.status === "resolvido").length,
      ignorado: data.filter((a) => a.status === "ignorado").length,
      por_criticidade: {
        critico: data.filter((a) => a.nivel_criticidade === "CRITICO").length,
        alto: data.filter((a) => a.nivel_criticidade === "ALTO").length,
        medio: data.filter((a) => a.nivel_criticidade === "MEDIO").length,
        baixo: data.filter((a) => a.nivel_criticidade === "BAIXO").length,
      },
      por_tipo: {},
    };

    // Contar por tipo
    data.forEach((alerta) => {
      const tipo = alerta.tipo_alerta;
      stats.por_tipo[tipo] = (stats.por_tipo[tipo] || 0) + 1;
    });

    // Alertas mais recentes
    const maisRecentes = data
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);

    res.json({
      success: true,
      periodo_dias: parseInt(dias),
      estatisticas: stats,
      alertas_recentes: maisRecentes,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar estatísticas:", error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  criarAlertaAutomatico,
  buscarAlertasAtivos,
  criarAlerta,
  resolverAlerta,
  resolverAlertasSensor,
  ignorarAlerta,
  buscarHistoricoAlertas,
  buscarEstatisticasAlertas,
};
