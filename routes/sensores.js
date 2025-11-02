/**
 * ROTAS: Sensores
 */

const express = require('express');
const router = express.Router();
const {
  listarSensores,
  buscarSensorPorId,
  criarSensor,
  atualizarSensor
} = require('../controllers/sensoresController');

// GET /api/sensores - Listar todos
router.get('/', listarSensores);

// GET /api/sensores/:id - Buscar por ID
router.get('/:id', buscarSensorPorId);

// POST /api/sensores - Cadastrar novo sensor
router.post('/', criarSensor);

// PUT /api/sensores/:id - Atualizar sensor
router.put('/:id', atualizarSensor);

module.exports = router;