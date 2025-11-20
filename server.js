/**
 * ====================================================
 * SERVIDOR BACKEND - SISTEMA EROSÃO (EroWatch)
 * ====================================================
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Importar rotas
const sensoresRoutes = require("./routes/sensores");
const medicoesRoutes = require("./routes/medicoes");
const climaRoutes = require("./routes/clima");
const alertasRoutes = require("./routes/alertas"); // ← ADICIONE AQUI

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// REGISTRAR ROTAS PRINCIPAIS
// ============================================
app.use("/api/sensores", sensoresRoutes);
app.use("/api/medicoes", medicoesRoutes);
app.use("/api/clima", climaRoutes);
app.use("/api/alertas", alertasRoutes); // ← ADICIONE AQUI

// ============================================
// ROTA 404 (DEVE SER A ÚLTIMA)
// ============================================
app.use((req, res) => {
  res.status(404).json({
    error: "Rota não encontrada",
    message: `A rota ${req.path} não existe nesta API`,
    metodo: req.method,
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 SERVIDOR EROWATCH INICIADO       ║
║   Porta: ${PORT}                         
║   Ambiente: ${process.env.NODE_ENV || "development"}
╚════════════════════════════════════════╝
  `);
});

module.exports = app;
