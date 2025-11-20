/**
 * CONTROLLER: Taxa de Erosão
 * Calcula risco de erosão com base em múltiplos fatores
 */

/**
 * Calcular taxa de erosão (modelo RUSLE simplificado)
 * A = R * K * L * S * C * P
 * A = taxa de erosão (t/ha/ano)
 * R = agressividade da chuva
 * K = erodibilidade do solo
 * L = comprimento da encosta
 * S = declividade
 * C = cobertura do solo
 * P = práticas de conservação
 */
function calcularTaxaErosao(medicao, previsao) {
  try {
    // R - Fator de agressividade da chuva
    // Quanto mais chuva, maior o risco
    const chuva = previsao?.chuva_proximas_24h || 0;
    const R = Math.min(chuva / 10, 2); // Normalizar para max 2

    // K - Erodibilidade do solo (baseado em umidade)
    // Solo úmido é mais erodível
    const umidadeSolo = medicao?.umidade_solo || 50;
    const K = 1 + (umidadeSolo / 100) * 0.5; // Max 1.5

    // L - Comprimento da encosta (assume 100m padrão)
    const L = 1.0;

    // S - Declividade (fator mais importante)
    // Inclinação em graus
    const inclinacao = medicao?.inclinacao_graus || 0;
    // Converter graus para declividade (%)
    const declividade = Math.tan((inclinacao * Math.PI) / 180) * 100;
    // S = 0.065 + 0.045 * declividade + 0.0065 * declividade^2
    const S = 0.065 + 0.045 * declividade + 0.0065 * Math.pow(declividade, 2);

    // C - Fator de cobertura do solo
    // Sem informação, assumir solo exposto (C=1)
    const C = 1.0;

    // P - Práticas de conservação
    // Sem informação, assumir nenhuma prática (P=1)
    const P = 1.0;

    // Calcular taxa total
    const taxaErosao = R * K * L * S * C * P;

    // Classificação de risco
    let riscoErosao = "BAIXO";
    if (taxaErosao > 20) riscoErosao = "CRITICO";
    else if (taxaErosao > 10) riscoErosao = "ALTO";
    else if (taxaErosao > 5) riscoErosao = "MEDIO";

    return {
      taxa: parseFloat(taxaErosao.toFixed(2)),
      risco: riscoErosao,
      fatores: {
        R: parseFloat(R.toFixed(2)), // Chuva
        K: parseFloat(K.toFixed(2)), // Umidade
        L: L,
        S: parseFloat(S.toFixed(2)), // Inclinação
        C: C,
        P: P,
      },
      detalhes: {
        chuva_mm: chuva,
        umidade_solo: umidadeSolo,
        inclinacao_graus: inclinacao,
        declividade_percent: parseFloat(declividade.toFixed(2)),
      },
    };
  } catch (error) {
    console.error("❌ Erro ao calcular taxa de erosão:", error);
    return null;
  }
}

/**
 * Adicionar taxa de erosão aos dados da medição
 */
async function enriquecerMedicaoComErosao(medicao, previsao) {
  const erosao = calcularTaxaErosao(medicao, previsao);
  return {
    ...medicao,
    erosao,
  };
}

module.exports = {
  calcularTaxaErosao,
  enriquecerMedicaoComErosao,
};
