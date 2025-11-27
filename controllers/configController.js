/**
 * CONTROLLER: Configurações
 * Gerencia configurações globais e tipos de solo
 */

const supabase = require('../config/supabase');

// ============================================
// TIPOS DE SOLO
// ============================================

// Listar tipos de solo
async function listarTiposSolo(req, res) {
  try {
    const { data, error } = await supabase
      .from('tipos_solo')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      tipos_solo: data
    });
  } catch (error) {
    console.error('❌ Erro ao listar tipos de solo:', error);
    res.status(500).json({ error: error.message });
  }
}

// Criar novo tipo de solo
async function criarTipoSolo(req, res) {
  try {
    const { nome, saturacao_critica, saturacao_total, angulo_atrito_critico, coeficiente_coesao } = req.body;

    if (!nome || !saturacao_critica || !saturacao_total || !angulo_atrito_critico || !coeficiente_coesao) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    const { data, error } = await supabase
      .from('tipos_solo')
      .insert([{
        nome: nome.toUpperCase(),
        saturacao_critica,
        saturacao_total,
        angulo_atrito_critico,
        coeficiente_coesao
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Tipo de solo criado com sucesso',
      tipo_solo: data
    });
  } catch (error) {
    console.error('❌ Erro ao criar tipo de solo:', error);
    res.status(500).json({ error: error.message });
  }
}

// Atualizar tipo de solo
async function atualizarTipoSolo(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('tipos_solo')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Tipo de solo atualizado',
      tipo_solo: data
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar tipo de solo:', error);
    res.status(500).json({ error: error.message });
  }
}

// Deletar tipo de solo
async function deletarTipoSolo(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('tipos_solo')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Tipo de solo removido'
    });
  } catch (error) {
    console.error('❌ Erro ao deletar tipo de solo:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  listarTiposSolo,
  criarTipoSolo,
  atualizarTipoSolo,
  deletarTipoSolo
};
