import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "ERRO: GEMINI_API_KEY não foi encontrada no arquivo .env ou nas variáveis do servidor."
  );

  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

/* * Durante os testes, permite chamadas do frontend local, * Firebase Hosting, GitHub Pages e Render. */
app.use(
  cors({
    origin: true
  })
);

app.use(
  express.json({
    limit: "1mb"
  })
);

/* * Rota principal para verificar se o backend está online. */
app.get("/", (req, res) => {
  res.status(200).json({
    sucesso: true,
    status: "Backend do TennisPro funcionando"
  });
});

/* * Rota adicional de saúde do servidor. */
app.get("/health", (req, res) => {
  res.status(200).json({
    sucesso: true,
    status: "online",
    timestamp: new Date().toISOString()
  });
});

/* * Extrai o status do erro retornado pelo SDK. */
function obterStatusDoErro(error) {
  return Number(
    error?.status ||
      error?.statusCode ||
      error?.code ||
      0
  );
}

/* * Extrai o tempo sugerido pela API. * * Exemplo: * "Please retry in 16.500266233s." */
function obterSegundosParaTentarNovamente(error) {
  const mensagem = String(
    error?.message || ""
  );

  const resultado = mensagem.match(
    /retry in\s+([\d.]+)s/i
  );

  if (!resultado) {
    return null;
  }

  const segundos = Math.ceil(
    Number(resultado[1])
  );

  return Number.isFinite(segundos)
    ? segundos
    : null;
}

/* * Identifica erros de limite de requisições. */
function erroDeQuota(error) {
  const status = obterStatusDoErro(error);

  const mensagem = String(
    error?.message || ""
  ).toLowerCase();

  return (
    status === 429 ||
    mensagem.includes("quota") ||
    mensagem.includes("rate limit") ||
    mensagem.includes("too many requests") ||
    mensagem.includes("exceeded your current quota") ||
    mensagem.includes("generate_content_free_tier_requests")
  );
}

/* * Identifica indisponibilidade temporária do Gemini. */
function erroTemporario(error) {
  const status = obterStatusDoErro(error);

  const mensagem = String(
    error?.message || ""
  ).toLowerCase();

  return (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    mensagem.includes("service unavailable") ||
    mensagem.includes("high demand") ||
    mensagem.includes("temporarily unavailable") ||
    mensagem.includes("try again later") ||
    mensagem.includes("overloaded")
  );
}

