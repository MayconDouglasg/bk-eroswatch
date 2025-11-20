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
      parse_mode: "Markdown", // Permite formatação
    });

    console.log("✅ Mensagem enviada ao Telegram");
    return true;
  } catch (error) {
    console.error("❌ Erro ao enviar Telegram:", error.message);
    return false;
  }
}

/**
 * Formatar alerta para Telegram
 */
function formatarAlerta(medicao, sensor) {
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

📊 *SITUAÇÃO ATUAL:*
💧 Umidade Solo: *${medicao.umidade_solo.toFixed(1)}%*
🌡️ Temperatura: *${medicao.temperatura_solo.toFixed(1)}°C*
📐 Inclinação: *${medicao.inclinacao_graus.toFixed(1)}°*

⚠️ *NÍVEL DE RISCO: ${medicao.nivel_risco}*

${
  medicao.nivel_risco === "ALTO" || medicao.nivel_risco === "CRITICO"
    ? `
🚨 *AÇÃO NECESSÁRIA:*
- Evitar circulação pela área
- Preparar documentos importantes
- Ficar atento a novos avisos
- Em emergência: ligar 193 ou 199
`
    : ""
}

🕐 ${new Date(medicao.timestamp).toLocaleString("pt-BR")}
  `.trim();
}

module.exports = {
  enviarMensagem,
  formatarAlerta,
};
