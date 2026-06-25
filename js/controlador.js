(() => {
  "use strict";

  const ControllerApp = (() => {
    const params = new URLSearchParams(window.location.search);
    const matchId = params.get("id");
    const db = window.__db || firebase.firestore();

    const el = {
      stats1Card: document.getElementById("stats1Card"),
      stats2Card: document.getElementById("stats2Card"),
      statsTitle1: document.getElementById("statsTitle1"),
      statsTitle2: document.getElementById("statsTitle2"),
      serveStatusP1: document.getElementById("serve-status-p1"),
      serveStatusP2: document.getElementById("serve-status-p2"),
      msg: document.getElementById("playerMsg")
    };

    const EVENT_MAP = {
      // Saque
      doubleFault:     { stat: "doubleFault",     winner: "opponent" },
      df:              { stat: "doubleFault",     winner: "opponent" },
      ace:             { stat: "ace",             winner: "self" },

      // Rede
      dropshotWinner:  { stat: "dropshotWinner",  winner: "self" },
      dropshot_win:    { stat: "dropshotWinner",  winner: "self" },
      dropshotError:   { stat: "dropshotError",   winner: "opponent" },
      dropshot_err:    { stat: "dropshotError",   winner: "opponent" },

      smashWinner:     { stat: "smashWinner",     winner: "self" },
      smash_win:       { stat: "smashWinner",     winner: "self" },
      smashError:      { stat: "smashError",      winner: "opponent" },
      smash_err:       { stat: "smashError",      winner: "opponent" },

      voleioWinner:    { stat: "voleioWinner",    winner: "self" },
      voleio_win:      { stat: "voleioWinner",    winner: "self" },
      voleioError:     { stat: "voleioError",     winner: "opponent" },
      voleio_err:      { stat: "voleioError",     winner: "opponent" },

      // Winner / Erros
      forehandWinner:  { stat: "forehandWinner",  winner: "self" },
      fw:              { stat: "forehandWinner",  winner: "self" },
      forehandError:   { stat: "forehandError",   winner: "opponent" },
      forehand_err:    { stat: "forehandError",   winner: "opponent" },

      backhandWinner:  { stat: "backhandWinner",  winner: "self" },
      bw:              { stat: "backhandWinner",  winner: "self" },
      backhandError:   { stat: "backhandError",   winner: "opponent" },
      backhand_err:    { stat: "backhandError",   winner: "opponent" },

      enfFH:           { stat: "enfFH",           winner: "opponent" },
      enf_fh:          { stat: "enfFH",           winner: "opponent" },
      enfBH:           { stat: "enfBH",           winner: "opponent" },
      enf_bh:          { stat: "enfBH",           winner: "opponent" },

      forcedError:     { stat: "forcedError",     winner: "opponent" },
      ef:              { stat: "forcedError",     winner: "opponent" },

      normalPoint:     { stat: "normalPoint",     winner: "self" },
      normal:          { stat: "normalPoint",     winner: "self" },

      // Devolução / Base
      returnPoint:     { stat: "returnPoint",     winner: "self" },
      ponto_devolucao: { stat: "returnPoint",     winner: "self" },

      returnError:     { stat: "returnError",     winner: "opponent" },
      erro_devolucao:  { stat: "returnError",     winner: "opponent" },

      baselineError:   { stat: "baselineError",   winner: "opponent" },
      erro_linha_base: { stat: "baselineError",   winner: "opponent" },

      baselinePoint:   { stat: "baselinePoint",   winner: "self" },
      ponto_linha_base:{ stat: "baselinePoint",   winner: "self" }
    };

    let actionLock = false;
    let lastAutoScrolledServer = null;

    function setMsg(text, type = "") {
      if (!el.msg) return;
      el.msg.textContent = text || "";
      el.msg.className = type ? `msg ${type}` : "msg";
    }

    function isMatchLocked(data) {
      return data?.status === "finished" || data?.status === "wo";
    }

    function num(v) {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }

    function defaultStatsPlayer() {
      return {
        currentServeType: 1,

        serve1Attempts: 0,
        serve1Won: 0,
        serve2Attempts: 0,
        serve2Won: 0,
        serveTotal: 0,
        serveSuccessPct: 0,

        doubleFault: 0,
        ace: 0,

        dropshotWinner: 0,
        dropshotError: 0,

        smashWinner: 0,
        smashError: 0,

        voleioWinner: 0,
        voleioError: 0,

        forehandWinner: 0,
        forehandError: 0,

        backhandWinner: 0,
        backhandError: 0,

        enfFH: 0,
        enfBH: 0,
        forcedError: 0,

        normalPoint: 0,
        returnPoint: 0,
        returnError: 0,
        baselineError: 0,
        baselinePoint: 0,

        netWon: 0,
        netLost: 0,

        totalPointsWon: 0
      };
    }

    function buildDefaultStats() {
      return {
        player1: defaultStatsPlayer(),
        player2: defaultStatsPlayer()
      };
    }

    function normalizeStats(rawStats = {}) {
      return {
        player1: { ...defaultStatsPlayer(), ...(rawStats.player1 || {}) },
        player2: { ...defaultStatsPlayer(), ...(rawStats.player2 || {}) }
      };
    }

    function incrementStat(stats, playerKey, statKey, delta = 1) {
      if (!stats[playerKey]) stats[playerKey] = defaultStatsPlayer();
      stats[playerKey][statKey] = num(stats[playerKey][statKey]) + delta;
    }

    function recalcNetStats(playerStats) {
      playerStats.netWon =
        num(playerStats.dropshotWinner) +
        num(playerStats.smashWinner) +
        num(playerStats.voleioWinner);

      playerStats.netLost =
        num(playerStats.dropshotError) +
        num(playerStats.smashError) +
        num(playerStats.voleioError);
    }

    function recalcServeStats(playerStats) {
      const total = num(playerStats.serve1Attempts) + num(playerStats.serve2Attempts);
      const won = num(playerStats.serve1Won) + num(playerStats.serve2Won);
      playerStats.serveTotal = total;
      playerStats.serveSuccessPct = total > 0 ? Number(((won / total) * 100).toFixed(1)) : 0;
    }

    function getGameFormat(data) {
      return String(data?.gameFormat || "Simples").trim();
    }

    function getTeam1Name(data) {
      const p1 = data?.player1 || "Jogador 1";
      const p2 = data?.player2 || "Jogador 2";
      const gf = getGameFormat(data);
      return (gf === "Duplas" || gf === "Duplas Mistas") ? `${p1}/${p2}` : p1;
    }

    function getTeam2Name(data) {
      const p3 = data?.player3 || "Jogador 3";
      const p4 = data?.player4 || "Jogador 4";
      const gf = getGameFormat(data);
      return (gf === "Duplas" || gf === "Duplas Mistas") ? `${p3}/${p4}` : (data?.player2 || "Jogador 2");
    }

    function scrollToServingPlayer(server) {
      if (!server) return;

      const card = server === "player1" ? el.stats1Card : el.stats2Card;
      if (!card) return;

      if (lastAutoScrolledServer === server) return;
      lastAutoScrolledServer = server;

      setTimeout(() => {
        card.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }, 150);
    }

    function updateServeUI(data) {
      const server = data?.score?.server || data?.server || "player1";
      const p1Active = server === "player1";
      const p2Active = server === "player2";

      const stats = normalizeStats(data?.stats || buildDefaultStats());
      const p1ServeType = num(stats.player1.currentServeType || 1);
      const p2ServeType = num(stats.player2.currentServeType || 1);

      if (el.stats1Card) el.stats1Card.classList.toggle("active-server", p1Active);
      if (el.stats2Card) el.stats2Card.classList.toggle("active-server", p2Active);

      if (el.serveStatusP1) {
        el.serveStatusP1.className = `serve-status ${p1Active ? "serve-first" : ""}`;
        el.serveStatusP1.textContent = p1Active
          ? `SACANDO: ${p1ServeType === 1 ? "1º SERVIÇO" : "2º SERVIÇO"}`
          : "RECEBENDO";
      }

      if (el.serveStatusP2) {
        el.serveStatusP2.className = `serve-status ${p2Active ? "serve-first" : ""}`;
        el.serveStatusP2.textContent = p2Active
          ? `SACANDO: ${p2ServeType === 1 ? "1º SERVIÇO" : "2º SERVIÇO"}`
          : "RECEBENDO";
      }

      scrollToServingPlayer(server);
    }

    function updateStatsButtonsByServer(data) {
      const server = data?.score?.server || data?.server || "player1";

      const isP1Serving = server === "player1";
      const isP2Serving = server === "player2";

      const buttons = {
        j1_ponto_devolucao: document.getElementById("j1_ponto_devolucao"),
        j1_erro_devolucao: document.getElementById("j1_erro_devolucao"),
        j1_servico_1: document.getElementById("j1_servico_1"),
        j1_servico_2: document.getElementById("j1_servico_2"),
        j1_df: document.getElementById("j1_df"),
        j1_ace: document.getElementById("j1_ace"),

        j2_ponto_devolucao: document.getElementById("j2_ponto_devolucao"),
        j2_erro_devolucao: document.getElementById("j2_erro_devolucao"),
        j2_servico_1: document.getElementById("j2_servico_1"),
        j2_servico_2: document.getElementById("j2_servico_2"),
        j2_df: document.getElementById("j2_df"),
        j2_ace: document.getElementById("j2_ace")
      };

      if (buttons.j1_ponto_devolucao) {
        buttons.j1_ponto_devolucao.style.display = isP1Serving ? "none" : "";
        buttons.j1_ponto_devolucao.disabled = isP1Serving;
      }
      if (buttons.j1_erro_devolucao) {
        buttons.j1_erro_devolucao.style.display = isP1Serving ? "none" : "";
        buttons.j1_erro_devolucao.disabled = isP1Serving;
      }
      if (buttons.j1_servico_1) {
        buttons.j1_servico_1.style.display = isP2Serving ? "none" : "";
        buttons.j1_servico_1.disabled = isP2Serving;
      }
      if (buttons.j1_servico_2) {
        buttons.j1_servico_2.style.display = isP2Serving ? "none" : "";
        buttons.j1_servico_2.disabled = isP2Serving;
      }
      if (buttons.j1_df) {
        buttons.j1_df.style.display = isP2Serving ? "none" : "";
        buttons.j1_df.disabled = isP2Serving;
      }
      if (buttons.j1_ace) {
        buttons.j1_ace.style.display = isP2Serving ? "none" : "";
        buttons.j1_ace.disabled = isP2Serving;
      }

      if (buttons.j2_ponto_devolucao) {
        buttons.j2_ponto_devolucao.style.display = isP2Serving ? "none" : "";
        buttons.j2_ponto_devolucao.disabled = isP2Serving;
      }
      if (buttons.j2_erro_devolucao) {
        buttons.j2_erro_devolucao.style.display = isP2Serving ? "none" : "";
        buttons.j2_erro_devolucao.disabled = isP2Serving;
      }
      if (buttons.j2_servico_1) {
        buttons.j2_servico_1.style.display = isP1Serving ? "none" : "";
        buttons.j2_servico_1.disabled = isP1Serving;
      }
      if (buttons.j2_servico_2) {
        buttons.j2_servico_2.style.display = isP1Serving ? "none" : "";
        buttons.j2_servico_2.disabled = isP1Serving;
      }
      if (buttons.j2_df) {
        buttons.j2_df.style.display = isP1Serving ? "none" : "";
        buttons.j2_df.disabled = isP1Serving;
      }
      if (buttons.j2_ace) {
        buttons.j2_ace.style.display = isP1Serving ? "none" : "";
        buttons.j2_ace.disabled = isP1Serving;
      }

      const stats = normalizeStats(data?.stats || buildDefaultStats());
      const p1ServeType = num(stats.player1.currentServeType || 1);
      const p2ServeType = num(stats.player2.currentServeType || 1);

      if (el.stats1Card) el.stats1Card.classList.toggle("active-server", isP1Serving);
      if (el.stats2Card) el.stats2Card.classList.toggle("active-server", isP2Serving);

      if (el.serveStatusP1) {
        el.serveStatusP1.className = `serve-status ${isP1Serving ? "serve-first" : ""}`;
        el.serveStatusP1.textContent = isP1Serving
          ? `SACANDO: ${p1ServeType === 1 ? "1º SERVIÇO" : "2º SERVIÇO"}`
          : "RECEBENDO";
      }

      if (el.serveStatusP2) {
        el.serveStatusP2.className = `serve-status ${isP2Serving ? "serve-first" : ""}`;
        el.serveStatusP2.textContent = isP2Serving
          ? `SACANDO: ${p2ServeType === 1 ? "1º SERVIÇO" : "2º SERVIÇO"}`
          : "RECEBENDO";
      }

      scrollToServingPlayer(server);
    }

    function getWinnerPosFromMap(jogador, map) {
      return map.winner === "self" ? jogador : (jogador === 1 ? 2 : 1);
    }

    function isBreakPointBeforePoint(scoreBefore, matchFormat) {
      const fmt = String(matchFormat || "").toLowerCase();
      const noAd = fmt.includes("sem vantagem") || fmt.includes("no ad") || fmt.includes("no-ad");
      const hasAd = fmt.includes("com vantagem") || fmt.includes("3 sets");
      const server = scoreBefore.server || "player1";

      if (scoreBefore.tieBreakMode === "tb7" || scoreBefore.tieBreakMode === "super10") return false;

      const sp = server === "player1" ? num(scoreBefore.points1) : num(scoreBefore.points2);
      const rp = server === "player1" ? num(scoreBefore.points2) : num(scoreBefore.points1);

      if (noAd && sp === 3 && rp === 3) return true;

      if (hasAd && !noAd) {
        if (server === "player1" && scoreBefore.advantage === "player2") return true;
        if (server === "player2" && scoreBefore.advantage === "player1") return true;
      }

      if (rp === 3 && sp < 3) return true;

      return false;
    }

    function buildScorePayload(score) {
      return {
        ...score,
        setHistory: Array.isArray(score.setHistory) ? score.setHistory : [],
        tieBreakMode: score.tieBreakMode || null,
        lastTieBreakMode: score.lastTieBreakMode || null,
        lastTieBreakPoints1: Number(score.lastTieBreakPoints1 || 0),
        lastTieBreakPoints2: Number(score.lastTieBreakPoints2 || 0),
        advantage: score.advantage || null,
        totalPoints1: Number(score.totalPoints1 || 0),
        totalPoints2: Number(score.totalPoints2 || 0),
        breakPointsWon1: Number(score.breakPointsWon1 || 0),
        breakPointsWon2: Number(score.breakPointsWon2 || 0),
        breakPointsChances1: Number(score.breakPointsChances1 || 0),
        breakPointsChances2: Number(score.breakPointsChances2 || 0)
      };
    }

    async function ensureMatchStartedWithMode(mode) {
      if (!matchId) return;

      const ref = db.collection("matches").doc(matchId);
      const snap = await ref.get();
      if (!snap.exists) return;

      const data = snap.data();
      const status = String(data.status || "scheduled").toLowerCase();

      if (status === "live" || status === "suspended" || status === "finished" || status === "wo") {
        return;
      }

      const startedAt = firebase.firestore.Timestamp.now();

      await ref.update({
        status: "live",
        startedAt,
        startedByMode: mode,
        accumulatedSeconds: Number(data.accumulatedSeconds || 0),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    async function registrarEvento(jogador, acao) {
      if (!matchId || actionLock) return;

      const map = EVENT_MAP[acao];
      if (!map) {
        setMsg(`Ação inválida: ${acao}`, "error");
        return;
      }

      actionLock = true;

      try {
        const ref = db.collection("matches").doc(matchId);
        const snap = await ref.get();

        if (!snap.exists) {
          setMsg("Partida não encontrada.", "error");
          return;
        }

        const data = snap.data();
        if (isMatchLocked(data)) {
          setMsg("A partida já foi finalizada.", "error");
          return;
        }

        // Ao clicar em qualquer botão da aba estatísticas, inicia como stats
        await ensureMatchStartedWithMode("stats");

        const freshSnap = await ref.get();
        const freshData = freshSnap.data();

        const score = normalizeScore(freshData.score || {});
        const stats = normalizeStats(freshData.stats || buildDefaultStats());

        const playerKey = jogador === 1 ? "player1" : "player2";
        const opponentKey = jogador === 1 ? "player2" : "player1";
        const currentServeType = num(stats[playerKey].currentServeType || 1);

        const winnerPos = getWinnerPosFromMap(jogador, map);
        const winnerKey = winnerPos === 1 ? "player1" : "player2";

        const wasBreakPoint = isBreakPointBeforePoint(score, freshData.matchFormat);
        const serverPos = score.server === "player2" ? 2 : 1;
        const receiverPos = serverPos === 1 ? 2 : 1;

        // Estatística do evento clicado
        incrementStat(stats, playerKey, map.stat, 1);

        // Total de pontos vencidos
        incrementStat(stats, winnerKey, "totalPointsWon", 1);

        if (winnerPos === 1) {
          score.totalPoints1 = num(score.totalPoints1) + 1;
        } else {
          score.totalPoints2 = num(score.totalPoints2) + 1;
        }

        // Break points
        if (wasBreakPoint) {
          if (receiverPos === 1) {
            score.breakPointsChances1 = num(score.breakPointsChances1) + 1;
            if (winnerPos === 1) {
              score.breakPointsWon1 = num(score.breakPointsWon1) + 1;
            }
          } else {
            score.breakPointsChances2 = num(score.breakPointsChances2) + 1;
            if (winnerPos === 2) {
              score.breakPointsWon2 = num(score.breakPointsWon2) + 1;
            }
          }
        }

        // Atualiza percentuais do saque
        if (currentServeType === 1) {
          incrementStat(stats, playerKey, "serve1Attempts", 1);
          if (winnerPos === jogador) {
            incrementStat(stats, playerKey, "serve1Won", 1);
          }
        } else {
          incrementStat(stats, playerKey, "serve2Attempts", 1);
          if (winnerPos === jogador) {
            incrementStat(stats, playerKey, "serve2Won", 1);
          }
        }

        recalcServeStats(stats[playerKey]);
        recalcServeStats(stats[opponentKey]);

        recalcNetStats(stats[playerKey]);
        recalcNetStats(stats[opponentKey]);

        let result = { score };
        if (typeof updateScoreWithPoint === "function") {
          result = updateScoreWithPoint(score, winnerPos, freshData.matchFormat) || { score };
        }

        const newScore = normalizeScore(result.score || score);

        if (result.gameWon) {
          newScore.server = newScore.server === "player1" ? "player2" : "player1";
        }

        const finished = typeof isMatchFinished === "function"
          ? isMatchFinished(newScore, freshData.matchFormat)
          : false;

        const winner = typeof getMatchWinner === "function"
          ? getMatchWinner(newScore, freshData.matchFormat)
          : 0;

        await ref.update({
          score: buildScorePayload(newScore),
          stats,
          server: newScore.server,
          status: finished ? "finished" : (freshData.status || "live"),
          finishedAt: finished ? firebase.firestore.FieldValue.serverTimestamp() : (freshData.finishedAt || null),
          winnerByWO: winner ? (winner === 1 ? "player1" : "player2") : (freshData.winnerByWO || ""),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        scrollToServingPlayer(newScore.server);

        updateServeUI({ score: newScore, stats });
        updateStatsButtonsByServer({ score: newScore });
        setMsg(`Jogada registrada: ${acao}.`, "success");
      } catch (err) {
        console.error(err);
        setMsg(err.message || "Erro ao registrar ação.", "error");
      } finally {
        actionLock = false;
      }
    }

    async function marcarServico(jogador, tipo) {
      if (!matchId) return;

      try {
        const ref = db.collection("matches").doc(matchId);
        const snap = await ref.get();
        if (!snap.exists) return;

        const data = snap.data();
        if (isMatchLocked(data)) return;

        // Ao usar a aba Games, a partida inicia como games
        await ensureMatchStartedWithMode("games");

        const freshSnap = await ref.get();
        const freshData = freshSnap.data();

        const stats = normalizeStats(freshData.stats || buildDefaultStats());
        const playerKey = jogador === 1 ? "player1" : "player2";

        stats[playerKey].currentServeType = num(tipo);
        recalcServeStats(stats[playerKey]);

        await ref.update({
          stats,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        updateServeUI({ ...freshData, stats });
        setMsg(`SACANDO: ${tipo === 1 ? "1º SERVIÇO" : "2º SERVIÇO"} — Jogador ${jogador}`, "info");
      } catch (err) {
        console.error(err);
        setMsg(err.message || "Erro ao registrar serviço.", "error");
      }
    }

    function marcarServicoFalha(jogador) {
      registrarEvento(jogador, "doubleFault");
    }

    function addPoint(jogador, acao) {
      registrarEvento(jogador, acao);
    }

    function bindButtons() {
      document.querySelectorAll(".stats-controller-card button").forEach((btn) => {
        btn.addEventListener("click", () => {
          btn.classList.remove("tap");
          void btn.offsetWidth;
          btn.classList.add("tap");
          setTimeout(() => btn.classList.remove("tap"), 220);
        });
      });

      // Jogador 1
      document.getElementById("j1_servico_1")?.addEventListener("click", () => marcarServico(1, 1));
      document.getElementById("j1_servico_2")?.addEventListener("click", () => marcarServico(1, 2));
      document.getElementById("j1_df")?.addEventListener("click", () => marcarServicoFalha(1));
      document.getElementById("j1_ace")?.addEventListener("click", () => addPoint(1, "ace"));

      document.getElementById("j1_dropshot_win")?.addEventListener("click", () => addPoint(1, "dropshot_win"));
      document.getElementById("j1_dropshot_err")?.addEventListener("click", () => addPoint(1, "dropshot_err"));
      document.getElementById("j1_smash_win")?.addEventListener("click", () => addPoint(1, "smash_win"));
      document.getElementById("j1_smash_err")?.addEventListener("click", () => addPoint(1, "smash_err"));
      document.getElementById("j1_voleio_win")?.addEventListener("click", () => addPoint(1, "voleio_win"));
      document.getElementById("j1_voleio_err")?.addEventListener("click", () => addPoint(1, "voleio_err"));

      document.getElementById("j1_fw")?.addEventListener("click", () => addPoint(1, "fw"));
      document.getElementById("j1_bw")?.addEventListener("click", () => addPoint(1, "bw"));
      document.getElementById("j1_enf_fh")?.addEventListener("click", () => addPoint(1, "enf_fh"));
      document.getElementById("j1_enf_bh")?.addEventListener("click", () => addPoint(1, "enf_bh"));
      document.getElementById("j1_ef")?.addEventListener("click", () => addPoint(1, "ef"));
      document.getElementById("j1_ponto_normal")?.addEventListener("click", () => addPoint(1, "normal"));

      document.getElementById("j1_ponto_devolucao")?.addEventListener("click", () => addPoint(1, "ponto_devolucao"));
      document.getElementById("j1_erro_devolucao")?.addEventListener("click", () => addPoint(1, "erro_devolucao"));
      document.getElementById("j1_erro_linha_base")?.addEventListener("click", () => addPoint(1, "erro_linha_base"));
      document.getElementById("j1_ponto_linha_base")?.addEventListener("click", () => addPoint(1, "ponto_linha_base"));

      // Jogador 2
      document.getElementById("j2_servico_1")?.addEventListener("click", () => marcarServico(2, 1));
      document.getElementById("j2_servico_2")?.addEventListener("click", () => marcarServico(2, 2));
      document.getElementById("j2_df")?.addEventListener("click", () => marcarServicoFalha(2));
      document.getElementById("j2_ace")?.addEventListener("click", () => addPoint(2, "ace"));

      document.getElementById("j2_dropshot_win")?.addEventListener("click", () => addPoint(2, "dropshot_win"));
      document.getElementById("j2_dropshot_err")?.addEventListener("click", () => addPoint(2, "dropshot_err"));
      document.getElementById("j2_smash_win")?.addEventListener("click", () => addPoint(2, "smash_win"));
      document.getElementById("j2_smash_err")?.addEventListener("click", () => addPoint(2, "smash_err"));
      document.getElementById("j2_voleio_win")?.addEventListener("click", () => addPoint(2, "voleio_win"));
      document.getElementById("j2_voleio_err")?.addEventListener("click", () => addPoint(2, "voleio_err"));

      document.getElementById("j2_fw")?.addEventListener("click", () => addPoint(2, "fw"));
      document.getElementById("j2_bw")?.addEventListener("click", () => addPoint(2, "bw"));
      document.getElementById("j2_enf_fh")?.addEventListener("click", () => addPoint(2, "enf_fh"));
      document.getElementById("j2_enf_bh")?.addEventListener("click", () => addPoint(2, "enf_bh"));
      document.getElementById("j2_ef")?.addEventListener("click", () => addPoint(2, "ef"));
      document.getElementById("j2_ponto_normal")?.addEventListener("click", () => addPoint(2, "normal"));

      document.getElementById("j2_ponto_devolucao")?.addEventListener("click", () => addPoint(2, "ponto_devolucao"));
      document.getElementById("j2_erro_devolucao")?.addEventListener("click", () => addPoint(2, "erro_devolucao"));
      document.getElementById("j2_erro_linha_base")?.addEventListener("click", () => addPoint(2, "erro_linha_base"));
      document.getElementById("j2_ponto_linha_base")?.addEventListener("click", () => addPoint(2, "ponto_linha_base"));
    }

    function loadMatch() {
      if (!matchId) {
        setMsg("ID da partida não informado.", "error");
        return;
      }

      db.collection("matches").doc(matchId).onSnapshot(
        (snap) => {
          if (!snap.exists) {
            setMsg("Partida não encontrada.", "error");
            return;
          }

          const data = snap.data();
          updateServeUI(data);
          updateStatsButtonsByServer(data);

          if (el.statsTitle1) el.statsTitle1.textContent = getTeam1Name(data);
          if (el.statsTitle2) el.statsTitle2.textContent = getTeam2Name(data);
        },
        (err) => {
          console.error(err);
          setMsg(err.message || "Erro ao carregar partida.", "error");
        }
      );
    }

    function init() {
      bindButtons();
      loadMatch();
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => ControllerApp.init());
})();
