/**
 * ROTAS: Clima
 * Integração com OpenWeather
 */

const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { buscarPrevisao } = require("../config/openweather");

/**
 * GET /api/clima/sensor/:sensorId
 * Retorna previsão do tempo para um sensor
 */
router.get("/sensor/:sensorId", async (req, res) => {
  try {
    const { sensorId } = req.params;

    // Buscar localização do sensor
    const { data: sensor, error } = await supabase
      .from("sensores")
      .select("latitude, longitude, identificador, regiao")
      .eq("id", sensorId)
      .single();

    if (error || !sensor) {
      return res.status(404).json({
        success: false,
        error: "Sensor não encontrado",
      });
    }

    // Buscar previsão do OpenWeather
    const previsao = await buscarPrevisao(sensor.latitude, sensor.longitude);

    if (!previsao) {
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar previsão",
      });
    }

    res.json({
      success: true,
      sensor: {
        id: sensorId,
        identificador: sensor.identificador,
        regiao: sensor.regiao,
      },
      previsao,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar clima:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clima/historico/:sensorId
 * Retorna histórico de previsões (últimos 7 dias)
 */
router.get("/historico/:sensorId", async (req, res) => {
  try {
    const { sensorId } = req.params;

    const { data, error } = await supabase
      .from("previsoes_clima")
      .select("*")
      .eq("sensor_id", sensorId)
      .gte(
        "timestamp",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      )
      .order("timestamp", { ascending: false })
      .limit(168); // 7 dias * 24 horas

    if (error) throw error;

    res.json({
      success: true,
      previsoes: data,
    });
  } catch (error) {
    console.error("❌ Erro ao buscar histórico:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
