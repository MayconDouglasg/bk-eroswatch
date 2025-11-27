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

// ============================================
// 5. DELETAR SENSOR (SOFT DELETE)
// ============================================
async function deletarSensor(req, res) {
  try {
    const { id } = req.params;

    // Soft delete: apenas marca como inativo
    const { data, error } = await supabase
      .from('sensores')
      .update({ status: 'inativo' })
      .eq('id', id)
      .select();

    if (error) throw error;

    console.log(`🗑️ Sensor ${id} marcado como inativo`);

    res.json({
      success: true,
      message: 'Sensor removido com sucesso (inativo)',
      sensor: data[0]
    });

  } catch (error) {
    console.error('❌ Erro ao deletar sensor:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// 6. CALIBRAR SENSOR
// ============================================
async function calibrarSensor(req, res) {
  try {
    const { id } = req.params;
    const {
      tipo_solo,
      saturacao_critica,
      saturacao_total,
      angulo_atrito_critico,
      coeficiente_coesao,
      motivo,
      realizado_por
    } = req.body;

    // 1. Buscar valores atuais para histórico
    const { data: sensorAtual } = await supabase
      .from('sensores')
      .select('*')
      .eq('id', id)
      .single();

    if (!sensorAtual) {
      return res.status(404).json({ error: 'Sensor não encontrado' });
    }

    // 2. Atualizar Sensor
    const updates = {
      tipo_solo,
      saturacao_critica,
      saturacao_total,
      angulo_atrito_critico,
      coeficiente_coesao,
      ultima_manutencao: new Date()
    };

    const { data: sensorNovo, error: updateError } = await supabase
      .from('sensores')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Registrar no Histórico de Calibrações
    await supabase.from('calibracoes').insert([{
      sensor_id: id,
      tipo_solo,
      saturacao_critica_anterior: sensorAtual.saturacao_critica,
      saturacao_critica_nova: saturacao_critica,
      saturacao_total_anterior: sensorAtual.saturacao_total,
      saturacao_total_nova: saturacao_total,
      angulo_atrito_anterior: sensorAtual.angulo_atrito_critico,
      angulo_atrito_nova: angulo_atrito_critico,
      coeficiente_coesao_anterior: sensorAtual.coeficiente_coesao,
      coeficiente_coesao_nova: coeficiente_coesao,
      motivo,
      realizado_por
    }]);

    console.log(`🔧 Sensor ${id} calibrado por ${realizado_por}`);

    res.json({
      success: true,
      message: 'Calibração realizada com sucesso',
      sensor: sensorNovo
    });

  } catch (error) {
    console.error('❌ Erro na calibração:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  listarSensores,
  buscarSensorPorId,
  criarSensor,
  atualizarSensor,
  deletarSensor,
  calibrarSensor
};