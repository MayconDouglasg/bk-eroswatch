/**
 * ROTAS: Sensores
 */

const express = require('express');
const router = express.Router();
const {
  listarSensores,
  buscarSensorPorId,
  criarSensor,
  atualizarSensor,
  deletarSensor,
  calibrarSensor
} = require('../controllers/sensoresController');

const { authMiddleware, adminMiddleware } = require('../middlewares/authMiddleware');

// GET /api/sensores - Listar todos (Público para o dashboard)
router.get('/', listarSensores);

// GET /api/sensores/:id - Buscar por ID (Público)
router.get('/:id', buscarSensorPorId);

// ============================================
// ROTAS PROTEGIDAS (ADMIN)
// ============================================

// POST /api/sensores - Cadastrar novo sensor
router.post('/', authMiddleware, adminMiddleware, criarSensor);

// PUT /api/sensores/:id - Atualizar sensor
router.put('/:id', authMiddleware, adminMiddleware, atualizarSensor);

// DELETE /api/sensores/:id - Remover sensor (Soft delete)
router.delete('/:id', authMiddleware, adminMiddleware, deletarSensor);

// POST /api/sensores/:id/calibrar - Calibrar sensor
router.post('/:id/calibrar', authMiddleware, adminMiddleware, calibrarSensor);

module.exports = router;