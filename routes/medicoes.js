/**
 * ROTAS: Medições
 */

const express = require("express");
const router = express.Router();
const medicoesController = require("../controllers/medicoesController");

// POST /api/medicoes - ESP32 envia dados
router.post("/", medicoesController.criarMedicao);

// GET /api/medicoes/recentes - Frontend busca últimas medições
router.get("/recentes", medicoesController.buscarMedicoesRecentes);

// GET /api/medicoes/periodo - Buscar por período específico
router.get("/periodo", medicoesController.buscarMedicoesPorPeriodo);

// GET /api/medicoes/estatisticas - Dashboard estatísticas
router.get("/estatisticas", medicoesController.buscarEstatisticas);

// Rotas por sensor
router.get("/sensor/:id/ultima", medicoesController.obterUltimaMedicao);
router.get("/sensor/:id/historico", medicoesController.obterHistoricoMedicoes);

module.exports = router;
