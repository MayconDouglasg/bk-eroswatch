/**
 * TELEGRAM BOT - SISTEMA EROWATCH
 * Versão com orientações de COMBATE à erosão
 */

require("dotenv").config();
const axios = require("axios");

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

console.log("🔍 [TELEGRAM INIT]");
console.log("   Token presente?", !!TELEGRAM_TOKEN);
console.log("   Chat ID:", CHAT_ID, "| Tipo:", typeof CHAT_ID);

/**
 * Enviar mensagem para o Telegram
 */
async function enviarMensagem(mensagem) {
  try {
    if (!TELEGRAM_TOKEN || !CHAT_ID) {
      console.error("❌ Telegram não configurado (.env)");
      console.error("   TELEGRAM_TOKEN:", !!TELEGRAM_TOKEN);
      console.error("   TELEGRAM_CHAT_ID:", !!CHAT_ID);
      return false;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

    // ✅ CONVERTER CHAT_ID PARA INTEIRO (suporta grupos negativos)
    const chatIdFormatado = parseInt(String(CHAT_ID));

    console.log("📤 [TELEGRAM] Preparando envio...");
    console.log("   URL:", url);
    console.log("   Chat ID formatado:", chatIdFormatado);
    console.log("   Tamanho da mensagem:", mensagem.length);

    const payload = {
      chat_id: chatIdFormatado, // ✅ AGORA É INTEIRO
      text: mensagem,
      parse_mode: "HTML", // ✅ MUDADO PARA HTML
    };

    const response = await axios.post(url, payload, {
      timeout: 15000,
    });

    if (response.data.ok) {
      console.log("✅ [TELEGRAM] Mensagem enviada com sucesso!");
      console.log("   Message ID:", response.data.result.message_id);
      return true;
    } else {
      console.error("❌ [TELEGRAM] Erro na resposta:", response.data);
      return false;
    }
  } catch (error) {
    console.error("\n❌ [TELEGRAM] Erro ao enviar:");
    console.error("   Mensagem:", error.message);

    if (error.response) {
      console.error("   Status HTTP:", error.response.status);
      console.error(
        "   Dados da resposta:",
        JSON.stringify(error.response.data, null, 2)
      );
    } else if (error.request) {
      console.error("   Requisição feita mas sem resposta");
    }

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
function formatarAlertaCompleto(
  medicao,
  sensor,
  previsaoClima = null,
  erosao = null
) {
  const nivel = medicao.nivel_risco;
  const config = ACOES_POR_RISCO[nivel];

  if (!config) {
    return formatarAlertaSimples(medicao, sensor);
  }

  // ✅ USAR HTML AO INVÉS DE MARKDOWN
  let mensagem = `
${config.emoji} <b>ALERTA ${config.cor} - EROWATCH</b> ${config.emoji}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📍 LOCALIZAÇÃO</b>
${sensor.regiao}
Sensor: <code>${sensor.identificador}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📊 SITUAÇÃO ATUAL DO SOLO</b>
💧 Umidade: <b>${medicao.umidade_solo.toFixed(1)}%</b> ${
    medicao.umidade_solo > 70 ? "⚠️ SATURADO" : ""
  }
🌡️ Temperatura: <code>${medicao.temperatura_solo.toFixed(1)}°C</code>
📐 Inclinação: <b>${medicao.inclinacao_graus.toFixed(1)}°</b>
${medicao.alerta_chuva ? "🌧️ <b>ALERTA DE CHUVA ATIVA</b>" : ""}
`;

  // Adicionar dados de erosão se disponível
  if (erosao) {
    mensagem += `
<b>📈 ANÁLISE DE EROSÃO</b>
Taxa: <b>${erosao.taxa} t/ha/ano</b>
Classificação: <b>${erosao.risco}</b>
    `;
  }

  // Adicionar previsão climática se disponível
  if (previsaoClima) {
    mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🌦️ PREVISÃO CLIMÁTICA (24h)</b>
${previsaoClima.descricao}
🌧️ Chuva prevista: <b>${previsaoClima.chuva_proximas_24h.toFixed(1)}mm</b>
💨 Vento: <code>${previsaoClima.vento.toFixed(1)} km/h</code>
${previsaoClima.risco_chuva_intensa ? "\n⚠️ <b>RISCO DE CHUVA INTENSA</b>" : ""}
    `;
  }

  mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ <b>NÍVEL DE RISCO: ${nivel}</b>
`;

  // Ações IMEDIATAS
  if (config.imediatas.length > 0) {
    mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🚨 AÇÕES IMEDIATAS (AGORA)</b>
`;
    config.imediatas.forEach((acao, index) => {
      mensagem += `${index + 1}. ${acao}\n`;
    });
  }

  // Ações PREVENTIVAS
  if (nivel !== "BAIXO" && config.preventivas.length > 0) {
    mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🛡️ PREVENÇÃO (Próximos dias)</b>
`;
    config.preventivas.forEach((acao, index) => {
      mensagem += `${index + 1}. ${acao}\n`;
    });
  }

  // Plano de RECUPERAÇÃO
  if (config.recuperacao.length > 0) {
    mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🌱 RECUPERAÇÃO DO SOLO</b>
`;
    config.recuperacao.forEach((acao, index) => {
      mensagem += `${index + 1}. ${acao}\n`;
    });
  }

  // Contatos de Emergência
  mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📞 CONTATOS DE APOIO</b>
`;
  config.contatos.forEach((contato) => {
    mensagem += `${contato}\n`;
  });

  // Rodapé
  mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🕐 ${new Date(medicao.timestamp).toLocaleString("pt-BR")}

<i>Sistema EroWatch - Combate à Erosão</i>
<i>ODS 15: Vida Terrestre</i>
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
${nivelEmoji} <b>ALERTA EROWATCH</b> ${nivelEmoji}

📍 <b>Local:</b> ${sensor.regiao}
🏷️ <b>Sensor:</b> ${sensor.identificador}

<b>📊 DADOS ATUAIS:</b>
💧 Umidade Solo: <b>${medicao.umidade_solo.toFixed(1)}%</b>
🌡️ Temperatura: <b>${medicao.temperatura_solo.toFixed(1)}°C</b>
📐 Inclinação: <b>${medicao.inclinacao_graus.toFixed(1)}°</b>

⚠️ <b>RISCO: ${medicao.nivel_risco}</b>

🕐 ${new Date(medicao.timestamp).toLocaleString("pt-BR")}
  `.trim();
}

/**
 * Enviar relatório diário (manhã e noite)
 */
function formatarRelatorioRotina(medicoes, sensores) {
  let mensagem = `
☀️ <b>RELATÓRIO DIÁRIO EROWATCH</b> ☀️

${new Date().toLocaleDateString("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
})}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📊 RESUMO GERAL</b>
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
    mensagem += `\n🚨 <b>CRÍTICO:</b> ${porRisco.CRITICO.join(", ")}`;
  }
  if (porRisco.ALTO.length > 0) {
    mensagem += `\n🔴 <b>ALTO:</b> ${porRisco.ALTO.join(", ")}`;
  }
  if (porRisco.MEDIO.length > 0) {
    mensagem += `\n🟡 <b>MÉDIO:</b> ${porRisco.MEDIO.join(", ")}`;
  }
  if (porRisco.BAIXO.length > 0) {
    mensagem += `\n🟢 <b>BAIXO:</b> ${porRisco.BAIXO.join(", ")}`;
  }

  mensagem += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 <b>DICA DO DIA</b>
${getDicaDoDia()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 <b>Agenda Comunitária</b>
• Oficina de Contenção: Sáb 15/11, 9h
• Distribuição de Mudas: Qui 20/11, 14h
• Mutirão de Limpeza: Dom 25/11, 8h

<i>Mantenha-se informado pelo grupo!</i>
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
