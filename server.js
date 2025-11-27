/**
 * SERVER.JS
 * Ponto de entrada do Backend EroWatch
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Importar Rotas
const sensoresRoutes = require('./routes/sensores');
const medicoesRoutes = require('./routes/medicoes');
const climaRoutes = require('./routes/clima');
const alertasRoutes = require('./routes/alertas');
const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');

// Rotas
app.use('/api/sensores', sensoresRoutes);
app.use('/api/medicoes', medicoesRoutes);
app.use('/api/clima', climaRoutes);
app.use('/api/alertas', alertasRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);

// Rota de teste
app.get('/', (req, res) => {
  res.send('API EroWatch v1.0 Online 🚀');
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║   🚀 SERVIDOR EROWATCH INICIADO       ║`);
  console.log(`║   Porta: ${PORT}`);
  console.log(`║   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`╚════════════════════════════════════════╝\n`);
});
