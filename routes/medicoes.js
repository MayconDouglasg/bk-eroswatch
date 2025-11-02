/**
 * ROTAS: Medições
 */

const express = require('express');
const router = express.Router();
const {
  criarMedicao,
  buscarMedicoesRecentes,
  buscarMedicoesPorPeriodo,
  buscarEstatisticas
} = require('../controllers/medicoesController');

// POST /api/medicoes - ESP32 envia dados
router.post('/', criarMedicao);

// GET /api/medicoes/recentes - Frontend busca últimas medições
router.get('/recentes', buscarMedicoesRecentes);

// GET /api/medicoes/periodo - Buscar por período específico
router.get('/periodo', buscarMedicoesPorPeriodo);

// GET /api/medicoes/estatisticas - Dashboard estatísticas
router.get('/estatisticas', buscarEstatisticas);

module.exports = router;