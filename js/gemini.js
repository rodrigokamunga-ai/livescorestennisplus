(() => {
    "use strict";
  
    const GEMINI_BACKEND_URL =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
        ? "http://localhost:3000/api/gemini"
        : "https://tennispro-backend.onrender.com/api/gemini";
  
    console.log(
      "Backend Gemini utilizado:",
      GEMINI_BACKEND_URL
    );
  
    let ultimaInteractionId = null;
    let requisicaoGeminiAtual = null;
  
    const USAR_HISTORICO_CONVERSA = false;
  
    document.addEventListener("DOMContentLoaded", () => {
      const geminiBtn =
        document.getElementById("geminiBtn");
  
      const geminiModal =
        document.getElementById("geminiModal");
  
      const closeGeminiBtn =
        document.getElementById("closeGeminiBtn");
  
      const cancelGeminiBtn =
        document.getElementById("cancelGeminiBtn");
  
      const clearGeminiBtn =
        document.getElementById("clearGeminiBtn");
  
      const geminiForm =
        document.getElementById("geminiForm");
  
      const geminiPrompt =
        document.getElementById("geminiPrompt");
  
      const geminiResponse =
        document.getElementById("geminiResponse");
  
      const geminiLoading =
        document.getElementById("geminiLoading");
  
      const geminiSubmitBtn =
        document.getElementById("geminiSubmitBtn");
  
      if (
        !geminiBtn ||
        !geminiModal ||
        !closeGeminiBtn ||
        !cancelGeminiBtn ||
        !clearGeminiBtn ||
        !geminiForm ||
        !geminiPrompt ||
        !geminiResponse ||
        !geminiLoading ||
        !geminiSubmitBtn
      ) {
        console.warn(
          "Elementos do Gemini não foram encontrados no menu.html."
        );
  
        return;
      }
  
      function abrirModal() {
        geminiModal.classList.add("show");
  
        geminiModal.setAttribute(
          "aria-hidden",
          "false"
        );
  
        geminiPrompt.disabled = false;
        geminiPrompt.focus();
      }
  
      function cancelarRequisicaoAtual() {
        if (requisicaoGeminiAtual) {
          requisicaoGeminiAtual.abort();
          requisicaoGeminiAtual = null;
        }
      }
  
      function aguardar(tempo) {
        return new Promise((resolve) => {
          setTimeout(resolve, tempo);
        });
      }
  
      function obterCardResposta() {
        return geminiResponse.closest(
          ".gemini-response-card"
        );
      }
  
      function esconderCardResposta() {
        const card = obterCardResposta();
  
        if (card) {
          card.style.display = "none";
        }
      }
  
      function mostrarCardResposta() {
        const card = obterCardResposta();
  
        if (card) {
          card.style.display = "block";
        }
      }
  
      function fecharModal() {
        cancelarRequisicaoAtual();
  
        ultimaInteractionId = null;
  
        geminiPrompt.value = "";
        geminiPrompt.disabled = false;
  
        geminiResponse.innerHTML = "";
        geminiResponse.classList.remove("error");
  
        esconderCardResposta();
  
        geminiLoading.hidden = true;
  
        geminiSubmitBtn.disabled = false;
        geminiSubmitBtn.textContent =
          "Perguntar ao Gemini";
  
        geminiModal.classList.remove("show");
  
        geminiModal.setAttribute(
          "aria-hidden",
          "true"
        );
      }
  
      function mostrarCarregando(estado) {
        geminiLoading.hidden = !estado;
  
        geminiPrompt.disabled = estado;
        geminiSubmitBtn.disabled = estado;
  
        geminiSubmitBtn.textContent = estado
          ? "Consultando..."
          : "Perguntar ao Gemini";
      }
  
      function escaparHTML(texto) {
        const div = document.createElement("div");
  
        div.textContent = texto;
  
        return div.innerHTML;
      }
  
      function formatarResposta(texto) {
        if (!texto) {
          return "";
        }
  
        let html = escaparHTML(texto);
  
        html = html.replace(
          /\*\*(.*?)\*\*/g,
          "<strong>$1</strong>"
        );
  
        html = html.replace(
          /^- (.*)$/gm,
          "• $1"
        );
  
        return html;
      }
  
      function mostrarResposta( texto, erro = false ) {
        if (!texto) {
          geminiResponse.innerHTML = "";
          geminiResponse.classList.remove("error");
  
          esconderCardResposta();
  
          return;
        }
  
        geminiResponse.innerHTML =
          formatarResposta(texto);
  
        geminiResponse.classList.toggle(
          "error",
          erro
        );
  
        mostrarCardResposta();
      }
  
      function limparConsulta() {
        cancelarRequisicaoAtual();
  
        ultimaInteractionId = null;
  
        geminiPrompt.value = "";
        geminiPrompt.disabled = false;
  
        geminiResponse.innerHTML = "";
        geminiResponse.classList.remove("error");
  
        esconderCardResposta();
  
        geminiLoading.hidden = true;
  
        geminiSubmitBtn.disabled = false;
        geminiSubmitBtn.textContent =
          "Perguntar ao Gemini";
  
        geminiPrompt.focus();
      }
  
      function obterUsuarioAtual() {
        try {
          if (
            typeof firebase !== "undefined" &&
            typeof firebase.auth === "function"
          ) {
            const usuarioFirebase =
              firebase.auth().currentUser;
  
            if (usuarioFirebase?.uid) {
              return {
                uid: usuarioFirebase.uid,
                email: usuarioFirebase.email || "",
                displayName:
                  usuarioFirebase.displayName || ""
              };
            }
          }
        } catch (error) {
          console.warn(
            "Erro ao obter usuário do Firebase:",
            error
          );
        }
  
        try {
          const usuarioBiometrico =
            localStorage.getItem(
              "lsts_biometric_current"
            );
  
          if (usuarioBiometrico) {
            const dados = JSON.parse(
              usuarioBiometrico
            );
  
            if (dados?.uid) {
              return {
                uid: dados.uid,
                email: dados.email || "",
                displayName:
                  dados.displayName || ""
              };
            }
          }
  
          const uidBiometrico =
            localStorage.getItem(
              "lsts_biometric_uid"
            );
  
          if (uidBiometrico) {
            return {
              uid: uidBiometrico,
              email: "",
              displayName: ""
            };
          }
        } catch (error) {
          console.warn(
            "Erro ao obter sessão biométrica:",
            error
          );
        }
  
        return null;
      }
  
      function obterBanco() {
        try {
          if (
            typeof firebase !== "undefined" &&
            typeof firebase.firestore === "function"
          ) {
            return firebase.firestore();
          }
  
          if (typeof __db !== "undefined" && __db) {
            return __db;
          }
        } catch (error) {
          console.error(
            "Erro ao obter Firestore:",
            error
          );
        }
  
        return null;
      }
  
      function normalizarTexto(valor) {
        return String(valor || "")
          .trim()
          .toLowerCase();
      }
  
      function converterData(valor) {
        if (!valor) {
          return "";
        }
  
        try {
          if (typeof valor.toDate === "function") {
            return valor.toDate().toISOString();
          }
  
          if (valor instanceof Date) {
            return valor.toISOString();
          }
        } catch (_) {
          // Continua como texto.
        }
  
        return String(valor);
      }
  
      function obterNomeUsuario(usuario, perfil) {
        return (
          perfil?.displayName ||
          perfil?.name ||
          perfil?.nome ||
          usuario?.displayName ||
          usuario?.email?.split("@")?.[0] ||
          "Jogador"
        );
      }
  
      function obterTimeDosJogadores(data, time) {
        if (time === 1) {
          return [
            data?.player1,
            data?.player2
          ].filter(Boolean);
        }
  
        return [
          data?.player3,
          data?.player4
        ].filter(Boolean);
      }
  
      function usuarioPertenceAoTime( data, nomeUsuario, usuario, time ) {
        const nomeNormalizado =
          normalizarTexto(nomeUsuario);
  
        const emailNormalizado =
          normalizarTexto(usuario?.email);
  
        const jogadores =
          obterTimeDosJogadores(data, time);
  
        return jogadores.some((jogador) => {
          const jogadorNormalizado =
            normalizarTexto(jogador);
  
          if (!jogadorNormalizado) {
            return false;
          }
  
          return (
            jogadorNormalizado === nomeNormalizado ||
            jogadorNormalizado === emailNormalizado ||
            jogadorNormalizado.includes(nomeNormalizado) ||
            nomeNormalizado.includes(jogadorNormalizado)
          );
        });
      }
  
      function obterPlacarNumerico(data) {
        const score = data?.score || {};
  
        const ultimoSet =
          Array.isArray(score.setHistory) &&
          score.setHistory.length > 0
            ? score.setHistory[
                score.setHistory.length - 1
              ]
            : {};
  
        const sets1 = Number(
          score.sets1 ??
            ultimoSet.sets1 ??
            0
        );
  
        const sets2 = Number(
          score.sets2 ??
            ultimoSet.sets2 ??
            0
        );
  
        const games1 = Number(
          score.games1 ??
            ultimoSet.games1 ??
            0
        );
  
        const games2 = Number(
          score.games2 ??
            ultimoSet.games2 ??
            0
        );
  
        const tieBreakPoints1 = Number(
          score.lastTieBreakPoints1 ??
            ultimoSet.lastTieBreakPoints1 ??
            score.tieBreakPoints1 ??
            ultimoSet.tieBreakPoints1 ??
            0
        );
  
        const tieBreakPoints2 = Number(
          score.lastTieBreakPoints2 ??
            ultimoSet.lastTieBreakPoints2 ??
            score.tieBreakPoints2 ??
            ultimoSet.tieBreakPoints2 ??
            0
        );
  
        return {
          sets1,
          sets2,
          games1,
          games2,
          tieBreakPoints1,
          tieBreakPoints2
        };
      }
  
      function obterResultado( data, nomeUsuario, usuario ) {
        const resultadoSalvo = normalizarTexto(
          data?.result ||
            data?.resultado ||
            data?.matchResult ||
            data?.resultadoPartida ||
            ""
        );
  
        const status = normalizarTexto(
          data?.status ||
            data?.matchStatus ||
            data?.situacao ||
            data?.estado ||
            ""
        );
  
        const vencedor = normalizarTexto(
          data?.winner ||
            data?.vencedor ||
            data?.winnerName ||
            data?.nomeVencedor ||
            ""
        );
  
        const nomeNormalizado =
          normalizarTexto(nomeUsuario);
  
        const emailNormalizado =
          normalizarTexto(usuario?.email);
  
        const vencedorEhUsuario =
          vencedor &&
          (
            vencedor === nomeNormalizado ||
            vencedor === emailNormalizado ||
            vencedor.includes(nomeNormalizado) ||
            nomeNormalizado.includes(vencedor)
          );
  
        if (vencedorEhUsuario) {
          return "vitória";
        }
  
        const indicaVitoria =
          resultadoSalvo === "w" ||
          resultadoSalvo === "v" ||
          resultadoSalvo.includes("win") ||
          resultadoSalvo.includes("won") ||
          resultadoSalvo.includes("vitoria") ||
          resultadoSalvo.includes("vitória") ||
          resultadoSalvo.includes("venceu") ||
          status === "w" ||
          status === "v" ||
          status.includes("win") ||
          status.includes("won") ||
          status.includes("vitoria") ||
          status.includes("vitória") ||
          data?.won === true ||
          data?.win === true ||
          data?.isWinner === true ||
          data?.player1Won === true;
  
        if (indicaVitoria) {
          return "vitória";
        }
  
        const indicaDerrota =
          resultadoSalvo === "l" ||
          resultadoSalvo.includes("loss") ||
          resultadoSalvo.includes("lost") ||
          resultadoSalvo.includes("derrota") ||
          resultadoSalvo.includes("perdeu") ||
          status === "l" ||
          status.includes("loss") ||
          status.includes("derrota") ||
          data?.lost === true ||
          data?.loss === true;
  
        if (indicaDerrota) {
          return "derrota";
        }
  
        const placar =
          obterPlacarNumerico(data);
  
        let timeVencedor = null;
  
        if (placar.sets1 !== placar.sets2) {
          timeVencedor =
            placar.sets1 > placar.sets2
              ? 1
              : 2;
        }
  
        if (
          timeVencedor === null &&
          placar.games1 !== placar.games2
        ) {
          timeVencedor =
            placar.games1 > placar.games2
              ? 1
              : 2;
        }
  
        if (
          timeVencedor === null &&
          placar.tieBreakPoints1 !==
            placar.tieBreakPoints2
        ) {
          timeVencedor =
            placar.tieBreakPoints1 >
            placar.tieBreakPoints2
              ? 1
              : 2;
        }
  
        if (timeVencedor === null) {
          return "não identificado";
        }
  
        const usuarioNoTimeVencedor =
          usuarioPertenceAoTime(
            data,
            nomeUsuario,
            usuario,
            timeVencedor
          );
  
        return usuarioNoTimeVencedor
          ? "vitória"
          : "derrota";
      }
  
      function resumirPartida( doc, data, nomeUsuario, usuario ) {
        const placar =
          obterPlacarNumerico(data);
  
        return {
          id: doc.id,
  
          matchId:
            data?.matchId || "",
  
          jogadores: {
            jogador1:
              data?.player1 ||
              data?.jogador1 ||
              data?.nomeJogador1 ||
              data?.player ||
              data?.jogador ||
              "Jogador",
  
            jogador2:
              data?.player2 ||
              data?.jogador2 ||
              data?.nomeJogador2 ||
              data?.adversario ||
              data?.nomeAdversario ||
              "Adversário",
  
            jogador3:
              data?.player3 ||
              data?.jogador3 ||
              data?.nomeJogador3 ||
              "",
  
            jogador4:
              data?.player4 ||
              data?.jogador4 ||
              data?.nomeJogador4 ||
              ""
          },
  
          data: converterData(
            data?.matchDateTime ||
              data?.dataPartida ||
              data?.dataJogo ||
              data?.matchDate ||
              data?.date ||
              data?.data ||
              ""
          ),
  
          horario:
            data?.matchTime ||
            data?.horaPartida ||
            data?.horario ||
            data?.hora ||
            data?.time ||
            "",
  
          modalidade:
            data?.modality || "",
  
          formato:
            data?.gameFormat ||
            data?.formato ||
            data?.tipoPartida ||
            data?.category ||
            "",
  
          formatoPartida:
            data?.matchFormat || "",
  
          quadra:
            data?.court || "",
  
          superficie:
            data?.surfaceType || "",
  
          torneio:
            data?.tournamentName ||
            data?.nomeTorneio ||
            data?.tournament ||
            data?.torneio ||
            "",
  
          fase:
            data?.tournamentStage ||
            data?.faseTorneio ||
            data?.fase ||
            "",
  
          status:
            data?.status ||
            data?.matchStatus ||
            data?.situacao ||
            data?.estado ||
            "",
  
          placar: {
            sets1: placar.sets1,
            sets2: placar.sets2,
            games1: placar.games1,
            games2: placar.games2,
            tieBreakPoints1:
              placar.tieBreakPoints1,
            tieBreakPoints2:
              placar.tieBreakPoints2
          },
  
          resultado: obterResultado(
            data,
            nomeUsuario,
            usuario
          ),
  
          estatisticas: {
            aces:
              data?.aces ??
              data?.acesJogador ??
              null,
  
            duplasFaltas:
              data?.doubleFaults ??
              data?.duplasFaltas ??
              null,
  
            winners:
              data?.winners ??
              null,
  
            errosNaoForcados:
              data?.unforcedErrors ??
              data?.errosNaoForcados ??
              null,
  
            gamesVencidos:
              data?.gamesWon ??
              data?.gamesVencidos ??
              placar.games1,
  
            gamesPerdidos:
              data?.gamesLost ??
              data?.gamesPerdidos ??
              placar.games2
          }
        };
      }
  
      async function carregarContextoDoTennisPro() {
        const usuario = obterUsuarioAtual();
        const db = obterBanco();
  
        if (!usuario?.uid) {
          throw new Error(
            "Nenhum usuário autenticado foi encontrado."
          );
        }
  
        if (!db) {
          throw new Error(
            "Não foi possível conectar ao Firestore."
          );
        }
  
        let perfil = {};
  
        try {
          const perfilSnapshot = await db
            .collection("profiles")
            .doc(usuario.uid)
            .get();
  
          if (perfilSnapshot.exists) {
            perfil =
              perfilSnapshot.data() || {};
          }
        } catch (error) {
          console.warn(
            "Perfil não carregado:",
            error
          );
        }
  
        const nomeUsuario = obterNomeUsuario(
          usuario,
          perfil
        );
  
        const partidasSnapshot = await db
          .collection("matches")
          .where("ownerId", "==", usuario.uid)
          .get();
  
        const partidas = [];
  
        partidasSnapshot.forEach((doc) => {
          const data = doc.data() || {};
  
          partidas.push(
            resumirPartida(
              doc,
              data,
              nomeUsuario,
              usuario
            )
          );
        });
  
        const vitorias = partidas.filter(
          (partida) =>
            partida.resultado === "vitória"
        ).length;
  
        const derrotas = partidas.filter(
          (partida) =>
            partida.resultado === "derrota"
        ).length;
  
        const partidasIdentificadas =
          vitorias + derrotas;
  
        const aproveitamento =
          partidasIdentificadas > 0
            ? Number(
                (
                  (vitorias /
                    partidasIdentificadas) *
                  100
                ).toFixed(1)
              )
            : 0;
  
        const partidasRecentes = partidas
          .slice()
          .sort((a, b) =>
            String(b.data).localeCompare(
              String(a.data)
            )
          )
          .slice(0, 100);
  
        return {
          usuario: {
            nome: nomeUsuario
          },
  
          perfil: {
            displayName:
              perfil?.displayName || "",
  
            nome:
              perfil?.nome || "",
  
            cidade:
              perfil?.cidade || "",
  
            categoria:
              perfil?.categoria || "",
  
            nivel:
              perfil?.nivel || "",
  
            maoDominante:
              perfil?.maoDominante || "",
  
            backhand:
              perfil?.backhand || "",
  
            forehand:
              perfil?.forehand || "",
  
            altura:
              perfil?.height || "",
  
            peso:
              perfil?.weight || ""
          },
  
          resumo: {
            totalPartidas: partidas.length,
            vitorias,
            derrotas,
            partidasIdentificadas,
  
            partidasSemResultado:
              partidas.length -
              partidasIdentificadas,
  
            aproveitamentoPercentual:
              aproveitamento
          },
  
          partidas: partidasRecentes
        };
      }
  
      async function consultarBackend( pergunta, contexto ) {
        const quantidadeTentativas = 3;
  
        for (
          let tentativa = 1;
          tentativa <= quantidadeTentativas;
          tentativa++
        ) {
          requisicaoGeminiAtual =
            new AbortController();
  
          try {
            console.log(
              `Tentativa ${tentativa}/${quantidadeTentativas}:`,
              GEMINI_BACKEND_URL
            );
  
            const resposta = await fetch(
              GEMINI_BACKEND_URL,
              {
                method: "POST",
  
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json"
                },
  
                signal:
                  requisicaoGeminiAtual.signal,
  
                body: JSON.stringify({
                  pergunta,
                  contexto,
  
                  previousInteractionId:
                    USAR_HISTORICO_CONVERSA
                      ? ultimaInteractionId
                      : null
                })
              }
            );
  
            const textoResposta =
              await resposta.text();
  
            const contentType =
              resposta.headers.get(
                "content-type"
              ) || "";
  
            let dados = null;
  
            if (
              contentType.includes(
                "application/json"
              ) &&
              textoResposta
            ) {
              try {
                dados = JSON.parse(
                  textoResposta
                );
              } catch (_) {
                dados = null;
              }
            }
  
            if (!resposta.ok) {
              /* * Tratamento exclusivo do limite 429. */
              if (
                resposta.status === 429
              ) {
                const erroQuota = new Error(
                  dados?.error ||
                    "Você atingiu o limite gratuito de consultas do Assistente Gemini. Aguarde aproximadamente alguns segundos e tente novamente."
                );
  
                erroQuota.codigo =
                  "LIMITE_CONSULTAS";
  
                throw erroQuota;
              }
  
              const erroTemporario =
                resposta.status === 502 ||
                resposta.status === 503 ||
                resposta.status === 504;
  
              if (
                erroTemporario &&
                tentativa < quantidadeTentativas
              ) {
                mostrarResposta(
                  `O servidor está iniciando. Tentando novamente (${tentativa + 1}/${quantidadeTentativas})...`
                );
  
                await aguardar(5000);
  
                continue;
              }
  
              throw new Error(
                dados?.error ||
                  `O backend respondeu HTTP ${resposta.status}.`
              );
            }
  
            if (
              !contentType.includes(
                "application/json"
              )
            ) {
              if (
                tentativa < quantidadeTentativas
              ) {
                mostrarResposta(
                  `O servidor está preparando o serviço. Tentando novamente (${tentativa + 1}/${quantidadeTentativas})...`
                );
  
                await aguardar(5000);
  
                continue;
              }
  
              throw new Error(
                "O backend não retornou uma resposta válida."
              );
            }
  
            if (!dados) {
              throw new Error(
                "O backend retornou uma resposta inválida."
              );
            }
  
            if (
              USAR_HISTORICO_CONVERSA &&
              dados.interactionId
            ) {
              ultimaInteractionId =
                dados.interactionId;
            }
  
            if (!dados.resposta) {
              throw new Error(
                dados.error ||
                  "O backend não retornou a resposta do Gemini."
              );
            }
  
            return dados.resposta;
          } catch (error) {
            if (error.name === "AbortError") {
              throw new Error(
                "A consulta foi cancelada."
              );
            }
  
            /* * Não repete automaticamente erros de cota. */
            if (
              error.codigo ===
              "LIMITE_CONSULTAS"
            ) {
              throw error;
            }
  
            const mensagem =
              String(error.message || "")
                .toLowerCase();
  
            const erroTemporario =
              mensagem.includes("502") ||
              mensagem.includes("503") ||
              mensagem.includes("504") ||
              mensagem.includes("failed to fetch") ||
              mensagem.includes("networkerror") ||
              mensagem.includes("servidor está");
  
            if (
              erroTemporario &&
              tentativa < quantidadeTentativas
            ) {
              mostrarResposta(
                `Aguardando o backend responder. Tentando novamente (${tentativa + 1}/${quantidadeTentativas})...`
              );
  
              await aguardar(5000);
  
              continue;
            }
  
            throw error;
          } finally {
            requisicaoGeminiAtual = null;
          }
        }
  
        throw new Error(
          "Não foi possível obter resposta do backend após várias tentativas."
        );
      }
  
      geminiBtn.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          abrirModal();
        }
      );
  
      closeGeminiBtn.addEventListener(
        "click",
        fecharModal
      );
  
      cancelGeminiBtn.addEventListener(
        "click",
        fecharModal
      );
  
      clearGeminiBtn.addEventListener(
        "click",
        limparConsulta
      );
  
      geminiModal.addEventListener(
        "click",
        (event) => {
          if (event.target === geminiModal) {
            fecharModal();
          }
        }
      );
  
      document.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Escape") {
            fecharModal();
          }
        }
      );
  
      geminiForm.addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();
  
          const pergunta =
            geminiPrompt.value.trim();
  
          if (!pergunta) {
            mostrarResposta(
              "Digite uma pergunta antes de enviar.",
              true
            );
  
            geminiPrompt.focus();
  
            return;
          }
  
          mostrarResposta(
            "Consultando suas partidas e estatísticas..."
          );
  
          mostrarCarregando(true);
  
          try {
            const contexto =
              await carregarContextoDoTennisPro();
  
            mostrarResposta(
              "Analisando os dados com o Gemini..."
            );
  
            const resposta =
              await consultarBackend(
                pergunta,
                contexto
              );
  
            mostrarResposta(resposta);
          } catch (error) {
            console.error(
              "Erro ao consultar o Gemini:",
              error
            );
  
            /* * Para limite de consultas, mostra somente * a mensagem amigável, sem "Erro:". */
            if (
              error.codigo ===
              "LIMITE_CONSULTAS"
            ) {
              mostrarResposta(
                error.message,
                true
              );
            } else {
              mostrarResposta(
                `Erro: ${error.message}`,
                true
              );
            }
          } finally {
            mostrarCarregando(false);
          }
        }
      );
    });
  })();
