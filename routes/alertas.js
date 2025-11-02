/**
 * ROTAS: Alertas
 */

const express = require('express');
const router = express.Router();
const {
  buscarAlertasAtivos,
  criarAlerta,
  resolverAlerta,
  buscarHistoricoAlertas
} = require('../controllers/alertasController');

// GET /api/alertas/ativos - Alertas não resolvidos
router.get('/ativos', buscarAlertasAtivos);

// GET /api/alertas/historico - Todos os alertas
router.get('/historico', buscarHistoricoAlertas);

// POST /api/alertas - Criar alerta manualmente
router.post('/', criarAlerta);

// PUT /api/alertas/:id/resolver - Marcar como resolvido
router.put('/:id/resolver', resolverAlerta);

module.exports = router;