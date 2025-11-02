/**
 * CONTROLLER: Alertas
 * Gerencia alertas críticos do sistema
 */

const supabase = require('../config/supabase');

// ============================================
// 1. BUSCAR ALERTAS ATIVOS
// ============================================
async function buscarAlertasAtivos(req, res) {
  try {
    const { data, error } = await supabase
      .from('alertas')
      .select(`
        *,
        sensores (identificador, regiao)
      `)
      .eq('status', 'ativo')
      .order('timestamp', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      quantidade: data.length,
      alertas: data
    });

  } catch (error) {
    console.error('❌ Erro ao buscar alertas ativos:', error);
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
      tipo_alerta,
      nivel_criticidade,
      mensagem
    } = req.body;

    if (!sensor_id || !tipo_alerta || !mensagem) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: sensor_id, tipo_alerta, mensagem' 
      });
    }

    const { data, error } = await supabase
      .from('alertas')
      .insert([{
        sensor_id,
        tipo_alerta,
        nivel_criticidade: nivel_criticidade || 'MEDIO',
        mensagem,
        status: 'ativo'
      }])
      .select();

    if (error) throw error;

    console.log(`⚠️ Alerta criado: ${tipo_alerta} - Sensor ${sensor_id}`);

    res.status(201).json({
      success: true,
      message: 'Alerta criado com sucesso',
      data: data[0]
    });

  } catch (error) {
    console.error('❌ Erro ao criar alerta:', error);
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
      .from('alertas')
      .update({
        status: 'resolvido',
        resolvido_em: new Date().toISOString(),
        resolvido_por,
        observacoes
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    console.log(`✅ Alerta ${id} resolvido`);

    res.json({
      success: true,
      message: 'Alerta resolvido',
      data: data[0]
    });

  } catch (error) {
    console.error('❌ Erro ao resolver alerta:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 4. BUSCAR HISTÓRICO DE ALERTAS
// ============================================
async function buscarHistoricoAlertas(req, res) {
  try {
    const limite = parseInt(req.query.limite) || 20;
    const sensor_id = req.query.sensor_id;

    let query = supabase
      .from('alertas')
      .select(`
        *,
        sensores (identificador, regiao)
      `)
      .order('timestamp', { ascending: false })
      .limit(limite);

    if (sensor_id) {
      query = query.eq('sensor_id', sensor_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      quantidade: data.length,
      alertas: data
    });

  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  buscarAlertasAtivos,
  criarAlerta,
  resolverAlerta,
  buscarHistoricoAlertas
};