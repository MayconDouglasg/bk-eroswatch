const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, adminMiddleware } = require('../middlewares/authMiddleware');

// Rota de Login (Pública)
router.post('/login', authController.login);

// Rota de criação de usuário (Apenas Admin)
router.post('/usuarios', authMiddleware, adminMiddleware, authController.criarUsuario);

// Rota de verificação de token (Para o frontend saber se está logado)
router.get('/me', authMiddleware, (req, res) => {
    res.json({ 
        success: true, 
        user: req.user 
    });
});

module.exports = router;
