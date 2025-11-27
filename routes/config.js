/**
 * ROTAS: Configurações
 */

const express = require('express');
const router = express.Router();
const {
  listarTiposSolo,
  criarTipoSolo,
  atualizarTipoSolo,
  deletarTipoSolo
} = require('../controllers/configController');

const { authMiddleware, adminMiddleware } = require('../middlewares/authMiddleware');

// ============================================
// TIPOS DE SOLO
// ============================================

// GET /api/config/solos - Listar (Público ou Autenticado)
router.get('/solos', listarTiposSolo);

// POST /api/config/solos - Criar (Admin)
router.post('/solos', authMiddleware, adminMiddleware, criarTipoSolo);

// PUT /api/config/solos/:id - Atualizar (Admin)
router.put('/solos/:id', authMiddleware, adminMiddleware, atualizarTipoSolo);

// DELETE /api/config/solos/:id - Deletar (Admin)
router.delete('/solos/:id', authMiddleware, adminMiddleware, deletarTipoSolo);

module.exports = router;
