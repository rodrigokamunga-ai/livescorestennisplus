(() => {
  "use strict";

  const PlayerApp = (() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    const el = {
      matchTitle: document.getElementById("matchTitle"),
      matchSubTitle: document.getElementById("matchSubTitle"),
      matchDateTimeTop: document.getElementById("matchDateTimeTop"),
      durationEl: document.getElementById("duration"),
      statusLabel: document.getElementById("statusLabel"),
      msg: document.getElementById("playerMsg"),
      points1: document.getElementById("points1"),
      points2: document.getElementById("points2"),
      games1: document.getElementById("games1"),
      games2: document.getElementById("games2"),
      sets1: document.getElementById("sets1"),
      sets2: document.getElementById("sets2"),
      editGames1: document.getElementById("editGames1"),
      editGames2: document.getElementById("editGames2"),
      startBtn: document.getElementById("startBtn"),
      finishBtn: document.getElementById("finishBtn"),
      resetScoreBtn: document.getElementById("resetScoreBtn"),
      player1Name: document.getElementById("player1Name"),
      player2Name: document.getElementById("player2Name"),
      servePlayer1: document.getElementById("servePlayer1"),
      servePlayer2: document.getElementById("servePlayer2")
    };

    const serveOption1 = el.servePlayer1?.closest(".serve-option-inline");
    const serveOption2 = el.servePlayer2?.closest(".serve-option-inline");

    let timer = null;

    const U = {
      normalizeText: (text) => String(text || "").toLowerCase().trim(),

      noAdEnabled(matchFormat) {
        return U.normalizeText(matchFormat).includes("sem vantagem");
      },

      advantageEnabled(matchFormat) {
        return U.normalizeText(matchFormat).includes("com vantagem");
      },

      isProSet(matchFormat) {
        return U.normalizeText(matchFormat).includes("pro de 8 games");
      },

      isSetOf4Games(matchFormat) {
        return U.normalizeText(matchFormat).includes("4 games");
      },

      getCurrentSetNumber(score) {
        return (Array.isArray(score?.setHistory) ? score.setHistory.length : 0) + 1;
      },

      getHasSuperTieBreak(matchFormat) {
        return U.normalizeText(matchFormat).includes("supertiebreak de 10 pontos");
      },

      getHasTieBreak7(matchFormat) {
        return U.normalizeText(matchFormat).includes("tiebreak de 7 pontos");
      },

      getIsOneSetFormat(matchFormat) {
        const text = U.normalizeText(matchFormat);
        return (
          text.includes("1 set com vantagem") ||
          text.includes("1 set sem vantagem") ||
          text.includes("1 set pro")
        );
      },

      getMatchSetsToWin(matchFormat) {
        const isOneSetFormat = U.getIsOneSetFormat(matchFormat);
        const hasSuperTieBreak = U.getHasSuperTieBreak(matchFormat);

        // 1 set + desempate final
        if (isOneSetFormat && hasSuperTieBreak) return 1;
        if (isOneSetFormat) return 1;

        // 2 sets + desempate final
        return 2;
      },

      defaultScore() {
        return {
          points1: 0,
          points2: 0,
          games1: 0,
          games2: 0,
          sets1: 0,
          sets2: 0,
          tieBreakMode: null,
          tieBreakPoints1: 0,
          tieBreakPoints2: 0,
          lastTieBreakMode: null,
          lastTieBreakPoints1: 0,
          lastTieBreakPoints2: 0,
          setHistory: [],
          server: "player1"
        };
      },

      normalizeScore(score = {}) {
        return {
          ...U.defaultScore(),
          ...score,
          setHistory: Array.isArray(score.setHistory) ? score.setHistory : [],
          tieBreakMode:
            score.tieBreakMode === "tb7" || score.tieBreakMode === "super10"
              ? score.tieBreakMode
              : null,
          lastTieBreakMode:
            score.lastTieBreakMode === "tb7" || score.lastTieBreakMode === "super10"
              ? score.lastTieBreakMode
              : null,
          server: score.server || "player1"
        };
      },

      getTieBreakTarget(score) {
        return score?.tieBreakMode === "super10" ? 10 : 7;
      },

      tennisPointLabel(points) {
        switch (points) {
          case 0: return "0";
          case 1: return "15";
          case 2: return "30";
          case 3: return "40";
          default: return "40";
        }
      },

      tennisDeuceAdv(points1, points2) {
        if (points1 >= 3 && points2 >= 3) {
          if (points1 === points2) return "DEUCE";
          if (points1 === points2 + 1) return "AD1";
          if (points2 === points1 + 1) return "AD2";
        }
        return null;
      },

      getPointText(score) {
        if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
          return {
            p1: String(score.tieBreakPoints1 ?? 0),
            p2: String(score.tieBreakPoints2 ?? 0)
          };
        }

        const deuceAdv = U.tennisDeuceAdv(score.points1, score.points2);
        if (deuceAdv === "DEUCE") return { p1: "40", p2: "40" };
        if (deuceAdv === "AD1") return { p1: "AD", p2: "40" };
        if (deuceAdv === "AD2") return { p1: "40", p2: "AD" };

        return {
          p1: U.tennisPointLabel(score.points1),
          p2: U.tennisPointLabel(score.points2)
        };
      },

      mapStatus(status) {
        if (status === "live") return "EM ANDAMENTO";
        if (status === "finished") return "FINALIZADA";
        if (status === "wo") return "FINALIZADA POR WO";
        return "NÃO INICIADA";
      },

      formatDateTime(value) {
        if (!value) return "-";
        if (value.toDate && typeof value.toDate === "function") return value.toDate().toLocaleString("pt-BR");
        const d = new Date(value);
        return !isNaN(d.getTime()) ? d.toLocaleString("pt-BR") : value;
      },

      durationText(ms) {
        const s = Math.floor(ms / 1000);
        const h = String(Math.floor(s / 3600)).padStart(2, "0");
        const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
        const sec = String(s % 60).padStart(2, "0");
        return `${h}:${m}:${sec}`;
      },

      tieBreakWinner(tb1, tb2, targetPoints) {
        const diff = Math.abs(tb1 - tb2);
        if (targetPoints && (tb1 >= targetPoints || tb2 >= targetPoints) && diff >= 2) {
          return tb1 > tb2 ? 1 : 2;
        }
        return 0;
      },

      isSetWon(games1, games2, matchFormat) {
        const diff = Math.abs(games1 - games2);

        if (U.isSetOf4Games(matchFormat)) {
          return (games1 >= 4 || games2 >= 4) && diff >= 2;
        }

        if (U.isProSet(matchFormat)) {
          return (games1 >= 8 || games2 >= 8) && diff >= 2;
        }

        return (games1 >= 6 || games2 >= 6) && diff >= 2;
      },

      isTieBreakNeeded(games1, games2, matchFormat) {
        if (U.isProSet(matchFormat)) return false;

        if (U.isSetOf4Games(matchFormat)) {
          return games1 === 3 && games2 === 3;
        }

        return games1 === 6 && games2 === 6;
      },

      resolveTieBreakMode(matchFormat, score = null) {
        const text = U.normalizeText(matchFormat);
        const currentSetNumber = U.getCurrentSetNumber(score);

        const hasSuper = text.includes("supertiebreak de 10 pontos");
        const hasTb7 = text.includes("tiebreak de 7 pontos");
        const isOneSetFormat = U.getIsOneSetFormat(matchFormat);

        if (hasSuper && isOneSetFormat) {
          if (currentSetNumber === 2) return "super10";
          return "tb7";
        }

        if (hasSuper) {
          if (currentSetNumber === 3) return "super10";
          return "tb7";
        }

        if (hasTb7) return "tb7";

        return null;
      },

      completeGame(score, winner) {
        if (winner === 1) score.games1 += 1;
        else score.games2 += 1;

        score.points1 = 0;
        score.points2 = 0;
        score.server = score.server === "player1" ? "player2" : "player1";
      },

      completeSet(score, winner, fromTieBreak = false) {
        let tieBreakMode = null;
        let tieBreakPoints1 = null;
        let tieBreakPoints2 = null;

        if (fromTieBreak) {
          tieBreakMode = score.tieBreakMode;
          tieBreakPoints1 = Number(score.tieBreakPoints1 || 0);
          tieBreakPoints2 = Number(score.tieBreakPoints2 || 0);

          score.lastTieBreakMode = score.tieBreakMode;
          score.lastTieBreakPoints1 = tieBreakPoints1;
          score.lastTieBreakPoints2 = tieBreakPoints2;

          if (winner === 1) score.games1 += 1;
          if (winner === 2) score.games2 += 1;
        }

        score.setHistory = Array.isArray(score.setHistory) ? score.setHistory : [];
        score.setHistory.push({
          setNumber: score.setHistory.length + 1,
          games1: score.games1,
          games2: score.games2,
          winner,
          tieBreakMode,
          tieBreakPoints1,
          tieBreakPoints2
        });

        if (winner === 1) score.sets1 += 1;
        else score.sets2 += 1;

        score.games1 = 0;
        score.games2 = 0;
        score.points1 = 0;
        score.points2 = 0;
        score.tieBreakMode = null;
        score.tieBreakPoints1 = 0;
        score.tieBreakPoints2 = 0;
        score.server = score.server === "player1" ? "player2" : "player1";
      },

      evaluateGame(score, matchFormat) {
        const noAd = U.noAdEnabled(matchFormat);

        if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
          const target = U.getTieBreakTarget(score);
          const winner = U.tieBreakWinner(score.tieBreakPoints1, score.tieBreakPoints2, target);

          if (winner) {
            U.completeSet(score, winner, true);
            return { gameWon: false, setWon: true, winner, finishedTieBreak: true };
          }

          score.server = score.server === "player1" ? "player2" : "player1";
          return { gameWon: false, setWon: false, winner: 0, finishedTieBreak: false };
        }

        if (!noAd) {
          if ((score.points1 >= 4 || score.points2 >= 4) && Math.abs(score.points1 - score.points2) >= 2) {
            const winner = score.points1 > score.points2 ? 1 : 2;
            U.completeGame(score, winner);
            return { gameWon: true, setWon: false, winner };
          }
          return { gameWon: false, setWon: false, winner: 0 };
        }

        if (score.points1 === 3 && score.points2 === 3) {
          return { gameWon: false, setWon: false, winner: 0 };
        }

        if (score.points1 >= 4 || score.points2 >= 4) {
          const winner = score.points1 > score.points2 ? 1 : 2;
          U.completeGame(score, winner);
          return { gameWon: true, setWon: false, winner };
        }

        return { gameWon: false, setWon: false, winner: 0 };
      },

      evaluateSet(score, matchFormat) {
        const currentSetNumber = U.getCurrentSetNumber(score);
        const text = U.normalizeText(matchFormat);
        const hasSuper = text.includes("supertiebreak de 10 pontos");
        const hasTb7 = text.includes("tiebreak de 7 pontos");
        const isOneSetFormat = U.getIsOneSetFormat(matchFormat);

        if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
          const target = U.getTieBreakTarget(score);
          const winner = U.tieBreakWinner(score.tieBreakPoints1, score.tieBreakPoints2, target);

          if (winner) {
            U.completeSet(score, winner, true);
            return { setWon: true, winner, tieBreakStarted: false };
          }

          return { setWon: false, winner: 0, tieBreakStarted: false };
        }

        if (score.games1 === 6 && score.games2 === 6) {
          if (hasSuper) score.tieBreakMode = "super10";
          else if (hasTb7) score.tieBreakMode = "tb7";
          else score.tieBreakMode = "tb7";

          score.tieBreakPoints1 = 0;
          score.tieBreakPoints2 = 0;
          score.points1 = 0;
          score.points2 = 0;
          return { setWon: false, winner: 0, tieBreakStarted: true };
        }

        if (hasSuper && isOneSetFormat && currentSetNumber === 2 && (score.sets1 + score.sets2) >= 1) {
          score.tieBreakMode = "super10";
          score.tieBreakPoints1 = 0;
          score.tieBreakPoints2 = 0;
          score.points1 = 0;
          score.points2 = 0;
          return { setWon: false, winner: 0, tieBreakStarted: true };
        }

        if (hasSuper && !isOneSetFormat && currentSetNumber === 3 && (score.sets1 + score.sets2) >= 2) {
          score.tieBreakMode = "super10";
          score.tieBreakPoints1 = 0;
          score.tieBreakPoints2 = 0;
          score.points1 = 0;
          score.points2 = 0;
          return { setWon: false, winner: 0, tieBreakStarted: true };
        }

        if (U.isSetWon(score.games1, score.games2, matchFormat)) {
          const winner = score.games1 > score.games2 ? 1 : 2;
          U.completeSet(score, winner, false);
          return { setWon: true, winner, tieBreakStarted: false };
        }

        return { setWon: false, winner: 0, tieBreakStarted: false };
      },

      updateScoreWithPoint(score, player, matchFormat) {
        const text = U.normalizeText(matchFormat);
        const hasSuper = text.includes("supertiebreak de 10 pontos");
        const hasTb7 = text.includes("tiebreak de 7 pontos");
        const isOneSetFormat = U.getIsOneSetFormat(matchFormat);

        if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
          if (player === 1) score.tieBreakPoints1 += 1;
          if (player === 2) score.tieBreakPoints2 += 1;

          const setResult = U.evaluateSet(score, matchFormat);
          return {
            score,
            gameWon: false,
            setWon: setResult.setWon,
            winner: setResult.winner,
            tieBreakStarted: setResult.tieBreakStarted || false
          };
        }

        if (score.games1 === 6 && score.games2 === 6) {
          if (hasSuper) score.tieBreakMode = "super10";
          else if (hasTb7) score.tieBreakMode = "tb7";
          else score.tieBreakMode = "tb7";

          score.tieBreakPoints1 = 0;
          score.tieBreakPoints2 = 0;
          score.points1 = 0;
          score.points2 = 0;

          if (player === 1) score.tieBreakPoints1 += 1;
          if (player === 2) score.tieBreakPoints2 += 1;

          const setResult = U.evaluateSet(score, matchFormat);
          return {
            score,
            gameWon: false,
            setWon: setResult.setWon,
            winner: setResult.winner,
            tieBreakStarted: true
          };
        }

        if (hasSuper && isOneSetFormat && U.getCurrentSetNumber(score) === 2 && (score.sets1 + score.sets2) >= 1) {
          score.tieBreakMode = "super10";
          score.tieBreakPoints1 = 0;
          score.tieBreakPoints2 = 0;
          score.points1 = 0;
          score.points2 = 0;

          if (player === 1) score.tieBreakPoints1 += 1;
          if (player === 2) score.tieBreakPoints2 += 1;

          const setResult = U.evaluateSet(score, matchFormat);
          return {
            score,
            gameWon: false,
            setWon: setResult.setWon,
            winner: setResult.winner,
            tieBreakStarted: true
          };
        }

        if (player === 1) score.points1 += 1;
        if (player === 2) score.points2 += 1;

        const gameResult = U.evaluateGame(score, matchFormat);
        if (gameResult.gameWon) {
          const setResult = U.evaluateSet(score, matchFormat);
          return {
            score,
            gameWon: true,
            setWon: setResult.setWon,
            winner: gameResult.winner,
            tieBreakStarted: setResult.tieBreakStarted || false
          };
        }

        return {
          score,
          gameWon: false,
          setWon: false,
          winner: 0,
          tieBreakStarted: false
        };
      },

      isMatchFinished(score, matchFormat) {
        const setsToWin = U.getMatchSetsToWin(matchFormat);
        return score.sets1 >= setsToWin || score.sets2 >= setsToWin;
      },

      getMatchWinner(score, matchFormat) {
        const setsToWin = U.getMatchSetsToWin(matchFormat);
        if (score.sets1 >= setsToWin) return 1;
        if (score.sets2 >= setsToWin) return 2;
        return 0;
      }
    };

    function setMsg(text) {
      if (el.msg) el.msg.textContent = text || "";
    }

    function stopTimer() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function startTimer(fromDate) {
      stopTimer();
      if (!fromDate) return;
      if (el.durationEl) {
        el.durationEl.textContent = U.durationText(Date.now() - fromDate.getTime());
      }
      timer = setInterval(() => {
        if (el.durationEl) {
          el.durationEl.textContent = U.durationText(Date.now() - fromDate.getTime());
        }
      }, 1000);
    }

    function updateServeUI(data) {
      const server = data.server || data.score?.server || "player1";
      if (el.servePlayer1) el.servePlayer1.checked = server === "player1";
      if (el.servePlayer2) el.servePlayer2.checked = server === "player2";
      serveOption1?.classList.toggle("is-serving", server === "player1");
      serveOption2?.classList.toggle("is-serving", server === "player2");
    }

    function renderInfoTop(data, score) {
      if (el.matchDateTimeTop) el.matchDateTimeTop.textContent = U.formatDateTime(data.matchDateTime);
      if (el.matchTitle) el.matchTitle.textContent = `${data.player1 || "Jogador 1"} x ${data.player2 || "Jogador 2"}`;
      if (el.matchSubTitle) {
        el.matchSubTitle.innerHTML =
          `Categoria: <strong>${data.categoryName || "-"}</strong> • ` +
          `Formato: <strong>${data.matchFormat || "-"}</strong> • ` +
          `Fase: <strong>${data.tournamentStage || "-"}</strong> • ` +
          `Quadra: <strong>${data.court || "-"}</strong>`;
      }

      if (score?.tieBreakMode === "super10" && data.status === "live") {
        if (el.statusLabel) el.statusLabel.textContent = "EM ANDAMENTO • SUPERTIEBREAK";
        if (el.msg) el.msg.textContent = "Supertiebreak de 10 pontos em andamento.";
      }
    }

    function isMatchLocked(data) {
      return data.status === "finished" || data.status === "wo";
    }

    async function ensureMatchStarted(ref, data) {
      if (data.status === "live") return data.startedAt || null;

      const startedAt = firebase.firestore.Timestamp.now();

      await ref.update({
        status: "live",
        startedAt,
        durationSeconds: 0,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return startedAt;
    }

    function renderMatch(data) {
      const score = U.normalizeScore(data.score);

      if (el.player1Name) el.player1Name.textContent = data.player1 || "Jogador 1";
      if (el.player2Name) el.player2Name.textContent = data.player2 || "Jogador 2";

      const pts = U.getPointText(score);
      if (el.points1) el.points1.textContent = pts.p1;
      if (el.points2) el.points2.textContent = pts.p2;

      if (el.games1) el.games1.textContent = score.games1 ?? 0;
      if (el.games2) el.games2.textContent = score.games2 ?? 0;
      if (el.sets1) el.sets1.textContent = score.sets1 ?? 0;
      if (el.sets2) el.sets2.textContent = score.sets2 ?? 0;
      if (el.editGames1) el.editGames1.value = score.games1 ?? 0;
      if (el.editGames2) el.editGames2.value = score.games2 ?? 0;

      if (el.statusLabel) el.statusLabel.textContent = U.mapStatus(data.status);
      if (el.startBtn) el.startBtn.disabled = data.status === "live" || isMatchLocked(data);
      if (el.finishBtn) el.finishBtn.disabled = data.status !== "live";

      renderInfoTop(data, score);
      updateServeUI(data);

      if (data.status === "live") {
        const started = data.startedAt?.toDate
          ? data.startedAt.toDate()
          : (data.startedAt ? new Date(data.startedAt) : null);

        if (started && !isNaN(started.getTime())) {
          startTimer(started);
        } else {
          stopTimer();
          if (el.durationEl) el.durationEl.textContent = "00:00:00";
        }
      } else {
        stopTimer();
        if (el.durationEl) {
          el.durationEl.textContent = U.durationText((data.durationSeconds || 0) * 1000);
        }
      }
    }

    async function saveScore(updateFn) {
      if (!id) return;

      const ref = __db.collection("matches").doc(id);

      try {
        const snap = await ref.get();
        if (!snap.exists) return setMsg("Partida não encontrada.");

        let data = snap.data();

        if (isMatchLocked(data)) {
          return setMsg("A partida já foi finalizada. Não é possível alterar o placar.");
        }

        if (data.status !== "live") {
          await ensureMatchStarted(ref, data);
          const updatedSnap = await ref.get();
          data = updatedSnap.data();
        }

        const score = U.normalizeScore(data.score);
        const result = updateFn(score, data) || {};

        score.setHistory = Array.isArray(score.setHistory) ? score.setHistory : [];
        score.server = score.server || data.server || "player1";
        score.tieBreakMode =
          score.tieBreakMode === "tb7" || score.tieBreakMode === "super10"
            ? score.tieBreakMode
            : null;

        const finished = U.isMatchFinished(score, data.matchFormat);
        const winner = U.getMatchWinner(score, data.matchFormat);

        await ref.update({
          score: {
            ...score,
            setHistory: score.setHistory,
            lastTieBreakMode: score.lastTieBreakMode || null,
            lastTieBreakPoints1: Number(score.lastTieBreakPoints1 || 0),
            lastTieBreakPoints2: Number(score.lastTieBreakPoints2 || 0)
          },
          server: score.server,
          status: finished ? "finished" : data.status,
          finishedAt: finished ? firebase.firestore.FieldValue.serverTimestamp() : (data.finishedAt || null),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          winnerByWO: winner ? (winner === 1 ? "player1" : "player2") : (data.winnerByWO || ""),
          startedAt: data.startedAt || null,
          durationSeconds: data.durationSeconds || 0
        });

        if (result.tieBreakStarted) {
          setMsg(score.tieBreakMode === "super10"
            ? "Supertiebreak de 10 pontos em andamento."
            : "Tie-break iniciado.");
        }
      } catch (err) {
        console.error(err);
        setMsg(err.message);
      }
    }

    function bindButtons() {
      el.startBtn?.addEventListener("click", async () => {
        if (!id) return;
        try {
          const startedAt = firebase.firestore.Timestamp.now();
          await __db.collection("matches").doc(id).update({
            status: "live",
            startedAt,
            durationSeconds: 0,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          startTimer(startedAt.toDate());
          setMsg("Partida iniciada.");
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      });

      el.finishBtn?.addEventListener("click", async () => {
        if (!id) return;
        try {
          const ref = __db.collection("matches").doc(id);
          const snap = await ref.get();
          if (!snap.exists) return setMsg("Partida não encontrada.");

          const data = snap.data();
          let durationSeconds = data.durationSeconds || 0;
          const started = data.startedAt?.toDate
            ? data.startedAt.toDate()
            : (data.startedAt ? new Date(data.startedAt) : null);

          if (started && !isNaN(started.getTime())) {
            durationSeconds = Math.floor((Date.now() - started.getTime()) / 1000);
          }

          stopTimer();

          const score = U.normalizeScore(data.score);

          await ref.update({
            status: data.winnerByWO ? "wo" : "finished",
            finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
            durationSeconds,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            score: {
              ...score,
              setHistory: Array.isArray(score.setHistory) ? score.setHistory : [],
              lastTieBreakMode: score.lastTieBreakMode || null,
              lastTieBreakPoints1: Number(score.lastTieBreakPoints1 || 0),
              lastTieBreakPoints2: Number(score.lastTieBreakPoints2 || 0)
            },
            server: score.server || data.server || "player1",
            startedAt: data.startedAt || null
          });

          if (el.durationEl) el.durationEl.textContent = U.durationText(durationSeconds * 1000);
          setMsg("Partida finalizada.");
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      });

      el.resetScoreBtn?.addEventListener("click", async () => {
        if (!id) return;
        try {
          const ref = __db.collection("matches").doc(id);
          const snap = await ref.get();
          if (!snap.exists) return setMsg("Partida não encontrada.");

          const data = snap.data();
          if (isMatchLocked(data)) {
            return setMsg("A partida já foi finalizada. Não é possível zerar o placar.");
          }

          await ref.update({
            score: U.defaultScore(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          setMsg("Placar zerado.");
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      });

      document.querySelectorAll("[data-delta]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const target = btn.dataset.target;
          const delta = Number(btn.dataset.delta);

          await saveScore((score, data) => {
            const player = target === "player1" ? 1 : 2;

            if (delta > 0) {
              U.updateScoreWithPoint(score, player, data.matchFormat);
            } else {
              if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
                if (player === 1) score.tieBreakPoints1 = Math.max(0, score.tieBreakPoints1 - 1);
                if (player === 2) score.tieBreakPoints2 = Math.max(0, score.tieBreakPoints2 - 1);
              } else {
                if (player === 1) score.points1 = Math.max(0, score.points1 - 1);
                if (player === 2) score.points2 = Math.max(0, score.points2 - 1);
              }
            }

            score.setHistory = Array.isArray(score.setHistory) ? score.setHistory : [];
            score.server = score.server || data.server || "player1";
          });
        });
      });

      document.querySelectorAll("[data-save]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const target = btn.dataset.save;
          const value = Number(target === "player1-games" ? el.editGames1?.value : el.editGames2?.value);

          try {
            const ref = __db.collection("matches").doc(id);
            const snap = await ref.get();
            if (!snap.exists) return setMsg("Partida não encontrada.");

            let data = snap.data();

            if (isMatchLocked(data)) {
              return setMsg("A partida já foi finalizada. Não é possível editar os games.");
            }

            if (data.status !== "live") {
              await ensureMatchStarted(ref, data);
              const updatedSnap = await ref.get();
              data = updatedSnap.data();
            }

            const score = U.normalizeScore(data.score);

            if (target === "player1-games") score.games1 = value;
            if (target === "player2-games") score.games2 = value;

            score.setHistory = Array.isArray(score.setHistory) ? score.setHistory : [];
            score.server = score.server || data.server || "player1";

            if (score.tieBreakMode !== "tb7" && score.tieBreakMode !== "super10") {
              if (U.getCurrentSetNumber(score) === 3 && (score.sets1 + score.sets2) >= 2) {
                score.tieBreakMode = "super10";
                score.tieBreakPoints1 = 0;
                score.tieBreakPoints2 = 0;
                score.points1 = 0;
                score.points2 = 0;
              } else if (U.isTieBreakNeeded(score.games1, score.games2, data.matchFormat)) {
                score.tieBreakMode = "tb7";
                score.tieBreakPoints1 = 0;
                score.tieBreakPoints2 = 0;
                score.points1 = 0;
                score.points2 = 0;
              }
            }

            await ref.update({
              score: {
                ...score,
                setHistory: score.setHistory,
                lastTieBreakMode: score.lastTieBreakMode || null,
                lastTieBreakPoints1: Number(score.lastTieBreakPoints1 || 0),
                lastTieBreakPoints2: Number(score.lastTieBreakPoints2 || 0)
              },
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              server: score.server
            });

            setMsg("Games atualizados.");
          } catch (err) {
            console.error(err);
            setMsg(err.message);
          }
        });
      });

      el.servePlayer1?.addEventListener("change", async () => {
        if (!id) return;
        try {
          const ref = __db.collection("matches").doc(id);
          const snap = await ref.get();
          if (!snap.exists) return setMsg("Partida não encontrada.");

          const data = snap.data();
          if (isMatchLocked(data)) {
            return setMsg("A partida já foi finalizada. Não é possível alterar o sacador.");
          }

          const score = U.normalizeScore(data.score);
          score.server = "player1";

          await ref.update({
            score: {
              ...score,
              setHistory: Array.isArray(score.setHistory) ? score.setHistory : [],
              lastTieBreakMode: score.lastTieBreakMode || null,
              lastTieBreakPoints1: Number(score.lastTieBreakPoints1 || 0),
              lastTieBreakPoints2: Number(score.lastTieBreakPoints2 || 0)
            },
            server: "player1",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          updateServeUI({ server: "player1" });
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      });

      el.servePlayer2?.addEventListener("change", async () => {
        if (!id) return;
        try {
          const ref = __db.collection("matches").doc(id);
          const snap = await ref.get();
          if (!snap.exists) return setMsg("Partida não encontrada.");

          const data = snap.data();
          if (isMatchLocked(data)) {
            return setMsg("A partida já foi finalizada. Não é possível alterar o sacador.");
          }

          const score = U.normalizeScore(data.score);
          score.server = "player2";

          await ref.update({
            score: {
              ...score,
              setHistory: Array.isArray(score.setHistory) ? score.setHistory : [],
              lastTieBreakMode: score.lastTieBreakMode || null,
              lastTieBreakPoints1: Number(score.lastTieBreakPoints1 || 0),
              lastTieBreakPoints2: Number(score.lastTieBreakPoints2 || 0)
            },
            server: "player2",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          updateServeUI({ server: "player2" });
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      });
    }

    function loadMatch() {
      if (!id) return setMsg("ID da partida não informado.");

      __db.collection("matches").doc(id).onSnapshot(
        (snap) => {
          if (!snap.exists) return setMsg("Partida não encontrada.");
          renderMatch(snap.data());
        },
        (err) => {
          console.error(err);
          setMsg(err.message);
        }
      );
    }

    function init() {
      bindButtons();
      loadMatch();
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => PlayerApp.init());
})();