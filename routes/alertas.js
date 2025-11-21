/**
 * ROTAS: Alertas
 */

const express = require("express");
const router = express.Router();
const alertasController = require("../controllers/alertasController");

// GET /api/alertas/ativos - Alertas não resolvidos
router.get("/ativos", alertasController.buscarAlertasAtivos);

// GET /api/alertas/historico - Todos os alertas
router.get("/historico", alertasController.buscarHistoricoAlertas);

// Estatísticas de alertas
router.get("/estatisticas", alertasController.buscarEstatisticasAlertas);

// POST /api/alertas - Criar alerta manualmente
router.post("/", alertasController.criarAlerta);

// PUT /api/alertas/:id/resolver - Marcar como resolvido
router.put("/:id/resolver", alertasController.resolverAlerta);

// Resolver todos de um sensor
router.patch(
  "/sensor/:sensor_id/resolver-todos",
  alertasController.resolverAlertasSensor
);

module.exports = router;
