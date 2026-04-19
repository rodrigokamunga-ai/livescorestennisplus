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
      undoBtn: document.getElementById("undoBtn"),
      player1Name: document.getElementById("player1Name"),
      player2Name: document.getElementById("player2Name"),
      servePlayer1: document.getElementById("servePlayer1"),
      servePlayer2: document.getElementById("servePlayer2")
    };

    const serveOption1 = el.servePlayer1?.closest(".serve-option-inline");
    const serveOption2 = el.servePlayer2?.closest(".serve-option-inline");

    let timer = null;
    let liveStartedAtMs = null;

    function setMsg(text) {
      if (el.msg) el.msg.textContent = text || "";
    }

    function stopTimer() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function durationText(ms) {
      const s = Math.floor(ms / 1000);
      const h = String(Math.floor(s / 3600)).padStart(2, "0");
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const sec = String(s % 60).padStart(2, "0");
      return `${h}:${m}:${sec}`;
    }

    function startTimer(baseMs) {
      stopTimer();
      if (!baseMs || Number.isNaN(baseMs)) return;

      liveStartedAtMs = baseMs;

      const update = () => {
        if (el.durationEl) {
          el.durationEl.textContent = durationText(Date.now() - liveStartedAtMs);
        }
      };

      update();
      timer = setInterval(update, 1000);
    }

    function formatDateTime(value) {
      if (!value) return "-";
      if (value.toDate && typeof value.toDate === "function") {
        return value.toDate().toLocaleString("pt-BR");
      }
      const d = new Date(value);
      return !isNaN(d.getTime()) ? d.toLocaleString("pt-BR") : String(value);
    }

    function mapStatus(status) {
      if (status === "live") return "EM ANDAMENTO";
      if (status === "finished") return "FINALIZADA";
      if (status === "wo") return "FINALIZADA POR WO";
      return "NÃO INICIADA";
    }

    function isMatchLocked(data) {
      return data.status === "finished" || data.status === "wo";
    }

    function cloneDeep(obj) {
      return JSON.parse(JSON.stringify(obj ?? null));
    }

    function buildLastActionSnapshot(data) {
      return {
        score: cloneDeep(data.score || defaultScore()),
        status: data.status || "scheduled",
        finishedAt: data.finishedAt || null,
        winnerByWO: data.winnerByWO || "",
        server: data.server || "player1",
        durationSeconds: data.durationSeconds || 0,
        startedAt: data.startedAt || null
      };
    }

    function updateServeUI(data) {
      const server = data.server || data.score?.server || "player1";
      if (el.servePlayer1) el.servePlayer1.checked = server === "player1";
      if (el.servePlayer2) el.servePlayer2.checked = server === "player2";
      serveOption1?.classList.toggle("is-serving", server === "player1");
      serveOption2?.classList.toggle("is-serving", server === "player2");
    }

    function renderInfoTop(data) {
      if (el.matchDateTimeTop) {
        el.matchDateTimeTop.textContent = formatDateTime(data.matchDateTime);
      }

      if (el.matchTitle) {
        el.matchTitle.textContent = `${data.player1 || "Jogador 1"} x ${data.player2 || "Jogador 2"}`;
      }

      if (el.matchSubTitle) {
        el.matchSubTitle.innerHTML =
          `Categoria: <strong>${data.categoryName || "-"}</strong> • ` +
          `Formato: <strong>${data.matchFormat || "-"}</strong> • ` +
          `Fase: <strong>${data.tournamentStage || "-"}</strong> • ` +
          `Quadra: <strong>${data.court || "-"}</strong>`;
      }

      if (data.score?.tieBreakMode === "super10" && data.status === "live") {
        if (el.statusLabel) el.statusLabel.textContent = "EM ANDAMENTO • SUPERTIEBREAK";
      }
    }

    function renderMatch(data) {
      const score = normalizeScore(data.score);

      if (el.player1Name) el.player1Name.textContent = data.player1 || "Jogador 1";
      if (el.player2Name) el.player2Name.textContent = data.player2 || "Jogador 2";

      const isLiveTieBreak =
        score.tieBreakMode === "tb7" || score.tieBreakMode === "super10";

      const isFinishedTieBreak =
        data.status === "finished" &&
        !score.tieBreakMode &&
        !!score.lastTieBreakMode;

      if (isLiveTieBreak) {
        if (el.points1) el.points1.textContent = String(score.tieBreakPoints1 ?? 0);
        if (el.points2) el.points2.textContent = String(score.tieBreakPoints2 ?? 0);
      } else if (isFinishedTieBreak) {
        if (el.points1) el.points1.textContent = String(score.lastTieBreakPoints1 ?? 0);
        if (el.points2) el.points2.textContent = String(score.lastTieBreakPoints2 ?? 0);
      } else {
        const pointText = getPointDisplay(
          score.points1,
          score.points2,
          data.matchFormat,
          score
        );

        const parts = String(pointText).split("x");
        if (el.points1) el.points1.textContent = parts[0] ?? "0";
        if (el.points2) el.points2.textContent = parts[1] ?? "0";
      }

      if (el.games1) el.games1.textContent = score.games1 ?? 0;
      if (el.games2) el.games2.textContent = score.games2 ?? 0;
      if (el.sets1) el.sets1.textContent = score.sets1 ?? 0;
      if (el.sets2) el.sets2.textContent = score.sets2 ?? 0;
      if (el.editGames1) el.editGames1.value = score.games1 ?? 0;
      if (el.editGames2) el.editGames2.value = score.games2 ?? 0;

      if (el.statusLabel) el.statusLabel.textContent = mapStatus(data.status);
      if (el.startBtn) el.startBtn.disabled = data.status === "live" || isMatchLocked(data);
      if (el.finishBtn) el.finishBtn.disabled = data.status !== "live";
      if (el.undoBtn) el.undoBtn.disabled = !data.lastAction;

      renderInfoTop(data);
      updateServeUI(data);

      if (data.status === "live") {
        if (!liveStartedAtMs) {
          const started =
            data.startedAt?.toDate
              ? data.startedAt.toDate()
              : (data.startedAt ? new Date(data.startedAt) : null);

          if (started && !isNaN(started.getTime())) {
            liveStartedAtMs = started.getTime();
          }
        }

        if (liveStartedAtMs) {
          if (!timer) {
            const update = () => {
              if (el.durationEl) {
                el.durationEl.textContent = durationText(Date.now() - liveStartedAtMs);
              }
            };

            update();
            timer = setInterval(update, 1000);
          } else {
            if (el.durationEl) {
              el.durationEl.textContent = durationText(Date.now() - liveStartedAtMs);
            }
          }
        } else if (el.durationEl) {
          el.durationEl.textContent = "00:00:00";
        }
      } else {
        liveStartedAtMs = null;
        stopTimer();
        if (el.durationEl) {
          el.durationEl.textContent = durationText((data.durationSeconds || 0) * 1000);
        }
      }
    }

    async function ensureMatchStarted(ref, data) {
      if (data.status === "live") return data.startedAt || null;

      const startedAt = firebase.firestore.Timestamp.now();
      liveStartedAtMs = startedAt.toDate().getTime();

      await ref.update({
        status: "live",
        startedAt,
        durationSeconds: 0,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return startedAt;
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

        const lastAction = buildLastActionSnapshot(data);
        const score = normalizeScore(data.score);

        const result = updateFn(score, data) || {};

        score.setHistory = Array.isArray(score.setHistory) ? score.setHistory : [];
        score.server = score.server || data.server || "player1";

        const finished = isMatchFinished(score, data.matchFormat);
        const winner = getMatchWinner(score, data.matchFormat);

        await ref.update({
          lastAction,
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
          setMsg(
            score.tieBreakMode === "super10"
              ? "Supertiebreak iniciado."
              : "Tie-break iniciado."
          );
        }
      } catch (err) {
        console.error(err);
        setMsg(err.message);
      }
    }

    async function undoLastAction() {
      if (!id) return;
      const ref = __db.collection("matches").doc(id);

      try {
        const snap = await ref.get();
        if (!snap.exists) return setMsg("Partida não encontrada.");

        const data = snap.data();
        if (!data.lastAction) return setMsg("Não há ação anterior para desfazer.");

        const prev = data.lastAction;

        await ref.update({
          score: prev.score || defaultScore(),
          status: prev.status || "live",
          finishedAt: prev.finishedAt || null,
          winnerByWO: prev.winnerByWO || "",
          server: prev.server || "player1",
          durationSeconds: prev.durationSeconds || 0,
          startedAt: prev.startedAt || null,
          lastAction: null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (prev.status !== "live") {
          liveStartedAtMs = null;
          stopTimer();
        }

        setMsg("Última ação desfeita.");
      } catch (err) {
        console.error(err);
        setMsg(err.message);
      }
    }

    function bindButtons() {
      el.startBtn?.addEventListener("click", async () => {
        if (!id) return;
        try {
          const ref = __db.collection("matches").doc(id);
          const snap = await ref.get();
          if (!snap.exists) return setMsg("Partida não encontrada.");

          const data = snap.data();
          const lastAction = buildLastActionSnapshot(data);
          const startedAt = firebase.firestore.Timestamp.now();
          liveStartedAtMs = startedAt.toDate().getTime();

          await ref.update({
            lastAction,
            status: "live",
            startedAt,
            durationSeconds: 0,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          stopTimer();
          setTimeout(() => startTimer(liveStartedAtMs), 0);
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
          const lastAction = buildLastActionSnapshot(data);

          let durationSeconds = 0;

          const started = data.startedAt?.toDate
            ? data.startedAt.toDate()
            : (data.startedAt ? new Date(data.startedAt) : null);

          if (started && !isNaN(started.getTime())) {
            durationSeconds = Math.floor((Date.now() - started.getTime()) / 1000);
          } else if (liveStartedAtMs) {
            durationSeconds = Math.floor((Date.now() - liveStartedAtMs) / 1000);
          } else if (data.durationSeconds) {
            durationSeconds = Number(data.durationSeconds || 0);
          }

          liveStartedAtMs = null;
          stopTimer();

          const score = normalizeScore(data.score);

          await ref.update({
            lastAction,
            status: data.winnerByWO ? "wo" : "finished",
            finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
            durationSeconds: Number(durationSeconds || 0),
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

          if (el.durationEl) el.durationEl.textContent = durationText(durationSeconds * 1000);
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

          const lastAction = buildLastActionSnapshot(data);
          liveStartedAtMs = null;
          stopTimer();

          await ref.update({
            lastAction,
            score: defaultScore(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          setMsg("Placar zerado.");
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      });

      el.undoBtn?.addEventListener("click", undoLastAction);

      document.querySelectorAll("[data-delta]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const target = btn.dataset.target;
          const delta = Number(btn.dataset.delta);

          await saveScore((score, data) => {
            const player = target === "player1" ? 1 : 2;

            if (delta > 0) {
              updateScoreWithPoint(score, player, data.matchFormat);
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
        btn.addEventListener("click", async (e) => {
          e.preventDefault();

          const target = btn.dataset.save;
          const rawValue = target === "player1-games" ? el.editGames1?.value : el.editGames2?.value;
          const value = Number(rawValue);

          if (Number.isNaN(value) || value < 0) {
            return setMsg("Informe um número válido de games.");
          }

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

            const lastAction = buildLastActionSnapshot(data);
            const score = normalizeScore(data.score);

            if (target === "player1-games") score.games1 = value;
            if (target === "player2-games") score.games2 = value;

            score.setHistory = Array.isArray(score.setHistory) ? score.setHistory : [];
            score.server = score.server || data.server || "player1";

            const setResult = evaluateSet(score, data.matchFormat);
            const finished = isMatchFinished(score, data.matchFormat);
            const winner = getMatchWinner(score, data.matchFormat);

            await ref.update({
              lastAction,
              score: {
                ...score,
                setHistory: score.setHistory,
                lastTieBreakMode: score.lastTieBreakMode || null,
                lastTieBreakPoints1: Number(score.lastTieBreakPoints1 || 0),
                lastTieBreakPoints2: Number(score.lastTieBreakPoints2 || 0)
              },
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              server: score.server,
              status: finished ? "finished" : data.status,
              finishedAt: finished ? firebase.firestore.FieldValue.serverTimestamp() : (data.finishedAt || null),
              winnerByWO: winner ? (winner === 1 ? "player1" : "player2") : (data.winnerByWO || "")
            });

            if (setResult.tieBreakStarted) {
              setMsg(score.tieBreakMode === "super10" ? "Supertiebreak iniciado." : "Tie-break iniciado.");
            } else if (setResult.setWon) {
              setMsg("Set gravado com sucesso.");
            } else {
              setMsg("Games atualizados.");
            }
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

          const lastAction = buildLastActionSnapshot(data);
          const score = normalizeScore(data.score);
          score.server = "player1";

          await ref.update({
            lastAction,
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

          const lastAction = buildLastActionSnapshot(data);
          const score = normalizeScore(data.score);
          score.server = "player2";

          await ref.update({
            lastAction,
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