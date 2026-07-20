import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "ERRO: GEMINI_API_KEY não foi encontrada no arquivo .env"
  );

  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.use(cors());

app.use(
  express.json({
    limit: "1mb"
  })
);

app.get("/", (req, res) => {
  res.json({
    status: "Backend do TennisPro funcionando"
  });
});

app.post("/api/gemini", async (req, res) => {
  const inicio = Date.now();

  try {
    const {
      pergunta,
      contexto,
      previousInteractionId
    } = req.body;

    if (!pergunta || !String(pergunta).trim()) {
      return res.status(400).json({
        error: "A pergunta é obrigatória."
      });
    }

    const promptCompleto = ` Você é o assistente inteligente do TennisPro. Responda em português do Brasil. Use os dados abaixo para responder perguntas sobre: - partidas; - carreira; - jogadores; - vitórias; - derrotas; - adversários; - torneios; - placares; - estatísticas; - aproveitamento; - histórico recente. Regras: 1. Não invente informações. 2. Use somente os dados recebidos. 3. Se a informação não estiver disponível, diga: "Essa informação não foi encontrada nos dados disponíveis." 4. Não revele UID, e-mail, telefone, shareToken ou dados internos. 5. Não altere o banco de dados. 6. Para calcular aproveitamento, use: vitórias / (vitórias + derrotas) * 100. 7. Se houver partidas com resultado "não identificado", avise que o cálculo pode estar incompleto. 8. Responda de forma clara e objetiva. 9. Organize respostas grandes em tópicos. 10. Não diga que consultou o Firestore. 11. Considere que, em partidas de duplas: - jogador1 e jogador2 formam o Time 1; - jogador3 e jogador4 formam o Time 2. 12. Use os campos sets1, sets2, games1 e games2 para interpretar os placares. DADOS DO TENNISPRO: ${JSON.stringify(contexto || {}, null, 2)} PERGUNTA DO USUÁRIO: ${String(pergunta).trim()} `;

    const parametros = {
      model: "gemini-3.5-flash",
      input: promptCompleto,

      generation_config: {
        thinking_level: "low"
      }
    };

    /* * O histórico só é usado se o frontend enviar * um interaction ID válido. */
    if (previousInteractionId) {
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

    console.log(
      `Resposta do Gemini em ${tempoTotal} ms.`
    );

    return res.json({
      sucesso: true,
      resposta: interaction.output_text || "",
      interactionId: interaction.id || null,
      status: interaction.status || null,
      tempoMs: tempoTotal
    });
  } catch (error) {
    const tempoTotal =
      Date.now() - inicio;

    console.error(
      `Erro ao consultar o Gemini após ${tempoTotal} ms:`,
      error
    );

    return res.status(500).json({
      sucesso: false,
      error:
        error?.message ||
        "Erro interno ao consultar o Gemini.",
      tempoMs: tempoTotal
    });
  }
});

app.listen(port, () => {
  console.log(
    `Backend do TennisPro rodando em http://localhost:${port}`
  );
});
