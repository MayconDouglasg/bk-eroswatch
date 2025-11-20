/**
 * CONFIGURAÇÃO DO SUPABASE
 * Cliente PostgreSQL na nuvem
 */

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

// Validar variáveis de ambiente
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error("❌ ERRO: Credenciais do Supabase não encontradas!");
  console.error("Verifique se o arquivo .env existe e contém:");
  console.error("- SUPABASE_URL");
  console.error("- SUPABASE_KEY");
  process.exit(1);
}

// Criar cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Testar conexão
async function testarConexao() {
  try {
    const { data, error } = await supabase
      .from("sensores")
      .select("count")
      .limit(1);

    if (error) throw error;
    console.log("✅ Conexão com Supabase estabelecida!");
  } catch (error) {
    console.error("❌ Erro ao conectar com Supabase:", error.message);
  }
}

testarConexao();

module.exports = supabase;