/* * Consulta o Gemini. */
app.post("/api/gemini", async (req, res) => {
  const inicio = Date.now();

  try {
    const {
      pergunta,
      contexto,
      previousInteractionId
    } = req.body || {};

    if (!pergunta || !String(pergunta).trim()) {
      return res.status(400).json({
        sucesso: false,
        codigo: "PERGUNTA_VAZIA",
        error:
          "Digite uma pergunta antes de consultar o Gemini."
      });
    }

    const promptCompleto = ` Você é o assistente inteligente do TennisPro. Responda sempre em português do Brasil. Use os dados abaixo para responder perguntas sobre: - partidas; - carreira; - jogadores; - vitórias; - derrotas; - adversários; - torneios; - placares; - estatísticas; - aproveitamento; - histórico recente. Regras obrigatórias: 1. Não invente informações. 2. Use somente os dados recebidos. 3. Se a informação não estiver disponível, diga: "Essa informação não foi encontrada nos dados disponíveis." 4. Não revele UID, e-mail, telefone, shareToken ou dados internos. 5. Não altere o banco de dados. 6. Para calcular o aproveitamento, use: vitórias / (vitórias + derrotas) * 100. 7. Se houver partidas com resultado "não identificado", avise que o cálculo pode estar incompleto. 8. Responda de forma clara e objetiva. 9. Organize respostas grandes em tópicos. 10. Não diga que consultou o Firestore. 11. Em partidas de duplas: - jogador1 e jogador2 formam o Time 1; - jogador3 e jogador4 formam o Time 2. 12. Use sets1, sets2, games1 e games2 para interpretar os placares. DADOS DO TENNISPRO: ${JSON.stringify(contexto || {}, null, 2)} PERGUNTA DO USUÁRIO: ${String(pergunta).trim()} `;

    const parametros = {
      model: "gemini-3.5-flash",
      input: promptCompleto,

      generation_config: {
        thinking_level: "low"
      }
    };

    /* * O histórico somente será usado se o frontend * enviar um interaction ID. */
    if (
      previousInteractionId &&
      String(previousInteractionId).trim()
    ) {
      parametros.previous_interaction_id =
        previousInteractionId;
    }

    console.log(
      "Consultando Gemini. Tamanho do prompt:",
      promptCompleto.length,
      "caracteres."
    );

    const interaction =
      await ai.interactions.create(
        parametros
      );

    const tempoTotal =
      Date.now() - inicio;

    const resposta =
      interaction?.output_text || "";

    console.log(
      `Resposta do Gemini em ${tempoTotal} ms.`
    );

    if (!resposta.trim()) {
      return res.status(502).json({
        sucesso: false,
        codigo: "RESPOSTA_VAZIA",
        error:
          "O Gemini não retornou uma resposta válida.",
        tempoMs: tempoTotal
      });
    }

    return res.status(200).json({
      sucesso: true,
      resposta,
      interactionId:
        interaction?.id || null,
      status:
        interaction?.status || null,
      tempoMs: tempoTotal
    });
  } catch (error) {
    const tempoTotal =
      Date.now() - inicio;

    const status =
      obterStatusDoErro(error);

    const segundosRetry =
      obterSegundosParaTentarNovamente(error);

    console.error(
      `Erro ao consultar o Gemini após ${tempoTotal} ms:`,
      error
    );

    /* * Limite de consultas da API. */
    if (erroDeQuota(error)) {
      const mensagemQuota =
        segundosRetry !== null
          ? `Você atingiu o limite gratuito de consultas do Assistente Gemini. Aguarde aproximadamente ${segundosRetry} segundos e tente novamente.`
          : "Você atingiu o limite gratuito de consultas do Assistente Gemini. Aguarde alguns segundos e tente novamente.";

      return res.status(429).json({
        sucesso: false,
        codigo: "LIMITE_CONSULTAS",
        error: mensagemQuota,
        retryAfterSeconds:
          segundosRetry,
        tempoMs: tempoTotal
      });
    }

    /* * Instabilidade ou alta demanda do Gemini. */
    if (erroTemporario(error)) {
      return res.status(503).json({
        sucesso: false,
        codigo: "GEMINI_INDISPONIVEL",
        error:
          "O Assistente Gemini está temporariamente ocupado. Aguarde alguns instantes e tente novamente.",
        retryAfterSeconds:
          segundosRetry,
        tempoMs: tempoTotal
      });
    }

    /* * Modelo não disponível para a conta. */
    if (
      status === 404 ||
      String(error?.message || "")
        .toLowerCase()
        .includes("model")
    ) {
      return res.status(503).json({
        sucesso: false,
        codigo: "MODELO_INDISPONIVEL",
        error:
          "O modelo configurado não está disponível para esta API key. Verifique o modelo ou a disponibilidade da conta.",
        tempoMs: tempoTotal
      });
    }

    /* * API key inválida ou sem autorização. */
    if (
      status === 401 ||
      status === 403
    ) {
      return res.status(status).json({
        sucesso: false,
        codigo: "API_KEY_INVALIDA",
        error:
          "A chave da API do Gemini é inválida, expirou ou não possui autorização para usar este modelo.",
        tempoMs: tempoTotal
      });
    }

    /* * Erro genérico para o usuário. * O erro técnico completo continua apenas no log. */
    return res.status(500).json({
      sucesso: false,
      codigo: "ERRO_INTERNO",
      error:
        "Não foi possível consultar o Assistente Gemini no momento. Tente novamente mais tarde.",
      tempoMs: tempoTotal
    });
  }
});

/* * O endereço 0.0.0.0 permite que o Render, * Railway, Koyeb ou outro servidor externo * acesse a aplicação. */
app.listen(
  port,
  "0.0.0.0",
  () => {
    console.log(
      `Backend do TennisPro rodando na porta ${port}`
    );
  }
);
