/**
 * TELEGRAM BOT - SISTEMA EROWATCH
 * Versão com orientações de COMBATE à erosão
 */

require("dotenv").config();
const axios = require("axios");

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Enviar mensagem para o Telegram
 */
async function enviarMensagem(mensagem) {
  if (!TELEGRAM_TOKEN || !CHAT_ID) {
    console.error("❌ Telegram não configurado (.env)");
    return false;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

  try {
    const response = await axios.post(url, {
      chat_id: CHAT_ID,
      text: mensagem,
      parse_mode: "Markdown",
    });

    console.log("✅ Mensagem enviada ao Telegram");
    return true;
  } catch (error) {
    console.error("❌ Erro ao enviar Telegram:", error.message);
    return false;
  }
}

/**
 * Banco de Ações por Nível de Risco
 */
const ACOES_POR_RISCO = {
  CRITICO: {
    emoji: "🚨",
    cor: "VERMELHO",
    imediatas: [
      "EVACUAR imediatamente famílias em área de risco",
      "NÃO circular pela encosta sob NENHUMA hipótese",
      "Acionar Defesa Civil URGENTE: 199",
      "Acionar Bombeiros: 193",
      "Interditar vias de acesso à área",
      "Preparar abrigo emergencial na Escola Municipal",
    ],
    preventivas: [
      "Instalar lonas de contenção IMEDIATAMENTE",
      "Desviar água acumulada com valas emergenciais",
      "Marcar casas em risco com fita de isolamento",
      "Organizar escala de vigilância 24h",
    ],
    recuperacao: [
      "Aguardar estabilização do solo",
      "Solicitar laudo técnico de engenheiro",
      "Planejar obras de contenção definitivas",
      "Cadastrar famílias para realocação",
    ],
    contatos: [
      "🚨 Defesa Civil: 199",
      "🚨 Bombeiros: 193",
      "🚨 Coordenador Local: (88) 9xxxx-xxxx",
      "🚨 Abrigo: Escola Mun. João Silva",
    ],
  },

  ALTO: {
    emoji: "🔴",
    cor: "LARANJA",
    imediatas: [
      "Evitar circular pela área de risco",
      "Preparar mochila de emergência (documentos, água, lanterna)",
      "Identificar rota de fuga mais segura",
      "Avisar vizinhos idosos ou com dificuldade de locomoção",
      "Ligar para Defesa Civil: 199 (registrar ocorrência)",
      "Observar rachaduras novas em paredes/solo",
    ],
    preventivas: [
      "Cobrir solo exposto com lona ou palha",
      "Desobstruir calhas e canaletas de drenagem",
      "NÃO jogar água ou esgoto no terreno",
      "Retirar entulho e lixo que bloqueiam escoamento",
      "Evitar escavações ou cortes no terreno",
      "Instalar sacos de areia em pontos críticos",
    ],
    recuperacao: [
      "Plantar capim-vetiver ou grama em solo exposto",
      "Construir barreiras com pneus ou madeira",
      "Solicitar vistoria técnica gratuita",
      "Participar de oficina sobre contenção (próxima: Dia 15)",
    ],
    contatos: [
      "📞 Defesa Civil: 199",
      "📞 Agente Comunitário: (88) 9xxxx-xxxx",
      "📞 Prefeitura (Obras): (88) 3xxx-xxxx",
    ],
  },

  MEDIO: {
    emoji: "🟡",
    cor: "AMARELO",
    imediatas: [
      "Ficar atento a novos avisos do sistema",
      "Verificar se há água acumulada no terreno",
      "Observar se há rachaduras crescendo",
      "Preparar documentos importantes",
    ],
    preventivas: [
      "Plantar vegetação de contenção (mudas gratuitas na prefeitura)",
      "Fazer limpeza de canaletas e bueiros",
      "Cobrir áreas de solo exposto com folhas secas",
      "Evitar jogar água em declives",
      "Instalar canos de drenagem improvisados",
      "Participar de mutirão de plantio comunitário",
    ],
    recuperacao: [
      "Replantar áreas com erosão leve",
      "Construir barreiras de contenção com pedras",
      "Fazer curvas de nível em terrenos inclinados",
      "Solicitar orientação técnica gratuita",
    ],
    contatos: [
      "📱 WhatsApp da Comunidade: Link",
      "📱 Agente Comunitário: (88) 9xxxx-xxxx",
    ],
  },

  BAIXO: {
    emoji: "🟢",
    cor: "VERDE",
    imediatas: ["Situação estável, sem ações urgentes necessárias"],
    preventivas: [
      "Manter limpeza de canaletas e calhas",
      "Continuar plantio de vegetação de contenção",
      "Observar periodicamente o terreno",
      "Participar de oficinas de prevenção",
    ],
    recuperacao: [
      "Aproveitar período seco para obras de contenção",
      "Fortalecer áreas que já apresentaram problemas",
      "Plantar mais mudas nativas",
    ],
    contatos: [
      "✅ Sistema monitorando normalmente",
      "📱 Dúvidas: (88) 9xxxx-xxxx",
    ],
  },
};

/**
 * Formatar alerta COMPLETO com plano de ação
 */
function formatarAlertaCompleto(medicao, sensor, previsaoClima = null) {
  const nivel = medicao.nivel_risco;
  const config = ACOES_POR_RISCO[nivel];

  if (!config) {
    return formatarAlertaSimples(medicao, sensor); // Fallback
  }

  // Header com emoji e severidade
  let mensagem = `
${config.emoji} *ALERTA ${config.cor} - EROWATCH* ${config.emoji}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 *LOCALIZAÇÃO*
${sensor.regiao}
Sensor: ${sensor.identificador}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *SITUAÇÃO ATUAL DO SOLO*
💧 Umidade: *${medicao.umidade_solo.toFixed(1)}%* ${
    medicao.umidade_solo > 70 ? "⚠️ SATURADO" : ""
  }
🌡️ Temperatura: ${medicao.temperatura_solo.toFixed(1)}°C
📐 Inclinação: *${medicao.inclinacao_graus.toFixed(1)}°*
${medicao.alerta_chuva ? "🌧️ *ALERTA DE CHUVA ATIVA*" : ""}
`;

  // Adicionar previsão climática se disponível
  if (previsaoClima) {
    mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌦️ *PREVISÃO CLIMÁTICA (24h)*
${previsaoClima.descricao}
🌧️ Chuva prevista: *${previsaoClima.chuva_proximas_24h.toFixed(1)}mm*
💨 Vento: ${previsaoClima.vento.toFixed(1)} km/h
${previsaoClima.risco_chuva_intensa ? "\n⚠️ *RISCO DE CHUVA INTENSA*" : ""}
`;
  }

  mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ *NÍVEL DE RISCO: ${nivel}*
`;

  // Ações IMEDIATAS (sempre mostrar)
  if (config.imediatas.length > 0) {
    mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 *AÇÕES IMEDIATAS (AGORA)*
`;
    config.imediatas.forEach((acao, index) => {
      mensagem += `${index + 1}. ${acao}\n`;
    });
  }

  // Ações PREVENTIVAS (se não for BAIXO)
  if (nivel !== "BAIXO" && config.preventivas.length > 0) {
    mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ *PREVENÇÃO (Próximos dias)*
`;
    config.preventivas.forEach((acao, index) => {
      mensagem += `${index + 1}. ${acao}\n`;
    });
  }

  // Plano de RECUPERAÇÃO (sempre mostrar)
  if (config.recuperacao.length > 0) {
    mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌱 *RECUPERAÇÃO DO SOLO*
`;
    config.recuperacao.forEach((acao, index) => {
      mensagem += `${index + 1}. ${acao}\n`;
    });
  }

  // Contatos de Emergência
  mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 *CONTATOS DE APOIO*
`;
  config.contatos.forEach((contato) => {
    mensagem += `${contato}\n`;
  });

  // Rodapé
  mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🕐 ${new Date(medicao.timestamp).toLocaleString("pt-BR")}

📚 *Cartilha Completa:* eroswatch.com.br/guia
🎥 *Tutoriais em Vídeo:* youtube.com/@eroswatch

_Sistema EroWatch - Combate à Erosão_
_ODS 15: Vida Terrestre_
  `.trim();

  return mensagem;
}

/**
 * Formatar alerta simples (fallback)
 */
function formatarAlertaSimples(medicao, sensor) {
  const emoji = {
    BAIXO: "🟢",
    MEDIO: "🟡",
    ALTO: "🔴",
    CRITICO: "🚨",
  };

  const nivelEmoji = emoji[medicao.nivel_risco] || "⚠️";

  return `
${nivelEmoji} *ALERTA EROWATCH* ${nivelEmoji}

📍 *Local:* ${sensor.regiao}
🏷️ *Sensor:* ${sensor.identificador}

📊 *DADOS ATUAIS:*
💧 Umidade Solo: *${medicao.umidade_solo.toFixed(1)}%*
🌡️ Temperatura: *${medicao.temperatura_solo.toFixed(1)}°C*
📐 Inclinação: *${medicao.inclinacao_graus.toFixed(1)}°*

⚠️ *RISCO: ${medicao.nivel_risco}*

🕐 ${new Date(medicao.timestamp).toLocaleString("pt-BR")}
  `.trim();
}

/**
 * Enviar relatório diário (manhã e noite)
 */
function formatarRelatorioRotina(medicoes, sensores) {
  let mensagem = `
☀️ *RELATÓRIO DIÁRIO EROWATCH* ☀️

${new Date().toLocaleDateString("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
})}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *RESUMO GERAL*
`;

  // Agrupar por nível de risco
  const porRisco = {
    CRITICO: [],
    ALTO: [],
    MEDIO: [],
    BAIXO: [],
  };

  medicoes.forEach((m) => {
    const sensor = sensores.find((s) => s.id === m.sensor_id);
    if (sensor) {
      porRisco[m.nivel_risco].push(sensor.regiao);
    }
  });

  // Mostrar áreas por risco
  if (porRisco.CRITICO.length > 0) {
    mensagem += `\n🚨 *CRÍTICO:* ${porRisco.CRITICO.join(", ")}`;
  }
  if (porRisco.ALTO.length > 0) {
    mensagem += `\n🔴 *ALTO:* ${porRisco.ALTO.join(", ")}`;
  }
  if (porRisco.MEDIO.length > 0) {
    mensagem += `\n🟡 *MÉDIO:* ${porRisco.MEDIO.join(", ")}`;
  }
  if (porRisco.BAIXO.length > 0) {
    mensagem += `\n🟢 *BAIXO:* ${porRisco.BAIXO.join(", ")}`;
  }

  mensagem += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *DICA DO DIA*
${getDicaDoDia()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 *Agenda Comunitária*
• Oficina de Contenção: Sáb 15/11, 9h
• Distribuição de Mudas: Qui 20/11, 14h
• Mutirão de Limpeza: Dom 25/11, 8h

_Mantenha-se informado pelo grupo!_
  `.trim();

  return mensagem;
}

/**
 * Dicas rotativas
 */
function getDicaDoDia() {
  const dicas = [
    "Plante capim-vetiver! Suas raízes profundas seguram até 50 toneladas de solo por hectare.",
    "Nunca jogue água em terreno inclinado. Isso acelera a erosão em até 10x.",
    "Rachaduras de 2cm ou mais são sinal de alerta. Comunique imediatamente!",
    "Limpeza de calhas previne 80% dos deslizamentos em áreas urbanas.",
    "Solo exposto perde 30x mais terra que solo com vegetação. Cubra sempre!",
    "Em caso de chuva forte, desligue aparelhos e tenha lanterna à mão.",
    "Mudas gratuitas disponíveis toda quinta na prefeitura. Aproveite!",
    "Observe seu terreno após chuvas. Mudanças podem indicar problemas.",
  ];

  const hoje = new Date().getDate();
  return dicas[hoje % dicas.length];
}

module.exports = {
  enviarMensagem,
  formatarAlertaCompleto,
  formatarAlertaSimples,
  formatarRelatorioRotina,
  ACOES_POR_RISCO,
};
