-- ============================================
-- MIGRAÇÃO: SISTEMA ADMINISTRATIVO
-- Descrição: Tabelas para Autenticação, Configuração e Auditoria
-- ============================================

-- 1. TABELA DE USUÁRIOS
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('operador', 'admin', 'super_admin')),
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT NOW(),
    ultimo_login TIMESTAMP
);

COMMENT ON TABLE usuarios IS 'Usuários do sistema administrativo';

-- Inserir usuário admin inicial (Senha padrão: admin123)
-- O hash abaixo é para 'admin123' gerado com bcrypt
INSERT INTO usuarios (nome, email, senha_hash, role)
VALUES (
    'Administrador', 
    'admin@eroswatch.com', 
    '$2a$10$X7V.j.X7V.j.X7V.j.X7V.j.X7V.j.X7V.j.X7V.j.X7V.j.X7V.j', -- Placeholder, será substituído na implementação real ou o usuário deve gerar
    'super_admin'
);

-- 2. TABELA DE CONFIGURAÇÕES GLOBAIS
CREATE TABLE configuracoes (
    id SERIAL PRIMARY KEY,
    chave VARCHAR(50) UNIQUE NOT NULL,
    valor JSONB NOT NULL,
    descricao TEXT,
    atualizado_em TIMESTAMP DEFAULT NOW(),
    atualizado_por INTEGER REFERENCES usuarios(id)
);

COMMENT ON TABLE configuracoes IS 'Configurações dinâmicas do sistema (pesos de risco, tokens, etc)';

-- Inserir configuração padrão do algoritmo de risco
INSERT INTO configuracoes (chave, valor, descricao)
VALUES (
    'algoritmo_risco',
    '{
        "pesos": {
            "saturacao": 0.35,
            "inclinacao": 0.35,
            "interacao": 0.20,
            "chuva": 0.10
        },
        "limiares": {
            "baixo": 30,
            "medio": 55,
            "alto": 75
        }
    }',
    'Pesos e limiares para o cálculo do Índice de Risco'
);

-- 3. TABELA DE LOGS DE AUDITORIA
CREATE TABLE logs_auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    acao VARCHAR(50) NOT NULL, -- ex: 'LOGIN', 'CRIAR_SENSOR', 'RESOLVER_ALERTA'
    entidade_tipo VARCHAR(50), -- ex: 'sensor', 'alerta'
    entidade_id INTEGER,
    detalhes JSONB,
    ip_origem VARCHAR(45),
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_usuario ON logs_auditoria(usuario_id);
CREATE INDEX idx_logs_timestamp ON logs_auditoria(timestamp DESC);

COMMENT ON TABLE logs_auditoria IS 'Registro de todas as ações administrativas para segurança';
