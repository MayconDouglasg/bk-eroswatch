/**
 * CONTROLLER: Medições
 * Gerencia dados coletados pelos sensores
 */

const supabase = require('../config/supabase');

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
      alerta_chuva
    } = req.body;

    // Validação básica
    if (!sensor_id || !nivel_risco) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: sensor_id, nivel_risco' 
      });
    }

    // Inserir no banco
    const { data, error } = await supabase
      .from('medicoes')
      .insert([{
        sensor_id,
        umidade_solo,
        temperatura_solo,
        umidade_ar,
        temperatura_ar,
        inclinacao_graus,
        nivel_risco,
        alerta_chuva: alerta_chuva || false
      }])
      .select();

    if (error) throw error;

    // Se risco ALTO, criar alerta
    if (nivel_risco === 'ALTO') {
      await criarAlertaAutomatico(sensor_id, data[0].id, umidade_solo, inclinacao_graus);
    }

    console.log(`✅ Medição criada: Sensor ${sensor_id} - Risco ${nivel_risco}`);
    
    res.status(201).json({
      success: true,
      message: 'Medição registrada com sucesso',
      data: data[0]
    });

  } catch (error) {
    console.error('❌ Erro ao criar medição:', error);
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
      .from('medicoes')
      .select(`
        *,
        sensores (identificador, regiao)
      `)
      .order('timestamp', { ascending: false })
      .limit(limite);

    // Filtrar por sensor específico (opcional)
    if (sensor_id) {
      query = query.eq('sensor_id', sensor_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      quantidade: data.length,
      data
    });

  } catch (error) {
    console.error('❌ Erro ao buscar medições:', error);
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
        error: 'Parâmetros obrigatórios: sensor_id, data_inicio, data_fim' 
      });
    }

    const { data, error } = await supabase
      .from('medicoes')
      .select('*')
      .eq('sensor_id', sensor_id)
      .gte('timestamp', data_inicio)
      .lte('timestamp', data_fim)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      periodo: { inicio: data_inicio, fim: data_fim },
      quantidade: data.length,
      data
    });

  } catch (error) {
    console.error('❌ Erro ao buscar medições por período:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 4. ESTATÍSTICAS GERAIS
// ============================================
async function buscarEstatisticas(req, res) {
  try {
    // Última medição de cada sensor
    const { data: ultimasMedicoes, error: error1 } = await supabase
      .from('medicoes')
      .select(`
        sensor_id,
        sensores (identificador, regiao),
        umidade_solo,
        temperatura_solo,
        inclinacao_graus,
        nivel_risco,
        timestamp
      `)
      .order('timestamp', { ascending: false })
      .limit(10);

    // Contagem por nível de risco
    const { data: contagemRisco, error: error2 } = await supabase
      .from('medicoes')
      .select('nivel_risco')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error1 || error2) throw error1 || error2;

    // Calcular estatísticas
    const stats = {
      baixo: contagemRisco.filter(m => m.nivel_risco === 'BAIXO').length,
      medio: contagemRisco.filter(m => m.nivel_risco === 'MEDIO').length,
      alto: contagemRisco.filter(m => m.nivel_risco === 'ALTO').length
    };

    res.json({
      success: true,
      ultimasMedicoes,
      estatisticasUltimas24h: stats
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// FUNÇÃO AUXILIAR: Criar alerta automático
// ============================================
async function criarAlertaAutomatico(sensor_id, medicao_id, umidade, inclinacao) {
  try {
    let mensagem = `Solo saturado (${umidade}%) e inclinação crítica (${inclinacao}°). Risco iminente de deslizamento!`;
    
    await supabase
      .from('alertas')
      .insert([{
        sensor_id,
        medicao_id,
        tipo_alerta: 'RISCO_ALTO',
        nivel_criticidade: 'ALTO',
        mensagem,
        status: 'ativo'
      }]);

    console.log(`⚠️ Alerta criado automaticamente para sensor ${sensor_id}`);
  } catch (error) {
    console.error('❌ Erro ao criar alerta automático:', error);
  }
}

module.exports = {
  criarMedicao,
  buscarMedicoesRecentes,
  buscarMedicoesPorPeriodo,
  buscarEstatisticas
};