const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

// Segredo do JWT (Idealmente viria de variável de ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'eroswatch_secret_key_123';

/**
 * Login de usuário
 */
async function login(req, res) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário pelo email
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !usuario) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (!usuario.ativo) {
      return res.status(403).json({ error: 'Usuário inativo' });
    }

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar Token JWT
    const token = jwt.sign(
      { 
        id: usuario.id, 
        email: usuario.email, 
        role: usuario.role,
        nome: usuario.nome 
      },
      JWT_SECRET,
      { expiresIn: '8h' } // Token expira em 8 horas
    );

    // Atualizar último login
    await supabase
      .from('usuarios')
      .update({ ultimo_login: new Date() })
      .eq('id', usuario.id);

    // Registrar log de auditoria
    await supabase.from('logs_auditoria').insert([{
      usuario_id: usuario.id,
      acao: 'LOGIN',
      detalhes: { ip: req.ip },
      timestamp: new Date()
    }]);

    // Retornar dados (sem a senha)
    res.json({
      success: true,
      token,
      user: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

/**
 * Criar usuário (Apenas Admin)
 */
async function criarUsuario(req, res) {
  try {
    const { nome, email, senha, role } = req.body;

    // Verificar se quem está pedindo é admin (Middleware já deve ter garantido, mas reforçando)
    // ...

    // Hash da senha
    const salt = await bcrypt.genSalt(10);
    const senha_hash = await bcrypt.hash(senha, salt);

    const { data, error } = await supabase
      .from('usuarios')
      .insert([{ nome, email, senha_hash, role }])
      .select();

    if (error) throw error;

    res.status(201).json({ success: true, usuario: data[0] });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  login,
  criarUsuario
};
