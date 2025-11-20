/**
 * ====================================================
 * SERVIDOR BACKEND - SISTEMA EROSÃO (EroWatch)
 * ====================================================
 * API REST para gerenciar dados de sensores IoT
 * Banco de dados: PostgreSQL (Supabase)
 * ====================================================
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Importar rotas
const sensoresRoutes = require("./routes/sensores");
const medicoesRoutes = require("./routes/medicoes");
const alertasRoutes = require("./routes/alertas");
const climaRoutes = require("./routes/clima");

// Criar aplicação Express
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARES
// ============================================

// CORS: Permitir frontend acessar (IMPORTANTE!)
app.use(
  cors({
    origin: "*", // Em produção, trocar por URL específica
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use("/api/clima", climaRoutes);

// Parser JSON
app.use(express.json());

// Logger simples
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ============================================
// ROTAS
// ============================================

// Rota raiz (health check)
app.get("/", (req, res) => {
  res.json({
    message: "🌱 API EroWatch - Sistema de Monitoramento de Erosão",
    version: "1.0.0",
    status: "online",
    endpoints: {
      sensores: "/api/sensores",
      medicoes: "/api/medicoes",
      alertas: "/api/alertas",
    },
  });
});

// Rotas da API
app.use("/api/sensores", sensoresRoutes);
app.use("/api/medicoes", medicoesRoutes);
app.use("/api/alertas", alertasRoutes);

// Rota 404
app.use((req, res) => {
  res.status(404).json({
    error: "Rota não encontrada",
    message: `A rota ${req.url} não existe nesta API`,
  });
});

// ============================================
// TRATAMENTO DE ERROS GLOBAL
// ============================================
app.use((err, req, res, next) => {
  console.error("❌ Erro não tratado:", err);
  res.status(500).json({
    error: "Erro interno do servidor",
    message: err.message,
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║   🌱 SERVIDOR EROWATCH INICIADO 🌱    ║");
  console.log("╚════════════════════════════════════════╝");
  console.log(`\n🚀 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`📡 Ambiente: ${process.env.NODE_ENV || "development"}`);
  console.log("\n📋 Endpoints disponíveis:");
  console.log(`   ├─ GET  http://localhost:${PORT}/api/sensores`);
  console.log(`   ├─ POST http://localhost:${PORT}/api/medicoes`);
  console.log(`   ├─ GET  http://localhost:${PORT}/api/medicoes/recentes`);
  console.log(`   ├─ GET  http://localhost:${PORT}/api/medicoes/estatisticas`);
  console.log(`   ├─ GET  http://localhost:${PORT}/api/alertas/ativos`);
  console.log(`   └─ POST http://localhost:${PORT}/api/alertas`);
  console.log("\n✅ Aguardando requisições...\n");
});

// Tratamento de erros não capturados
process.on("unhandledRejection", (err) => {
  console.error("❌ Erro não tratado (Promise):", err);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Exceção não capturada:", err);
  process.exit(1);
});
