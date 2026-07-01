(() => {
  "use strict";

  const PlayerApp = (() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const shareTokenFromUrl = params.get("shareToken");

    let inputMode = "games";
    let statsViewMode = "single"; // "single" | "double"

    const el = {
      matchTitle:        document.getElementById("matchTitle"),
      matchSubTitle:     document.getElementById("matchSubTitle"),
      matchDateTimeTop:  document.getElementById("matchDateTimeTop"),
      matchMode:         document.getElementById("matchMode"),
      matchFormat:       document.getElementById("matchFormat"),
      durationEl:        document.getElementById("duration"),
      statusLabel:       document.getElementById("statusLabel"),
      matchScore:        document.getElementById("matchScore"),
      msg:               document.getElementById("playerMsg"),
      points1:           document.getElementById("points1"),
      points2:           document.getElementById("points2"),
      points2Manual:     document.getElementById("points2Manual"),
      games1:            document.getElementById("games1"),
      games2:            document.getElementById("games2"),
      sets1:             document.getElementById("sets1"),
      sets2:             document.getElementById("sets2"),
      gamesVal1:         document.getElementById("gamesVal1"),
      gamesVal2:         document.getElementById("gamesVal2"),
      editGames1:        document.getElementById("editGames1"),
      editGames2:        document.getElementById("editGames2"),
      games1Label:       document.getElementById("games1Label"),
      games2Label:       document.getElementById("games2Label"),
      servePlayer1Label: document.getElementById("servePlayer1Label"),
      servePlayer2Label: document.getElementById("servePlayer2Label"),
      player2NameManual: document.getElementById("player2NameManual"),
      player1NameStats:  document.getElementById("player1NameStats"),
      startBtn:          document.getElementById("startBtn"),
      startBtnIcon:      document.getElementById("startBtnIcon"),
      startBtnLabel:     document.getElementById("startBtnLabel"),
      finishBtn:         document.getElementById("finishBtn"),
      resetScoreBtn:     document.getElementById("resetScoreBtn"),
      undoBtn:           document.getElementById("undoBtn"),
      player1Name:       document.getElementById("player1Name"),
      player2Name:       document.getElementById("player2Name"),
      servePlayer1:      document.getElementById("servePlayer1"),
      servePlayer2:      document.getElementById("servePlayer2"),
      servePlayer1Stats: document.getElementById("servePlayer1Stats"),
      servePlayer2Manual: document.getElementById("servePlayer2Manual"),
      gamesControl1:     document.getElementById("gamesControl1"),
      gamesControl2:     document.getElementById("gamesControl2"),
      pointControl1:     document.getElementById("pointControl1"),
      pointControl2:     document.getElementById("pointControl2"),
      modeGames:         document.getElementById("modeGames"),
      modePoints:        document.getElementById("modePoints"),
      modeStats:         document.getElementById("modeStats"),
      modeGamesLabel:    document.getElementById("modeGamesLabel"),
      modePointsLabel:   document.getElementById("modePointsLabel"),
      modeStatsLabel:    document.getElementById("modeStatsLabel"),
      scoreModesArea:    document.getElementById("scoreModesArea"),
      statsControlPanel: document.getElementById("statsControlPanel"),
      statsModeToggle:   document.getElementById("statsModeToggle"),
      statsModeSingle:   document.getElementById("statsModeSingle"),
      statsModeDouble:   document.getElementById("statsModeDouble"),
      statsModeSingleLabel: document.getElementById("statsModeSingleLabel"),
      statsModeDoubleLabel: document.getElementById("statsModeDoubleLabel"),
      stats2ManualCard:  document.getElementById("stats2ManualCard"),
      stats2Card:        document.getElementById("stats2Card"),
      stats1Card:        document.getElementById("stats1Card"),
      shareBtn:          document.getElementById("shareBtn"),
      shareBtnIcon:      document.getElementById("shareBtnIcon"),
      shareBtnLabel:     document.getElementById("shareBtnLabel")
    };

    const serveOption1 = document.getElementById("serveOption1");
    const serveOption2 = document.getElementById("serveOption2");
    const manualServeOption1 = document.querySelector("label[for='servePlayer1Stats']");
    const manualServeOption2 = document.querySelector("label[for='servePlayer2Manual']");

    let lastServerShown = null;
    let currentServer = "player1";
    let timer = null;
    let liveStartedAtMs = null;
    let msgTimer = null;
    let undoLockTimer = null;
    let undoLockedUntilMs = null;

    function flashStatsButton(btn, playerPos) {
      if (!btn) return;
      const flashClass = playerPos === 1 ? "btn-flash-p1" : "btn-flash-p2";
      btn.classList.remove("btn-flash-p1", "btn-flash-p2");
      void btn.offsetWidth;
      btn.classList.add(flashClass);
      setTimeout(() => btn.classList.remove(flashClass), 220);
    }

    function bindStatsButtonFlash() {
      document.querySelectorAll("#statsControlPanel .play-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const btnId = btn.id || "";
          const playerPos = btnId.startsWith("j1_") ? 1 : 2;
          flashStatsButton(btn, playerPos);
        });
      });
    }

    function getStatsActionHandlers() {
      const addPointFn = window.addPoint || (typeof addPoint === "function" ? addPoint : null);
      const marcarServicoFn = window.marcarServico || (typeof marcarServico === "function" ? marcarServico : null);
      const marcarServicoFalhaFn = window.marcarServicoFalha || (typeof marcarServicoFalha === "function" ? marcarServicoFalha : null);
    
      return {
        j1_servico_1: () => marcarServicoFn?.(1, 1),
        j1_servico_2: () => marcarServicoFn?.(1, 2),
        j1_df: () => marcarServicoFalhaFn?.(1, "df"),
        j1_ace: () => addPointFn?.(1, "ace"),
        j1_smash_win: () => addPointFn?.(1, "smash_win"),
        j1_smash_err: () => addPointFn?.(1, "smash_err"),
        j1_voleio_win: () => addPointFn?.(1, "voleio_win"),
        j1_voleio_err: () => addPointFn?.(1, "voleio_err"),
        j1_fw: () => addPointFn?.(1, "fw"),
        j1_bw: () => addPointFn?.(1, "bw"),
        j1_enf_fh: () => addPointFn?.(1, "enf_fh"),
        j1_enf_bh: () => addPointFn?.(1, "enf_bh"),
        j1_ef: () => addPointFn?.(1, "ef"),
        j1_ponto_normal: () => addPointFn?.(1, "normal"),
        j1_dropshot_win: () => addPointFn?.(1, "dropshot_win"),
        j1_dropshot_err: () => addPointFn?.(1, "dropshot_err"),
        j1_ponto_devolucao: () => addPointFn?.(1, "ponto_devolucao"),
        j1_erro_devolucao: () => addPointFn?.(1, "erro_devolucao"),
        j1_erro_linha_base: () => addPointFn?.(1, "erro_linha_base"),
        j1_ponto_linha_base: () => addPointFn?.(1, "ponto_linha_base"),
    
        j2_servico_1: () => marcarServicoFn?.(2, 1),
        j2_servico_2: () => marcarServicoFn?.(2, 2),
        j2_df: () => marcarServicoFalhaFn?.(2, "df"),
        j2_ace: () => addPointFn?.(2, "ace"),
        j2_smash_win: () => addPointFn?.(2, "smash_win"),
        j2_smash_err: () => addPointFn?.(2, "smash_err"),
        j2_voleio_win: () => addPointFn?.(2, "voleio_win"),
        j2_voleio_err: () => addPointFn?.(2, "voleio_err"),
        j2_fw: () => addPointFn?.(2, "fw"),
        j2_bw: () => addPointFn?.(2, "bw"),
        j2_enf_fh: () => addPointFn?.(2, "enf_fh"),
        j2_enf_bh: () => addPointFn?.(2, "enf_bh"),
        j2_ef: () => addPointFn?.(2, "ef"),
        j2_ponto_normal: () => addPointFn?.(2, "normal"),
        j2_dropshot_win: () => addPointFn?.(2, "dropshot_win"),
        j2_dropshot_err: () => addPointFn?.(2, "dropshot_err"),
        j2_ponto_devolucao: () => addPointFn?.(2, "ponto_devolucao"),
        j2_erro_devolucao: () => addPointFn?.(2, "erro_devolucao"),
        j2_erro_linha_base: () => addPointFn?.(2, "erro_linha_base"),
        j2_ponto_linha_base: () => addPointFn?.(2, "ponto_linha_base")
      };
    }

    function bindStatsActions() {
      const actionHandlers = getStatsActionHandlers();
    
      Object.entries(actionHandlers).forEach(([btnId, handler]) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
    
        // Remove o onclick inline para evitar duplicidade
        btn.removeAttribute("onclick");
    
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          if (btn.disabled) return;
    
          try {
            const result = handler?.();
            if (result && typeof result.then === "function") {
              await result;
            }
          } catch (err) {
            console.error(`Erro ao executar ação do botão ${btnId}:`, err);
          }
        });
      });
      
    }

    bindStatsActions();



    function applyStatsView(mode) {
      statsViewMode = mode;
      const isSingle = mode === "single";
      const isDouble = mode === "double";

      if (el.statsModeSingleLabel) el.statsModeSingleLabel.classList.toggle("active", isSingle);
      if (el.statsModeDoubleLabel) el.statsModeDoubleLabel.classList.toggle("active", isDouble);

      if (el.stats1Card) el.stats1Card.style.display = "";
      if (el.stats2Card) el.stats2Card.style.display = isDouble ? "" : "none";
      if (el.stats2ManualCard) el.stats2ManualCard.style.display = isSingle ? "" : "none";

      if (el.statsModeToggle) el.statsModeToggle.style.display = inputMode === "stats" ? "flex" : "none";
    }

    function applyInputMode(mode) {
      inputMode = mode;

      const isGames = mode === "games";
      const isPoints = mode === "points";
      const isStats = mode === "stats";

      if (el.modeGamesLabel) el.modeGamesLabel.classList.toggle("active", isGames);
      if (el.modePointsLabel) el.modePointsLabel.classList.toggle("active", isPoints);
      if (el.modeStatsLabel) el.modeStatsLabel.classList.toggle("active", isStats);

      if (el.gamesControl1) el.gamesControl1.style.display = isGames ? "flex" : "none";
      if (el.gamesControl2) el.gamesControl2.style.display = isGames ? "flex" : "none";
      if (el.pointControl1) el.pointControl1.style.display = isPoints ? "flex" : "none";
      if (el.pointControl2) el.pointControl2.style.display = isPoints ? "flex" : "none";
      if (el.scoreModesArea) el.scoreModesArea.style.display = isStats ? "none" : "";
      if (el.statsControlPanel) el.statsControlPanel.style.display = isStats ? "" : "none";
      if (el.statsModeToggle) el.statsModeToggle.style.display = isStats ? "flex" : "none";

      if (isStats) applyStatsView(statsViewMode || "single");
    }

    function bindInputModeToggle() {
      el.modeGames?.addEventListener("change", () => applyInputMode("games"));
      el.modePoints?.addEventListener("change", () => applyInputMode("points"));
      el.modeStats?.addEventListener("change", () => applyInputMode("stats"));

      el.modeGamesLabel?.addEventListener("click", () => {
        if (!el.modeGames?.disabled) applyInputMode("games");
      });
      el.modePointsLabel?.addEventListener("click", () => {
        if (!el.modePoints?.disabled) applyInputMode("points");
      });
      el.modeStatsLabel?.addEventListener("click", () => {
        if (!el.modeStats?.disabled) applyInputMode("stats");
      });

      applyInputMode("games");
    }

    function bindStatsViewToggle() {
      el.statsModeSingle?.addEventListener("change", () => applyStatsView("single"));
      el.statsModeDouble?.addEventListener("change", () => applyStatsView("double"));

      el.statsModeSingleLabel?.addEventListener("click", () => {
        if (!el.statsModeSingle?.disabled) applyStatsView("single");
      });
      el.statsModeDoubleLabel?.addEventListener("click", () => {
        if (!el.statsModeDouble?.disabled) applyStatsView("double");
      });

      applyStatsView("single");
    }

    function updateMatchControls(status) {
      const isFinished = status === "finished" || status === "wo" || status === "ret";

      if (el.startBtn) {
        el.startBtn.disabled = isFinished;
        el.startBtn.title = isFinished ? "Partida já finalizada" : "";
      }
      if (el.finishBtn) {
        el.finishBtn.disabled = isFinished || (status !== "live" && status !== "suspended");
        el.finishBtn.title = isFinished ? "Partida já finalizada" : "";
      }
      if (el.resetScoreBtn) {
        el.resetScoreBtn.disabled = isFinished;
        el.resetScoreBtn.title = isFinished ? "Partida já finalizada" : "";
      }

      [el.startBtn, el.finishBtn, el.resetScoreBtn].forEach((btn) => {
        if (!btn) return;
        btn.style.opacity = btn.disabled ? "0.35" : "";
        btn.style.cursor = btn.disabled ? "not-allowed" : "";
      });
    }

    function clearUndoLockTimer() {
      if (undoLockTimer) {
        clearTimeout(undoLockTimer);
        undoLockTimer = null;
      }
    }

    function applyUndoLockState(data) {
      if (!el.undoBtn) return;

      const isFinished = data.status === "finished" || data.status === "wo" || data.status === "ret";
      const finishedAt = data.finishedAt?.toDate
        ? data.finishedAt.toDate()
        : (data.finishedAt ? new Date(data.finishedAt) : null);

      clearUndoLockTimer();
      undoLockedUntilMs = null;

      if (isFinished && finishedAt && !isNaN(finishedAt.getTime())) {
        const elapsedMs = Date.now() - finishedAt.getTime();
        const remainingMs = 5 * 60 * 1000 - elapsedMs;

        if (remainingMs <= 0) {
          el.undoBtn.disabled = true;
          el.undoBtn.title = "Desfazer bloqueado após 5 minutos da finalização";
          el.undoBtn.style.opacity = "0.35";
          el.undoBtn.style.cursor = "not-allowed";
          return;
        }

        undoLockedUntilMs = Date.now() + remainingMs;
        el.undoBtn.disabled = false;
        el.undoBtn.title = "Desfazer disponível por até 5 minutos após a finalização";
        el.undoBtn.style.opacity = "";
        el.undoBtn.style.cursor = "";

        undoLockTimer = setTimeout(() => {
          if (el.undoBtn) {
            el.undoBtn.disabled = true;
            el.undoBtn.title = "Desfazer bloqueado após 5 minutos da finalização";
            el.undoBtn.style.opacity = "0.35";
            el.undoBtn.style.cursor = "not-allowed";
          }
        }, remainingMs);

        return;
      }

      el.undoBtn.disabled = !data.lastAction;
      el.undoBtn.title = data.lastAction ? "" : "Não há ação anterior para desfazer";
      el.undoBtn.style.opacity = el.undoBtn.disabled ? "0.35" : "";
      el.undoBtn.style.cursor = el.undoBtn.disabled ? "not-allowed" : "";
    }

    function setStatsButtonsDisabled(disabled) {
      const statsButtons = document.querySelectorAll("#statsControlPanel button");
      statsButtons.forEach((btn) => {
        btn.disabled = disabled;
        btn.style.opacity = disabled ? "0.35" : "";
        btn.style.cursor = disabled ? "not-allowed" : "";
        btn.style.pointerEvents = disabled ? "none" : "";
      });
    }

    function updateControlsState(data) {
      const score = normalizeScore(data.score);
      const isLocked = isMatchLocked(data);
      const isSuspended = data.status === "suspended";
      const isTBActive = score.tieBreakMode === "tb7" || score.tieBreakMode === "super10";

      document.querySelectorAll("[data-delta], [data-games-delta]").forEach((btn) => {
        btn.disabled = isLocked || isSuspended;
        btn.style.opacity = (isLocked || isSuspended) ? "0.4" : "";
        btn.style.cursor = (isLocked || isSuspended) ? "not-allowed" : "";
      });

      setStatsButtonsDisabled(isLocked || isSuspended);

      const toggleDisabled = isLocked || isSuspended;
      if (el.modeGames) el.modeGames.disabled = toggleDisabled || isTBActive;
      if (el.modePoints) el.modePoints.disabled = toggleDisabled;
      if (el.modeStats) el.modeStats.disabled = toggleDisabled;

      [el.modeGamesLabel, el.modePointsLabel, el.modeStatsLabel].forEach((lbl, i) => {
        if (!lbl) return;
        const disabled = toggleDisabled || (i === 0 && isTBActive);
        lbl.style.opacity = disabled ? "0.35" : "";
        lbl.style.cursor = disabled ? "not-allowed" : "";
        lbl.style.pointerEvents = disabled ? "none" : "";
      });

      const serveDisabled = isLocked || isSuspended;
      if (el.servePlayer1) el.servePlayer1.disabled = serveDisabled;
      if (el.servePlayer2) el.servePlayer2.disabled = serveDisabled;
      if (el.servePlayer1Stats) el.servePlayer1Stats.disabled = serveDisabled;
      if (el.servePlayer2Manual) el.servePlayer2Manual.disabled = serveDisabled;

      [serveOption1, serveOption2, manualServeOption1, manualServeOption2].forEach((opt) => {
        if (!opt) return;
        opt.style.opacity = serveDisabled ? "0.4" : "";
        opt.style.cursor = serveDisabled ? "not-allowed" : "";
        opt.style.pointerEvents = serveDisabled ? "none" : "";
      });

      if (isTBActive && !isLocked && !isSuspended) {
        if (inputMode !== "points") {
          applyInputMode("points");
          if (el.modePoints) el.modePoints.checked = true;
        }
      }
    }

    function updateStartBtn(status) {
      if (!el.startBtn) return;

      if (status === "live") {
        el.startBtn.disabled = false;
        if (el.startBtnIcon) el.startBtnIcon.textContent = "⏸️";
        if (el.startBtnLabel) el.startBtnLabel.textContent = "Interromper";
        el.startBtn.classList.remove("primary-action");
        el.startBtn.classList.add("pause-action");
      } else if (status === "suspended") {
        el.startBtn.disabled = false;
        if (el.startBtnIcon) el.startBtnIcon.textContent = "▶️";
        if (el.startBtnLabel) el.startBtnLabel.textContent = "Recomeçar";
        el.startBtn.classList.remove("pause-action");
        el.startBtn.classList.add("primary-action");
      } else if (status === "finished" || status === "wo") {
        el.startBtn.disabled = true;
        if (el.startBtnIcon) el.startBtnIcon.textContent = "▶️";
        if (el.startBtnLabel) el.startBtnLabel.textContent = "Iniciar";
        el.startBtn.classList.remove("pause-action");
        el.startBtn.classList.add("primary-action");
      } else {
        el.startBtn.disabled = false;
        if (el.startBtnIcon) el.startBtnIcon.textContent = "▶️";
        if (el.startBtnLabel) el.startBtnLabel.textContent = "Iniciar";
        el.startBtn.classList.remove("pause-action");
        el.startBtn.classList.add("primary-action");
      }
    }

    function setMsg(text, type = "") {
      if (!el.msg) return;
      el.msg.textContent = text || "";
      el.msg.className = type ? `msg ${type}` : "msg";
      if (msgTimer) {
        clearTimeout(msgTimer);
        msgTimer = null;
      }
      if (text) {
        msgTimer = setTimeout(() => {
          if (el.msg) el.msg.textContent = "";
        }, 2500);
      }
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
        if (el.durationEl) el.durationEl.textContent = durationText(Date.now() - liveStartedAtMs);
      };
      update();
      timer = setInterval(update, 1000);
    }

    function getFinishedDurationText(data) {
      if (data?.durationSeconds && Number(data.durationSeconds) > 0) {
        return durationText(Number(data.durationSeconds) * 1000);
      }
      const started = data?.startedAt?.toDate ? data.startedAt.toDate() : (data?.startedAt ? new Date(data.startedAt) : null);
      const finished = data?.finishedAt?.toDate ? data.finishedAt.toDate() : (data?.finishedAt ? new Date(data.finishedAt) : null);
      if (started && finished && !isNaN(started.getTime()) && !isNaN(finished.getTime()) && finished >= started) {
        return durationText(finished.getTime() - started.getTime());
      }
      return "00:00:00";
    }

    function formatDateTime(value) {
      if (!value) return "-";
      if (value.toDate && typeof value.toDate === "function") return value.toDate().toLocaleString("pt-BR");
      const d = new Date(value);
      return !isNaN(d.getTime()) ? d.toLocaleString("pt-BR") : String(value);
    }

    function mapStatus(status) {
      if (status === "live") return "EM ANDAMENTO";
      if (status === "suspended") return "SUSPENSA";
      if (status === "finished") return "FINALIZADA";
      if (status === "wo") return "FINALIZADA POR WO";
      if (status === "ret") return "FINALIZADA POR RET";
      return "NÃO INICIADA";
    }

    function isMatchLocked(data) {
      return data.status === "finished" || data.status === "wo" || data.status === "ret";
    }

    function cloneDeep(obj) {
      return JSON.parse(JSON.stringify(obj ?? null));
    }

    function defaultScore() {
      return {
        points1: 0, points2: 0,
        games1: 0, games2: 0,
        sets1: 0, sets2: 0,
        tieBreakMode: null,
        tieBreakPoints1: 0,
        tieBreakPoints2: 0,
        lastTieBreakMode: null,
        lastTieBreakPoints1: 0,
        lastTieBreakPoints2: 0,
        setHistory: [],
        lastPoints: [],
        server: "player1",
        advantage: null,
        totalPoints1: 0,
        totalPoints2: 0,
        breakPointsWon1: 0,
        breakPointsWon2: 0,
        breakPointsChances1: 0,
        breakPointsChances2: 0
      };
    }

    function normalizeScore(score = {}) {
      return {
        ...defaultScore(),
        ...score,
        setHistory: Array.isArray(score.setHistory) ? score.setHistory : [],
        lastPoints: Array.isArray(score.lastPoints) ? score.lastPoints : [],
        tieBreakMode: score.tieBreakMode === "tb7" || score.tieBreakMode === "super10" ? score.tieBreakMode : null,
        lastTieBreakMode: score.lastTieBreakMode === "tb7" || score.lastTieBreakMode === "super10" ? score.lastTieBreakMode : null,
        server: score.server || "player1",
        advantage: score.advantage || null,
        totalPoints1: Number(score.totalPoints1 || 0),
        totalPoints2: Number(score.totalPoints2 || 0),
        breakPointsWon1: Number(score.breakPointsWon1 || 0),
        breakPointsWon2: Number(score.breakPointsWon2 || 0),
        breakPointsChances1: Number(score.breakPointsChances1 || 0),
        breakPointsChances2: Number(score.breakPointsChances2 || 0)
      };
    }

    function buildMatchScoreText(data) {
      const score = normalizeScore(data.score);
      const history = Array.isArray(score.setHistory) ? score.setHistory : [];

      const formatSetText = (setItem) => {
        const g1 = Number(setItem?.games1 ?? 0);
        const g2 = Number(setItem?.games2 ?? 0);
        const tb1 = Number(setItem?.tieBreakPoints1 ?? 0);
        const tb2 = Number(setItem?.tieBreakPoints2 ?? 0);
        const mode = String(setItem?.tieBreakMode || "").trim();
        const finalLabel = String(setItem?.finalLabel || "").trim();

        if (finalLabel) return finalLabel;
        if (mode === "super10") {
          if (tb1 > 0 || tb2 > 0) {
            const winnerIs1 = tb1 > tb2;
            return `${winnerIs1 ? "7x6" : "6x7"} ${tb1}-${tb2}`;
          }
          return "";
        }

        if (mode === "tb7") {
          if (tb1 > 0 || tb2 > 0) {
            const setScore = tb1 > tb2 ? "7x6" : "6x7";
            return `${setScore} (${tb1}-${tb2})`;
          }
          if (g1 === 7 && g2 === 6) return "7x6";
          if (g1 === 6 && g2 === 7) return "6x7";
          return "";
        }

        if (g1 > 0 || g2 > 0) return `${g1}x${g2}`;
        return "";
      };

      const parts = [];
      for (const setItem of history) {
        const text = formatSetText(setItem);
        if (!text) continue;
        if (parts.length && parts[parts.length - 1] === text) continue;
        parts.push(text);
      }

      const isLive = data.status === "live" || data.status === "suspended";
      const isTBActive = score.tieBreakMode === "tb7" || score.tieBreakMode === "super10";

      if (isLive) {
        if (isTBActive) {
          const tb1 = Number(score.tieBreakPoints1 || 0);
          const tb2 = Number(score.tieBreakPoints2 || 0);

          if (tb1 > 0 || tb2 > 0) {
            if (score.tieBreakMode === "super10") {
              parts.push(`${tb1}-${tb2}`);
            } else {
              parts.push(tb1 > tb2 ? `7x6 (${tb1}-${tb2})` : `6x7 (${tb1}-${tb2})`);
            }
          }
        } else {
          const g1 = Number(score.games1 || 0);
          const g2 = Number(score.games2 || 0);
          if (g1 > 0 || g2 > 0) parts.push(`${g1}x${g2}`);
        }
      }

      return parts.length ? parts.join(" • ") : "0x0";
    }

    function buildLastActionSnapshot(data) {
      return {
        score: cloneDeep(data.score || defaultScore()),
        status: data.status || "scheduled",
        finishedAt: data.finishedAt || null,
        winnerByWO: data.winnerByWO || "",
        server: data.server || "player1",
        durationSeconds: data.durationSeconds || 0,
        startedAt: data.startedAt || null,
        suspendedAt: data.suspendedAt || null,
        accumulatedSeconds: data.accumulatedSeconds || 0
      };
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

    function setServingClass(elm, active) {
      if (!elm) return;
      elm.classList.toggle("is-serving", !!active);
    }

    function syncServeUI(server) {
      currentServer = server || "player1";
      const isP1 = currentServer === "player1";
      const isP2 = currentServer === "player2";

      if (el.servePlayer1) el.servePlayer1.checked = isP1;
      if (el.servePlayer1Stats) el.servePlayer1Stats.checked = isP1;
      if (el.servePlayer2) el.servePlayer2.checked = isP2;
      if (el.servePlayer2Manual) el.servePlayer2Manual.checked = isP2;

      if (serveOption1) setServingClass(serveOption1, isP1);
      if (serveOption2) setServingClass(serveOption2, isP2);
      if (manualServeOption1) setServingClass(manualServeOption1, isP1);
      if (manualServeOption2) setServingClass(manualServeOption2, isP2);

      lastServerShown = currentServer;
    }

    function updateServeUI(data) {
      const server = data?.score?.server || data?.server || currentServer || "player1";
      syncServeUI(server);
    }

    function renderInfoTop(data) {
      const modality = String(data.modality || data.matchMode || "-").trim();
      const fmt = String(data.matchFormat || data.format || "-").trim();

      if (el.matchDateTimeTop) el.matchDateTimeTop.textContent = formatDateTime(data.matchDateTime);
      if (el.matchTitle) el.matchTitle.textContent = `${getTeam1Name(data)} x ${getTeam2Name(data)}`;
      if (el.matchMode) el.matchMode.textContent = modality || "-";
      if (el.matchFormat) el.matchFormat.textContent = fmt || "-";
      if (el.matchSubTitle) el.matchSubTitle.textContent = "Acompanhe e atualize o placar em tempo real";

      if (el.statusLabel) {
        const score = data.score || {};
        if (score.tieBreakMode === "super10" && data.status === "live") el.statusLabel.textContent = "EM ANDAMENTO • SUPER TIE-BREAK";
        else if (score.tieBreakMode === "tb7" && data.status === "live") el.statusLabel.textContent = "EM ANDAMENTO • TIE-BREAK";
        else el.statusLabel.textContent = mapStatus(data.status);
      }

      if (el.matchScore) el.matchScore.textContent = buildMatchScoreText(data);
    }

    function renderMatch(data) {
      const score = normalizeScore(data.score);
      const fmt = data.matchFormat || "";

      if (el.player1Name) el.player1Name.textContent = getTeam1Name(data);
      if (el.player2Name) el.player2Name.textContent = getTeam2Name(data);
      if (el.player2NameManual) el.player2NameManual.textContent = getTeam2Name(data);
      if (el.player1NameStats) el.player1NameStats.textContent = getTeam1Name(data);
      if (el.servePlayer1Label) el.servePlayer1Label.textContent = getTeam1Name(data);
      if (el.servePlayer2Label) el.servePlayer2Label.textContent = getTeam2Name(data);
      if (el.games1Label) el.games1Label.textContent = `Games - ${getTeam1Name(data)}`;
      if (el.games2Label) el.games2Label.textContent = `Games - ${getTeam2Name(data)}`;

      const isTBActive = score.tieBreakMode === "tb7" || score.tieBreakMode === "super10";
      const isTBFinished = data.status === "finished" && !score.tieBreakMode && !!score.lastTieBreakMode;

      if (isTBActive) {
        if (el.points1) el.points1.textContent = String(score.tieBreakPoints1 ?? 0);
        if (el.points2) el.points2.textContent = String(score.tieBreakPoints2 ?? 0);
        if (el.points2Manual) el.points2Manual.textContent = String(score.tieBreakPoints2 ?? 0);
      } else if (isTBFinished) {
        if (el.points1) el.points1.textContent = String(score.lastTieBreakPoints1 ?? 0);
        if (el.points2) el.points2.textContent = String(score.lastTieBreakPoints2 ?? 0);
        if (el.points2Manual) el.points2Manual.textContent = String(score.lastTieBreakPoints2 ?? 0);
      } else {
        const ptText = typeof getPointDisplay === "function"
          ? getPointDisplay(score.points1, score.points2, fmt, score)
          : `${score.points1}x${score.points2}`;

        if (ptText.includes("AD - J1")) {
          if (el.points1) el.points1.textContent = "AD";
          if (el.points2) el.points2.textContent = "40";
          if (el.points2Manual) el.points2Manual.textContent = "40";
        } else if (ptText.includes("AD - J2")) {
          if (el.points1) el.points1.textContent = "40";
          if (el.points2) el.points2.textContent = "AD";
          if (el.points2Manual) el.points2Manual.textContent = "AD";
        } else {
          const parts = String(ptText).split("x");
          if (el.points1) el.points1.textContent = parts[0] ?? "0";
          if (el.points2) el.points2.textContent = parts[1] ?? "0";
          if (el.points2Manual) el.points2Manual.textContent = parts[1] ?? "0";
        }
      }

      if (el.games1) el.games1.textContent = score.games1 ?? 0;
      if (el.games2) el.games2.textContent = score.games2 ?? 0;
      if (el.sets1) el.sets1.textContent = score.sets1 ?? 0;
      if (el.sets2) el.sets2.textContent = score.sets2 ?? 0;
      if (el.gamesVal1) el.gamesVal1.textContent = score.games1 ?? 0;
      if (el.gamesVal2) el.gamesVal2.textContent = score.games2 ?? 0;
      if (el.editGames1) el.editGames1.value = score.games1 ?? 0;
      if (el.editGames2) el.editGames2.value = score.games2 ?? 0;

      updateStartBtn(data.status);
      updateMatchControls(data.status);
      applyUndoLockState(data);
      updateControlsState(data);
      renderInfoTop(data);
      updateServeUI(data);

      if (inputMode === "stats") applyStatsView(statsViewMode || "single");

      if (data.status === "live") {
        const accumulated = Number(data.accumulatedSeconds || 0) * 1000;
        const started = data.startedAt?.toDate
          ? data.startedAt.toDate()
          : (data.startedAt ? new Date(data.startedAt) : null);

        if (started && !isNaN(started.getTime())) {
          const baseMs = Date.now() - started.getTime() + accumulated;
          liveStartedAtMs = Date.now() - baseMs;
        }

        if (liveStartedAtMs !== null) {
          if (!timer) startTimer(liveStartedAtMs);
          else if (el.durationEl) el.durationEl.textContent = durationText(Date.now() - liveStartedAtMs);
        } else if (el.durationEl) {
          el.durationEl.textContent = "00:00:00";
        }
      } else if (data.status === "suspended") {
        stopTimer();
        liveStartedAtMs = null;
        const accumulated = Number(data.accumulatedSeconds || 0);
        if (el.durationEl) el.durationEl.textContent = durationText(accumulated * 1000);
      } else {
        liveStartedAtMs = null;
        stopTimer();
        if (el.durationEl) el.durationEl.textContent = getFinishedDurationText(data);
      }
    }

    async function ensureMatchStarted(ref, data) {
      if (data.status === "live") return data.startedAt || null;
      const startedAt = firebase.firestore.Timestamp.now();
      liveStartedAtMs = startedAt.toDate().getTime();
      await ref.update({
        status: "live",
        startedAt,
        accumulatedSeconds: data.accumulatedSeconds || 0,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return startedAt;
    }

    function pushLastPoint(score, winnerPos) {
      const history = Array.isArray(score.lastPoints) ? [...score.lastPoints] : [];
      history.push({ winnerPos, at: firebase.firestore.Timestamp.now() });
      while (history.length > 10) history.shift();
      score.lastPoints = history;
      return score;
    }

    function buildScorePayload(score) {
      return {
        ...score,
        setHistory: Array.isArray(score.setHistory) ? score.setHistory : [],
        lastPoints: Array.isArray(score.lastPoints) ? score.lastPoints : [],
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

    function applyBreakPointStats(scoreBefore, scoreAfter, data, winnerPos) {
      const s = scoreAfter;
      const server = String(scoreBefore.server || data.server || "player1");
      const srvPos = server === "player2" ? 2 : 1;
      const rcvPos = srvPos === 1 ? 2 : 1;

      const isTBBefore = scoreBefore.tieBreakMode === "tb7" || scoreBefore.tieBreakMode === "super10";
      if (isTBBefore) return;

      const sp = srvPos === 1 ? Number(scoreBefore.points1 || 0) : Number(scoreBefore.points2 || 0);
      const rp = srvPos === 1 ? Number(scoreBefore.points2 || 0) : Number(scoreBefore.points1 || 0);

      const fmt = String(data.matchFormat || "").toLowerCase();
      const noAd = fmt.includes("sem vantagem") || fmt.includes("no ad") || fmt.includes("no-ad");

      const isAdvantageForReceiver =
        scoreBefore.advantage !== null &&
        ((rcvPos === 1 && scoreBefore.advantage === "player1") ||
         (rcvPos === 2 && scoreBefore.advantage === "player2"));

      const isDecisiveNoAd = noAd && sp === 3 && rp === 3;
      const isBreakPoint = (rp === 3 && sp < 3) || isAdvantageForReceiver || isDecisiveNoAd;
      if (!isBreakPoint) return;

      if (rcvPos === 1) s.breakPointsChances1++;
      if (rcvPos === 2) s.breakPointsChances2++;

      if (winnerPos === rcvPos) {
        if (rcvPos === 1) s.breakPointsWon1++;
        if (rcvPos === 2) s.breakPointsWon2++;
      }
    }

    function buildFinalSetHistory(score) {
      const s = normalizeScore(score);
      const history = Array.isArray(s.setHistory) ? [...s.setHistory] : [];

      const dedupeKey = (item) => {
        const mode = String(item?.tieBreakMode || "");
        const g1 = Number(item?.games1 ?? 0);
        const g2 = Number(item?.games2 ?? 0);
        const tb1 = Number(item?.tieBreakPoints1 ?? 0);
        const tb2 = Number(item?.tieBreakPoints2 ?? 0);
        const label = String(item?.finalLabel || "");
        return `${mode}|${g1}|${g2}|${tb1}|${tb2}|${label}`;
      };

      const seen = new Set();
      const cleanedHistory = [];
      for (const item of history) {
        const key = dedupeKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        cleanedHistory.push(item);
      }

      const isSuperTB = s.lastTieBreakMode === "super10" || s.tieBreakMode === "super10";
      const isTB7 = s.lastTieBreakMode === "tb7" || s.tieBreakMode === "tb7";

      if (isSuperTB) {
        const tb1 = Number(s.lastTieBreakPoints1 || s.tieBreakPoints1 || 0);
        const tb2 = Number(s.lastTieBreakPoints2 || s.tieBreakPoints2 || 0);
        const winnerIs1 = tb1 > tb2;

        cleanedHistory.push({
          games1: winnerIs1 ? 7 : 6,
          games2: winnerIs1 ? 6 : 7,
          tieBreakMode: "super10",
          tieBreakPoints1: tb1,
          tieBreakPoints2: tb2,
          finalLabel: `${winnerIs1 ? "7x6" : "6x7"} ${tb1}-${tb2}`
        });
        return cleanedHistory;
      }

      if (isTB7) {
        const tb1 = Number(s.lastTieBreakPoints1 || s.tieBreakPoints1 || 0);
        const tb2 = Number(s.lastTieBreakPoints2 || s.tieBreakPoints2 || 0);

        cleanedHistory.push({
          games1: 7,
          games2: 6,
          tieBreakMode: "tb7",
          tieBreakPoints1: tb1,
          tieBreakPoints2: tb2,
          finalLabel: `7x6 (${tb1}-${tb2})`
        });
        return cleanedHistory;
      }

      if (Number(s.games1 || 0) > 0 || Number(s.games2 || 0) > 0) {
        cleanedHistory.push({
          games1: Number(s.games1 || 0),
          games2: Number(s.games2 || 0),
          tieBreakMode: null,
          tieBreakPoints1: 0,
          tieBreakPoints2: 0
        });
      }

      return cleanedHistory;
    }

    async function registerPoint(winnerPos) {
      if (!id) return;
      const ref = __db.collection("matches").doc(id);

      try {
        const snap = await ref.get();
        if (!snap.exists) return setMsg("Partida não encontrada.", "error");

        let data = snap.data();
        if (isMatchLocked(data)) return setMsg("A partida já foi finalizada.", "error");
        if (data.status === "suspended") return setMsg("A partida está suspensa. Clique em Recomeçar.", "error");

        if (data.status !== "live") {
          await ensureMatchStarted(ref, data);
          data = (await ref.get()).data();
        }

        const lastAction = buildLastActionSnapshot(data);
        const scoreBefore = normalizeScore(data.score);
        const result = typeof updateScoreWithPoint === "function"
          ? updateScoreWithPoint(scoreBefore, winnerPos, data.matchFormat)
          : { score: scoreBefore, gameWon: false, setWon: false, winner: 0, tieBreakStarted: false };

        const score = result.score || scoreBefore;

        pushLastPoint(score, winnerPos);
        winnerPos === 1 ? score.totalPoints1++ : score.totalPoints2++;
        applyBreakPointStats(scoreBefore, score, data, winnerPos);

        if (result.gameWon) {
          score.server = score.server === "player1" ? "player2" : "player1";
        }

        const finished = typeof isMatchFinished === "function"
          ? isMatchFinished(score, data.matchFormat)
          : result.winner > 0;

        const winner = typeof getMatchWinner === "function"
          ? getMatchWinner(score, data.matchFormat)
          : result.winner || 0;

        if (finished) score.setHistory = buildFinalSetHistory(score);

        await ref.update({
          lastAction,
          score: buildScorePayload(score),
          server: score.server,
          status: finished ? "finished" : data.status,
          finishedAt: finished ? firebase.firestore.FieldValue.serverTimestamp() : (data.finishedAt || null),
          winnerByWO: winner ? (winner === 1 ? "player1" : "player2") : (data.winnerByWO || ""),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          startedAt: data.startedAt || null,
          accumulatedSeconds: data.accumulatedSeconds || 0
        });

        if (finished) setMsg(`🏆 Partida encerrada! Vencedor: Jogador ${winner}`, "success");
        else if (result.tieBreakStarted) setMsg(score.tieBreakMode === "super10" ? "🎾 Super Tie-break iniciado!" : "🎾 Tie-break iniciado!", "info");
        else if (result.setWon) setMsg("✅ Set encerrado!", "info");
        else setMsg(`Ponto do Jogador ${winnerPos} salvo.`, "success");
      } catch (err) {
        console.error(err);
        setMsg(err.message || "Erro ao salvar ponto.", "error");
      }
    }

    async function decrementPoint(winnerPos) {
      if (!id) return;
      const ref = __db.collection("matches").doc(id);

      try {
        const snap = await ref.get();
        if (!snap.exists) return setMsg("Partida não encontrada.", "error");

        let data = snap.data();
        if (isMatchLocked(data)) return setMsg("A partida já foi finalizada.", "error");
        if (data.status === "suspended") return setMsg("A partida está suspensa.", "error");

        if (data.status !== "live") {
          await ensureMatchStarted(ref, data);
          data = (await ref.get()).data();
        }

        const lastAction = buildLastActionSnapshot(data);
        const score = normalizeScore(data.score);
        const history = Array.isArray(score.lastPoints) ? [...score.lastPoints] : [];
        if (history.length > 0) history.pop();
        score.lastPoints = history;

        if (winnerPos === 1) score.totalPoints1 = Math.max(0, Number(score.totalPoints1 || 0) - 1);
        else score.totalPoints2 = Math.max(0, Number(score.totalPoints2 || 0) - 1);

        if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
          if (winnerPos === 1) score.tieBreakPoints1 = Math.max(0, score.tieBreakPoints1 - 1);
          if (winnerPos === 2) score.tieBreakPoints2 = Math.max(0, score.tieBreakPoints2 - 1);
        } else {
          if (winnerPos === 1) score.points1 = Math.max(0, score.points1 - 1);
          if (winnerPos === 2) score.points2 = Math.max(0, score.points2 - 1);
        }

        await ref.update({
          lastAction,
          score: buildScorePayload(score),
          server: score.server,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) {
        console.error(err);
        setMsg(err.message || "Erro ao decrementar ponto.", "error");
      }
    }

    async function saveGames(playerTarget, newValue) {
      if (!id) return;
      const value = Number(newValue);
      if (Number.isNaN(value) || value < 0) return setMsg("Valor inválido.", "error");
      if (value > 9) return setMsg("Máximo 9 games.", "error");

      const ref = __db.collection("matches").doc(id);

      try {
        const snap = await ref.get();
        if (!snap.exists) return setMsg("Partida não encontrada.", "error");

        let data = snap.data();
        if (isMatchLocked(data)) return setMsg("A partida já foi finalizada.", "error");
        if (data.status === "suspended") return setMsg("A partida está suspensa.", "error");

        if (data.status !== "live") {
          await ensureMatchStarted(ref, data);
          data = (await ref.get()).data();
        }

        const lastAction = buildLastActionSnapshot(data);
        const score = normalizeScore(data.score);

        if (playerTarget === "player1") score.games1 = value;
        if (playerTarget === "player2") score.games2 = value;

        const setResult = typeof evaluateSet === "function"
          ? evaluateSet(score, data.matchFormat)
          : { setWon: false, winner: 0, tieBreakStarted: false };

        const finished = typeof isMatchFinished === "function"
          ? isMatchFinished(score, data.matchFormat)
          : false;

        const winner = typeof getMatchWinner === "function"
          ? getMatchWinner(score, data.matchFormat)
          : 0;

        if (finished) score.setHistory = buildFinalSetHistory(score);

        await ref.update({
          lastAction,
          score: buildScorePayload(score),
          server: score.server,
          status: finished ? "finished" : data.status,
          finishedAt: finished ? firebase.firestore.FieldValue.serverTimestamp() : (data.finishedAt || null),
          winnerByWO: winner ? (winner === 1 ? "player1" : "player2") : (data.winnerByWO || ""),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (setResult.tieBreakStarted) setMsg(score.tieBreakMode === "super10" ? "🎾 Super Tie-break!" : "🎾 Tie-break!", "info");
        else if (setResult.setWon) setMsg("✅ Set gravado.", "success");
        else setMsg("Games atualizados.", "success");
      } catch (err) {
        console.error(err);
        setMsg(err.message, "error");
      }
    }

    async function getCurrentMatchData() {
      if (!id) return null;
      const snap = await __db.collection("matches").doc(id).get();
      return snap.exists ? snap.data() : null;
    }

    async function setServe(server) {
      if (!id) return;
      try {
        const ref = __db.collection("matches").doc(id);
        const snap = await ref.get();
        if (!snap.exists) return setMsg("Partida não encontrada.", "error");

        const data = snap.data();
        if (isMatchLocked(data)) return setMsg("A partida já foi finalizada.", "error");
        if (data.status === "suspended") return setMsg("A partida está suspensa.", "error");

        const lastAction = buildLastActionSnapshot(data);
        const score = normalizeScore(data.score);
        score.server = server;

        await ref.update({
          lastAction,
          score: buildScorePayload(score),
          server,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        syncServeUI(server);
        setMsg(`Saque: Jogador ${server === "player1" ? 1 : 2}.`, "info");
      } catch (err) {
        console.error(err);
        setMsg(err.message || "Erro ao alterar o saque.", "error");
      }
    }

    function getShareUrl() {
      const url = new URL(window.location.href);
      url.searchParams.set("id", id);
      if (shareTokenFromUrl) url.searchParams.set("shareToken", shareTokenFromUrl);
      return url.toString();
    }

    async function copyToClipboard(text) {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();

      let ok = false;
      try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }

    async function handleShare() {
      if (!id) return;
      const shareUrl = getShareUrl();
      const title = document.title || "Live Scores Tennis";

      try {
        if (navigator.share) {
          await navigator.share({
            title,
            text: "Acesse esta partida para computar o placar.",
            url: shareUrl
          });
          setMsg("Link compartilhado.", "success");
          return;
        }

        const copied = await copyToClipboard(shareUrl);
        if (copied) setMsg("Link copiado para a área de transferência.", "success");
        else prompt("Copie o link compartilhável:", shareUrl);
      } catch (err) {
        console.error(err);
        const copied = await copyToClipboard(shareUrl);
        if (copied) setMsg("Link copiado para a área de transferência.", "success");
        else prompt("Copie o link compartilhável:", shareUrl);
      }
    }

    function createRetirementModal(player1Name, player2Name) {
      return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.72); display:flex; align-items:center; justify-content:center; z-index:99999; padding:16px;";
    
        const box = document.createElement("div");
        box.style.cssText = "width:min(420px, 100%); background:#1f2937; border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:18px; color:#fff; box-shadow:0 20px 60px rgba(0,0,0,0.45); font-family:inherit;";
    
        box.innerHTML = ` <div style="font-size:18px;font-weight:900;text-align:center;margin-bottom:10px;">Deseja abandonar a partida?</div> <div style="font-size:14px;opacity:.9;text-align:center;margin-bottom:16px;line-height:1.35;">Selecione quem abandonou a partida.</div> <div style="display:flex;flex-direction:column;gap:10px;"> <button id="retPlayer1" style="padding:12px 14px; border:none; border-radius:12px; background:#22c55e; color:#fff; font-weight:800; cursor:pointer;">${player1Name}</button> <button id="retPlayer2" style="padding:12px 14px; border:none; border-radius:12px; background:#3b82f6; color:#fff; font-weight:800; cursor:pointer;">${player2Name}</button> </div> `;
    
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    
        const cleanup = () => {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };
    
        box.querySelector("#retPlayer1").addEventListener("click", () => {
          cleanup();
          resolve("player1");
        });
    
        box.querySelector("#retPlayer2").addEventListener("click", () => {
          cleanup();
          resolve("player2");
        });
    
        // Não permite cancelar clicando fora
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) {
            e.stopPropagation();
          }
        });
      });
    }

    function bindButtons() {
      bindInputModeToggle();
      bindStatsViewToggle();

      el.shareBtn?.addEventListener("click", handleShare);

      el.startBtn?.addEventListener("click", async () => {
        if (!id) return;
        try {
          const ref = __db.collection("matches").doc(id);
          const snap = await ref.get();
          if (!snap.exists) return setMsg("Partida não encontrada.", "error");

          const data = snap.data();
          const status = data.status || "scheduled";

          if (status === "scheduled" || status === "not_started") {
            if (!confirm("Deseja iniciar a partida?")) return;

            const lastAction = buildLastActionSnapshot(data);
            const startedAt = firebase.firestore.Timestamp.now();
            liveStartedAtMs = startedAt.toDate().getTime();

            await ref.update({
              lastAction,
              status: "live",
              startedAt,
              accumulatedSeconds: 0,
              suspendedAt: null,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            stopTimer();
            setTimeout(() => startTimer(liveStartedAtMs), 0);
            setMsg("Partida iniciada.", "success");
            return;
          }

          if (status === "live") {
            if (!confirm("Deseja interromper (suspender) a partida?")) return;

            const lastAction = buildLastActionSnapshot(data);
            const started = data.startedAt?.toDate
              ? data.startedAt.toDate()
              : (data.startedAt ? new Date(data.startedAt) : null);

            const previousAccumulated = Number(data.accumulatedSeconds || 0);
            const newAccumulated = started && !isNaN(started.getTime())
              ? previousAccumulated + Math.floor((Date.now() - started.getTime()) / 1000)
              : previousAccumulated;

            stopTimer();
            liveStartedAtMs = null;

            await ref.update({
              lastAction,
              status: "suspended",
              suspendedAt: firebase.firestore.FieldValue.serverTimestamp(),
              accumulatedSeconds: newAccumulated,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            setMsg("Partida suspensa.", "info");
            return;
          }

          if (status === "suspended") {
            if (!confirm("Deseja recomeçar a partida?")) return;

            const lastAction = buildLastActionSnapshot(data);
            const startedAt = firebase.firestore.Timestamp.now();

            await ref.update({
              lastAction,
              status: "live",
              startedAt,
              suspendedAt: null,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            const accumulated = Number(data.accumulatedSeconds || 0) * 1000;
            liveStartedAtMs = Date.now() - accumulated;
            stopTimer();
            setTimeout(() => startTimer(liveStartedAtMs), 0);

            setMsg("Partida recomeçada.", "success");
            return;
          }
        } catch (err) {
          console.error(err);
          setMsg(err.message, "error");
        }
      });

      el.finishBtn?.addEventListener("click", async () => {
        if (!id) return;

        try {
          const ref = __db.collection("matches").doc(id);
          const snap = await ref.get();
          if (!snap.exists) return setMsg("Partida não encontrada.", "error");

          const data = snap.data();
          if (isMatchLocked(data)) return setMsg("A partida já foi finalizada.", "error");

          const team1Name = getTeam1Name(data);
          const team2Name = getTeam2Name(data);

          const action = await createRetirementModal(team1Name, team2Name);
          if (!action) {
            const normalConfirm = confirm("Deseja encerrar a partida?");
            if (!normalConfirm) return;
          }

          const wasRetirement = action === "player1" || action === "player2";
          const lastAction = buildLastActionSnapshot(data);

          let durationSeconds = Number(data.accumulatedSeconds || 0);
          if (data.status === "live") {
            const started = data.startedAt?.toDate
              ? data.startedAt.toDate()
              : (data.startedAt ? new Date(data.startedAt) : null);

            if (started && !isNaN(started.getTime())) {
              durationSeconds += Math.floor((Date.now() - started.getTime()) / 1000);
            } else if (liveStartedAtMs) {
              durationSeconds += Math.floor((Date.now() - liveStartedAtMs) / 1000);
            }
          }

          liveStartedAtMs = null;
          stopTimer();

          const score = normalizeScore(data.score);
          const finishedAt = firebase.firestore.Timestamp.now();
          score.setHistory = buildFinalSetHistory(score);

          let statusToSave = "finished";
          let winnerByWO = data.winnerByWO || "";
          let abandonedBy = "";
          let winnerByRet = "";

          if (wasRetirement) {
            statusToSave = "ret";
            abandonedBy = action;
            winnerByRet = action === "player1" ? "player2" : "player1";
          }

          await ref.update({
            lastAction,
            status: statusToSave,
            finishedAt,
            durationSeconds: Math.max(1, durationSeconds),
            accumulatedSeconds: durationSeconds,
            score: buildScorePayload(score),
            server: score.server || data.server || "player1",
            startedAt: data.startedAt || null,
            suspendedAt: null,
            winnerByWO,
            abandonedBy,
            winnerByRet,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          if (el.durationEl) el.durationEl.textContent = durationText(durationSeconds * 1000);
          if (wasRetirement) {
            const winnerName = action === "player1" ? team2Name : team1Name;
            setMsg(`Partida finalizada por abandono. Vencedor: ${winnerName}`, "success");
          } else {
            setMsg("Partida finalizada com sucesso.", "success");
          }
        } catch (err) {
          console.error(err);
          setMsg(err.message, "error");
        }
      });

      el.resetScoreBtn?.addEventListener("click", async () => {
        if (!id || !confirm("Deseja zerar o placar e as estatísticas?")) return;

        try {
          const ref = __db.collection("matches").doc(id);
          const snap = await ref.get();
          if (!snap.exists) return setMsg("Partida não encontrada.", "error");

          const data = snap.data();
          if (isMatchLocked(data)) return setMsg("A partida já foi finalizada.", "error");

          const lastAction = buildLastActionSnapshot(data);
          liveStartedAtMs = null;
          stopTimer();

          const cleanStats = {
            player1: {
              currentServeType: 1,
              serve1Attempts: 0, serve1Won: 0, serve2Attempts: 0, serve2Won: 0,
              serveTotal: 0, serveSuccessPct: 0,
              doubleFault: 0, ace: 0,
              dropshotWinner: 0, dropshotError: 0,
              smashWinner: 0, smashError: 0,
              voleioWinner: 0, voleioError: 0,
              forehandWinner: 0, forehandError: 0,
              backhandWinner: 0, backhandError: 0,
              enfFH: 0, enfBH: 0, forcedError: 0,
              normalPoint: 0, returnPoint: 0, returnError: 0,
              baselineError: 0, baselinePoint: 0,
              totalPointsWon: 0
            },
            player2: {
              currentServeType: 1,
              serve1Attempts: 0, serve1Won: 0, serve2Attempts: 0, serve2Won: 0,
              serveTotal: 0, serveSuccessPct: 0,
              doubleFault: 0, ace: 0,
              dropshotWinner: 0, dropshotError: 0,
              smashWinner: 0, smashError: 0,
              voleioWinner: 0, voleioError: 0,
              forehandWinner: 0, forehandError: 0,
              backhandWinner: 0, backhandError: 0,
              enfFH: 0, enfBH: 0, forcedError: 0,
              normalPoint: 0, returnPoint: 0, returnError: 0,
              baselineError: 0, baselinePoint: 0,
              totalPointsWon: 0
            }
          };

          await ref.update({
            lastAction,
            score: defaultScore(),
            stats: cleanStats,
            startedAt: firebase.firestore.Timestamp.now(),
            accumulatedSeconds: 0,
            durationSeconds: 0,
            suspendedAt: null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          setMsg("Placar e estatísticas zerados com sucesso.", "success");
        } catch (err) {
          console.error(err);
          setMsg(err.message || "Erro ao zerar placar e estatísticas.", "error");
        }
      });

      el.undoBtn?.addEventListener("click", async () => {
        if (!id || !confirm("Deseja desfazer a última ação?")) return;

        try {
          const ref = __db.collection("matches").doc(id);
          const snap = await ref.get();
          if (!snap.exists) return setMsg("Partida não encontrada.", "error");

          const data = snap.data();
          if (!data.lastAction) return setMsg("Não há ação anterior para desfazer.", "error");

          const isFinished = data.status === "finished" || data.status === "wo";
          if (isFinished && data.finishedAt?.toDate) {
            const finishedAt = data.finishedAt.toDate();
            const elapsedMs = Date.now() - finishedAt.getTime();
            if (elapsedMs > 5 * 60 * 1000) {
              return setMsg("O desfazer foi bloqueado após 5 minutos da finalização.", "error");
            }
          }

          const prev = data.lastAction;
          await ref.update({
            score: prev.score || defaultScore(),
            status: prev.status || "live",
            finishedAt: prev.finishedAt || null,
            winnerByWO: prev.winnerByWO || "",
            server: prev.server || "player1",
            durationSeconds: prev.durationSeconds || 0,
            accumulatedSeconds: prev.accumulatedSeconds || 0,
            startedAt: prev.startedAt || null,
            suspendedAt: prev.suspendedAt || null,
            lastAction: null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          if (prev.status !== "live") {
            liveStartedAtMs = null;
            stopTimer();
          }

          setMsg("Última ação desfeita.", "info");
        } catch (err) {
          console.error(err);
          setMsg(err.message, "error");
        }
      });

      document.querySelectorAll("[data-delta]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const target = btn.dataset.target;
          const delta = Number(btn.dataset.delta);
          const pos = target === "player1" ? 1 : 2;
          if (delta > 0) await registerPoint(pos);
          else await decrementPoint(pos);
        });
      });

      document.querySelectorAll("[data-games-delta]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const target = btn.dataset.gamesTarget;
          const delta = Number(btn.dataset.gamesDelta);
          const valEl = target === "player1" ? el.gamesVal1 : el.gamesVal2;
          const current = Number(valEl?.textContent || 0);
          const newVal = Math.max(0, Math.min(9, current + delta));
          if (valEl) valEl.textContent = String(newVal);
          await saveGames(target, newVal);
        });
      });

      const handleServeChange = async (server) => {
        await setServe(server);
      };

      ["servePlayer1", "servePlayer1Stats"].forEach((idEl) => {
        document.getElementById(idEl)?.addEventListener("change", () => handleServeChange("player1"));
      });
      ["servePlayer2", "servePlayer2Manual"].forEach((idEl) => {
        document.getElementById(idEl)?.addEventListener("change", () => handleServeChange("player2"));
      });

      serveOption1?.addEventListener("click", () => setServe("player1"));
      serveOption2?.addEventListener("click", () => setServe("player2"));
      manualServeOption1?.addEventListener("click", () => setServe("player1"));
      manualServeOption2?.addEventListener("click", () => setServe("player2"));
    }

    function loadMatch() {
      if (!id) return setMsg("ID da partida não informado.", "error");
      __db.collection("matches").doc(id).onSnapshot(
        (snap) => {
          if (!snap.exists) return setMsg("Partida não encontrada.", "error");
          renderMatch(snap.data());
        },
        (err) => {
          console.error(err);
          setMsg(err.message || "Erro ao carregar partida.", "error");
        }
      );
    }

    function init() {
      bindButtons();
      bindStatsButtonFlash();
      loadMatch();
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => PlayerApp.init());
})();
