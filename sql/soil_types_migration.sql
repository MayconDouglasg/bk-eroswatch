-- Tabela de Tipos de Solo
CREATE TABLE IF NOT EXISTS tipos_solo (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) UNIQUE NOT NULL,
    saturacao_critica DECIMAL(5,2) NOT NULL,
    saturacao_total DECIMAL(5,2) NOT NULL,
    angulo_atrito_critico DECIMAL(5,2) NOT NULL,
    coeficiente_coesao DECIMAL(5,2) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir valores padrão
INSERT INTO tipos_solo (nome, saturacao_critica, saturacao_total, angulo_atrito_critico, coeficiente_coesao) VALUES
('ARENOSO', 60.0, 85.0, 32.0, 0.1),
('ARGILOSO', 75.0, 95.0, 25.0, 0.8),
('SILTOSO', 65.0, 90.0, 28.0, 0.4),
('ORGANICO', 80.0, 98.0, 20.0, 0.6)
ON CONFLICT (nome) DO NOTHING;
