/**
 * ROTAS: Alertas
 */

const express = require("express");
const router = express.Router();
const alertasController = require("../controllers/alertasController");
const { authMiddleware, adminMiddleware } = require("../middlewares/authMiddleware");

// ============================================
// PÚBLICO (Leitura Básica)
// ============================================

// GET /api/alertas/ativos - Alertas não resolvidos
router.get("/ativos", alertasController.buscarAlertasAtivos);

// GET /api/alertas/historico - Todos os alertas
router.get("/historico", alertasController.buscarHistoricoAlertas);

// Estatísticas de alertas
router.get("/estatisticas", alertasController.buscarEstatisticasAlertas);

// ============================================
// ADMIN (Gestão)
// ============================================

// POST /api/alertas - Criar alerta manualmente
router.post("/", authMiddleware, adminMiddleware, alertasController.criarAlerta);

// PUT /api/alertas/:id/resolver - Marcar como resolvido
router.put("/:id/resolver", authMiddleware, adminMiddleware, alertasController.resolverAlerta);

// PUT /api/alertas/:id/ignorar - Marcar como ignorado (falso positivo)
router.put("/:id/ignorar", authMiddleware, adminMiddleware, alertasController.ignorarAlerta);

// Resolver todos de um sensor
router.patch(
  "/sensor/:sensor_id/resolver-todos",
  authMiddleware,
  adminMiddleware,
  alertasController.resolverAlertasSensor
);

module.exports = router;
