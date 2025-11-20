const express = require("express");
const router = express.Router();
const { buscarPrevisao } = require("../config/openweather");
const supabase = require("../config/supabase");

// GET /api/clima/sensor/:id - Previsão para um sensor
router.get("/sensor/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar coordenadas do sensor
    const { data: sensor } = await supabase
      .from("sensores")
      .select("latitude, longitude, regiao")
      .eq("id", id)
      .single();

    if (!sensor) {
      return res.status(404).json({ error: "Sensor não encontrado" });
    }

    // Buscar previsão
    const previsao = await buscarPrevisao(sensor.latitude, sensor.longitude);

    if (!previsao) {
      return res.status(500).json({ error: "Erro ao buscar previsão" });
    }

    res.json({
      success: true,
      sensor: sensor.regiao,
      previsao,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clima/historico/:sensor_id - Histórico de previsões
router.get("/historico/:sensor_id", async (req, res) => {
  try {
    const { sensor_id } = req.params;

    const { data, error } = await supabase
      .from("previsoes_clima")
      .select("*")
      .eq("sensor_id", sensor_id)
      .order("timestamp", { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({
      success: true,
      quantidade: data.length,
      previsoes: data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
