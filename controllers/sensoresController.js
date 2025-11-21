/**
 * CONTROLLER: Sensores
 * Gerencia cadastro e informações dos sensores
 */

const supabase = require('../config/supabase');

// ============================================
// 1. LISTAR TODOS OS SENSORES
// ============================================
async function listarSensores(req, res) {
  try {
    const { data, error } = await supabase
      .from('sensores')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      quantidade: data.length,
      sensores: data
    });

  } catch (error) {
    console.error('❌ Erro ao listar sensores:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 2. BUSCAR SENSOR POR ID
// ============================================
async function buscarSensorPorId(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('sensores')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ 
        error: 'Sensor não encontrado' 
      });
    }

    res.json({
      success: true,
      sensor: data
    });

  } catch (error) {
    console.error('❌ Erro ao buscar sensor:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 3. CRIAR NOVO SENSOR
// ============================================
async function criarSensor(req, res) {
  try {
    const {
      identificador,
      tipo,
      regiao,
      latitude,
      longitude,
      responsavel,
      // Novos campos geológicos
      tipo_solo,
      saturacao_critica,
      saturacao_total,
      angulo_atrito_critico,
      coeficiente_coesao
    } = req.body;

    if (!identificador || !tipo || !regiao) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: identificador, tipo, regiao' 
      });
    }

    const { data, error } = await supabase
      .from('sensores')
      .insert([{
        identificador,
        tipo,
        regiao,
        latitude,
        longitude,
        responsavel,
        status: 'ativo',
        // Campos opcionais
        tipo_solo: tipo_solo || null,
        saturacao_critica: saturacao_critica || null,
        saturacao_total: saturacao_total || null,
        angulo_atrito_critico: angulo_atrito_critico || null,
        coeficiente_coesao: coeficiente_coesao || null
      }])
      .select();

    if (error) throw error;

    console.log(`✅ Sensor criado: ${identificador}`);

    res.status(201).json({
      success: true,
      message: 'Sensor cadastrado com sucesso',
      sensor: data[0]
    });

  } catch (error) {
    console.error('❌ Erro ao criar sensor:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 4. ATUALIZAR STATUS DO SENSOR
// ============================================
async function atualizarSensor(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('sensores')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;

    console.log(`✅ Sensor ${id} atualizado`);

    res.json({
      success: true,
      message: 'Sensor atualizado',
      sensor: data[0]
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar sensor:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  listarSensores,
  buscarSensorPorId,
  criarSensor,
  atualizarSensor
};