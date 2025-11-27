const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'eroswatch_secret_key_123';

/**
 * Middleware para verificar token JWT
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Salva dados do usuário na requisição
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido ou expirado.' });
  }
}

/**
 * Middleware para verificar permissão de Admin
 */
function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }

  next();
}

module.exports = {
  authMiddleware,
  adminMiddleware
};
