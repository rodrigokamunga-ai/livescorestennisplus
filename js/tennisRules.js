// =========================================================
// TENNIS RULES — Regras completas de todos os formatos
// =========================================================

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const FORMAT_LEGACY_MAP = {
  "1 set sem vantagem + um supertiebreak de 10 pontos":               "1 set no AD + um super tie-break",
  "1 set no ad + um super tie-break":                                 "1 set no AD + um super tie-break",
  "2 sets sem vantagem + um supertiebreak de 10 pontos":              "2 sets sem vantagem + um super tie-break",
  "2 sets sem vantagem + um super tie-break":                         "2 sets sem vantagem + um super tie-break",
  "2 sets com vantagem + um supertiebreak de 10 pontos":              "2 sets com vantagem + um super tie-break",
  "2 sets com vantagem + um super tie-break":                         "2 sets com vantagem + um super tie-break",
  "3 sets com vantagem":                                              "3 sets com vantagem",
  "1 set com vantagem":                                               "1 set com vantagem",
  "1 set pro de 8 games sem vantagem + um supertiebreak de 10 pontos":"1 set pro de 8 games no AD + um super tie-break",
  "1 set pro de 8 games no ad + um super tie-break":                  "1 set pro de 8 games no AD + um super tie-break"
};

function normalizeFormat(matchFormat) {
  const key = normalizeText(matchFormat);
  return FORMAT_LEGACY_MAP[key] || String(matchFormat || "").trim();
}

// ─── Detecção de formato ──────────────────────────────────

function noAdEnabled(matchFormat) {
  const fmt = normalizeText(normalizeFormat(matchFormat));
  return (
    fmt.includes("sem vantagem") ||
    fmt.includes("no ad")        ||
    fmt.includes("no-ad")
  );
}

function advantageEnabled(matchFormat) {
  const fmt = normalizeText(normalizeFormat(matchFormat));
  return fmt.includes("com vantagem") || fmt.includes("3 sets");
}

function isOneSetSuper10(matchFormat) {
  const fmt = normalizeText(normalizeFormat(matchFormat));
  return (
    fmt.includes("1 set") &&
    !fmt.includes("2 sets") &&
    !fmt.includes("3 sets") &&
    !fmt.includes("pro de 8") &&
    (fmt.includes("super tie-break") || fmt.includes("supertiebreak"))
  );
}

function isTwoSetsSuper10(matchFormat) {
  const fmt = normalizeText(normalizeFormat(matchFormat));
  return (
    fmt.includes("2 sets") &&
    (fmt.includes("super tie-break") || fmt.includes("supertiebreak"))
  );
}

function isPro8Super10(matchFormat) {
  const fmt = normalizeText(normalizeFormat(matchFormat));
  return (
    fmt.includes("pro de 8") &&
    (fmt.includes("super tie-break") || fmt.includes("supertiebreak"))
  );
}

function isThreeSets(matchFormat) {
  return normalizeText(normalizeFormat(matchFormat)).includes("3 sets");
}

function isOneSetAdvantage(matchFormat) {
  const fmt = normalizeText(normalizeFormat(matchFormat));
  return (
    fmt.includes("1 set") &&
    fmt.includes("com vantagem") &&
    !fmt.includes("super tie-break") &&
    !fmt.includes("supertiebreak")
  );
}

function isAllowedFormat(matchFormat) {
  return (
    isOneSetSuper10(matchFormat)   ||
    isTwoSetsSuper10(matchFormat)  ||
    isPro8Super10(matchFormat)     ||
    isThreeSets(matchFormat)       ||
    isOneSetAdvantage(matchFormat)
  );
}

// ─── Helpers ──────────────────────────────────────────────

function getCurrentSetNumber(score) {
  return (score?.setHistory?.length || 0) + 1;
}

function getPointLabel(points) {
  if (points <= 0) return "0";
  if (points === 1) return "15";
  if (points === 2) return "30";
  return "40";
}

function getPointDisplay(points1, points2, matchFormat, score = null) {
  if (score && (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10")) {
    return `${score.tieBreakPoints1 || 0}x${score.tieBreakPoints2 || 0}`;
  }

  const noAd = noAdEnabled(matchFormat);
  const adv  = advantageEnabled(matchFormat);

  if (adv && !noAd) {
    if (score?.advantage === "player1") return "AD - J1";
    if (score?.advantage === "player2") return "AD - J2";
    if (points1 >= 3 && points2 >= 3) {
      if (points1 === points2) return "40x40";
      if (points1 > points2)  return "AD - J1";
      if (points2 > points1)  return "AD - J2";
    }
    return `${getPointLabel(points1)}x${getPointLabel(points2)}`;
  }

  if (noAd) {
    if (points1 === 3 && points2 === 3) return "40x40 — Decisivo";
    return `${getPointLabel(points1)}x${getPointLabel(points2)}`;
  }

  // fallback
  if (score?.advantage === "player1") return "AD - J1";
  if (score?.advantage === "player2") return "AD - J2";
  if (points1 >= 3 && points2 >= 3) {
    if (points1 === points2) return "40x40";
    if (points1 > points2)  return "AD - J1";
    if (points2 > points1)  return "AD - J2";
  }
  return `${getPointLabel(points1)}x${getPointLabel(points2)}`;
}

// ─── Configuração do formato ──────────────────────────────

function getSetTarget(matchFormat) {
  const fmt = normalizeText(normalizeFormat(matchFormat));
  if (fmt.includes("pro de 8")) return 8;
  return 6;
}

function getTieBreakTarget(score) {
  return score?.tieBreakMode === "super10" ? 10 : 7;
}

function getMatchSetsToWin(matchFormat) {
  const fmt = normalizeText(normalizeFormat(matchFormat));
  if (fmt.includes("3 sets")) return 2;
  if (fmt.includes("2 sets")) return 2;
  return 1;
}

// ✅ CORRIGIDO: tie-break inicia em 6x6 (ou 8x8 para PRO 8)
function isTieBreakNeeded(games1, games2, matchFormat) {
  const fmt = normalizeText(normalizeFormat(matchFormat));
  if (fmt.includes("pro de 8")) return games1 === 8 && games2 === 8;
  return games1 === 6 && games2 === 6;
}

// ✅ CORRIGIDO: set encerra quando um jogador tem 6 (ou 8) com diferença de 2
function isSetWon(games1, games2, matchFormat) {
  const fmt = normalizeText(normalizeFormat(matchFormat));

  if (fmt.includes("pro de 8")) {
    // PRO 8: encerra em 8x6, 9x7, 10x8...
    if (games1 >= 8 && games1 - games2 >= 2) return true;
    if (games2 >= 8 && games2 - games1 >= 2) return true;
    return false;
  }

  // Padrão: encerra em 6x0, 6x1, 6x2, 6x3, 6x4, 7x5...
  if (games1 >= 6 && games1 - games2 >= 2) return true;
  if (games2 >= 6 && games2 - games1 >= 2) return true;
  return false;
}

function tieBreakWinner(tb1, tb2, targetPoints) {
  const diff = Math.abs(tb1 - tb2);
  if (targetPoints && (tb1 >= targetPoints || tb2 >= targetPoints) && diff >= 2) {
    return tb1 > tb2 ? 1 : 2;
  }
  return 0;
}

function shouldStartSuper10AfterSets(matchFormat, score) {
  if (!isTwoSetsSuper10(matchFormat)) return false;
  const finished = Array.isArray(score?.setHistory) ? score.setHistory.length : 0;
  return finished >= 2 && score.sets1 === 1 && score.sets2 === 1;
}

function shouldUseSuper10InCurrentSet(matchFormat) {
  return isOneSetSuper10(matchFormat) || isPro8Super10(matchFormat);
}

function resolveTieBreakMode(matchFormat, score = null) {
  if (shouldStartSuper10AfterSets(matchFormat, score)) return "super10";
  if (shouldUseSuper10InCurrentSet(matchFormat))       return "super10";
  return "tb7";
}

function getMatchConfig(matchFormat, score = null) {
  return {
    noAd:         noAdEnabled(matchFormat),
    advantage:    advantageEnabled(matchFormat),
    tieBreakMode: resolveTieBreakMode(matchFormat, score),
    setsToWin:    getMatchSetsToWin(matchFormat),
    setTarget:    getSetTarget(matchFormat)
  };
}

// ─── Score padrão ─────────────────────────────────────────

function defaultScore() {
  return {
    points1: 0, points2: 0,
    games1:  0, games2:  0,
    sets1:   0, sets2:   0,
    tieBreakMode:        null,
    tieBreakPoints1:     0,
    tieBreakPoints2:     0,
    lastTieBreakMode:    null,
    lastTieBreakPoints1: 0,
    lastTieBreakPoints2: 0,
    setHistory:          [],
    server:              "player1",
    advantage:           null,
    totalPoints1:        0,
    totalPoints2:        0,
    breakPointsWon1:     0,
    breakPointsWon2:     0,
    breakPointsChances1: 0,
    breakPointsChances2: 0
  };
}

function normalizeScore(score = {}) {
  return {
    ...defaultScore(),
    ...score,
    setHistory:   Array.isArray(score.setHistory) ? score.setHistory : [],
    tieBreakMode: score.tieBreakMode === "tb7" || score.tieBreakMode === "super10"
      ? score.tieBreakMode : null,
    lastTieBreakMode: score.lastTieBreakMode === "tb7" || score.lastTieBreakMode === "super10"
      ? score.lastTieBreakMode : null,
    server:              score.server    || "player1",
    advantage:           score.advantage || null,
    totalPoints1:        Number(score.totalPoints1        || 0),
    totalPoints2:        Number(score.totalPoints2        || 0),
    breakPointsWon1:     Number(score.breakPointsWon1     || 0),
    breakPointsWon2:     Number(score.breakPointsWon2     || 0),
    breakPointsChances1: Number(score.breakPointsChances1 || 0),
    breakPointsChances2: Number(score.breakPointsChances2 || 0)
  };
}

// ─── Progressão ───────────────────────────────────────────

function completeGame(score, winner) {
  winner === 1 ? score.games1++ : score.games2++;
  score.points1   = 0;
  score.points2   = 0;
  score.advantage = null;
}

function completeSet(score, winner, fromTieBreak = false, matchFormat = "") {
  if (fromTieBreak) {
    score.lastTieBreakMode    = score.tieBreakMode;
    score.lastTieBreakPoints1 = Number(score.tieBreakPoints1 || 0);
    score.lastTieBreakPoints2 = Number(score.tieBreakPoints2 || 0);
  } else {
    score.lastTieBreakMode    = null;
    score.lastTieBreakPoints1 = 0;
    score.lastTieBreakPoints2 = 0;
  }

  score.setHistory.push({
    setNumber:       score.setHistory.length + 1,
    games1:          score.games1,
    games2:          score.games2,
    winner,
    tieBreakMode:    fromTieBreak ? score.tieBreakMode : null,
    tieBreakPoints1: fromTieBreak ? Number(score.tieBreakPoints1 || 0) : null,
    tieBreakPoints2: fromTieBreak ? Number(score.tieBreakPoints2 || 0) : null
  });

  winner === 1 ? score.sets1++ : score.sets2++;

  score.games1          = 0;
  score.games2          = 0;
  score.points1         = 0;
  score.points2         = 0;
  score.tieBreakPoints1 = 0;
  score.tieBreakPoints2 = 0;
  score.tieBreakMode    = null;
  score.advantage       = null;

  if (shouldStartSuper10AfterSets(matchFormat, score)) {
    score.tieBreakMode    = "super10";
    score.tieBreakPoints1 = 0;
    score.tieBreakPoints2 = 0;
  }
}

// ─── Avaliação do game ────────────────────────────────────

// ✅ CORRIGIDO: separado por formato, sem misturar lógica AD/No AD
function evaluateGame(score, matchFormat) {
  const noAd = noAdEnabled(matchFormat);
  const adv  = advantageEnabled(matchFormat);

  // Tie-break ativo
  if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
    const target = getTieBreakTarget(score);
    const winner = tieBreakWinner(score.tieBreakPoints1, score.tieBreakPoints2, target);
    if (winner) {
      completeSet(score, winner, true, matchFormat);
      return { gameWon: false, setWon: true, winner };
    }
    return { gameWon: false, setWon: false, winner: 0 };
  }

  // Sem vantagem (No AD): 40x40 já foi tratado em updateScoreWithPoint
  if (noAd) {
    if (score.points1 >= 4) {
      completeGame(score, 1);
      return { gameWon: true, setWon: false, winner: 1 };
    }
    if (score.points2 >= 4) {
      completeGame(score, 2);
      return { gameWon: true, setWon: false, winner: 2 };
    }
    return { gameWon: false, setWon: false, winner: 0 };
  }

  // Com vantagem (AD): deuce/vantagem já tratados em updateScoreWithPoint
  if (adv) {
    if (score.points1 >= 4 && score.points1 - score.points2 >= 2) {
      completeGame(score, 1);
      return { gameWon: true, setWon: false, winner: 1 };
    }
    if (score.points2 >= 4 && score.points2 - score.points1 >= 2) {
      completeGame(score, 2);
      return { gameWon: true, setWon: false, winner: 2 };
    }
    return { gameWon: false, setWon: false, winner: 0 };
  }

  // Fallback
  if (score.points1 >= 4 && score.points1 - score.points2 >= 2) {
    completeGame(score, 1);
    return { gameWon: true, setWon: false, winner: 1 };
  }
  if (score.points2 >= 4 && score.points2 - score.points1 >= 2) {
    completeGame(score, 2);
    return { gameWon: true, setWon: false, winner: 2 };
  }
  return { gameWon: false, setWon: false, winner: 0 };
}

// ─── Avaliação do set ─────────────────────────────────────

function evaluateSet(score, matchFormat) {
  // Tie-break ativo
  if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
    const target = getTieBreakTarget(score);
    const winner = tieBreakWinner(score.tieBreakPoints1, score.tieBreakPoints2, target);
    if (winner) {
      completeSet(score, winner, true, matchFormat);
      return { setWon: true, winner, tieBreakStarted: false };
    }
    return { setWon: false, winner: 0, tieBreakStarted: false };
  }

  // Super tie-break após 1x1 nos sets
  if (shouldStartSuper10AfterSets(matchFormat, score)) {
    score.tieBreakMode    = "super10";
    score.tieBreakPoints1 = 0;
    score.tieBreakPoints2 = 0;
    score.points1         = 0;
    score.points2         = 0;
    return { setWon: false, winner: 0, tieBreakStarted: true };
  }

  // Tie-break necessário (6x6 ou 8x8)
  if (isTieBreakNeeded(score.games1, score.games2, matchFormat)) {
    score.tieBreakMode    = shouldUseSuper10InCurrentSet(matchFormat) ? "super10" : "tb7";
    score.tieBreakPoints1 = 0;
    score.tieBreakPoints2 = 0;
    score.points1         = 0;
    score.points2         = 0;
    return { setWon: false, winner: 0, tieBreakStarted: true };
  }

  // ✅ CORRIGIDO: verifica se o set foi vencido normalmente
  if (isSetWon(score.games1, score.games2, matchFormat)) {
    const winner = score.games1 > score.games2 ? 1 : 2;
    completeSet(score, winner, false, matchFormat);
    return { setWon: true, winner, tieBreakStarted: false };
  }

  return { setWon: false, winner: 0, tieBreakStarted: false };
}

// ─── Função principal: aplica ponto ──────────────────────

function updateScoreWithPoint(score, player, matchFormat) {
  const noAd = noAdEnabled(matchFormat);
  const adv  = advantageEnabled(matchFormat);

  // ── Tie-break ──────────────────────────────────────────
  if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
    player === 1 ? score.tieBreakPoints1++ : score.tieBreakPoints2++;
    const setResult = evaluateSet(score, matchFormat);
    return {
      score,
      gameWon:         false,
      setWon:          setResult.setWon,
      winner:          setResult.winner,
      tieBreakStarted: setResult.tieBreakStarted || false
    };
  }

  // ── Com vantagem (AD) ──────────────────────────────────
  if (adv && !noAd) {
    const p1 = score.points1;
    const p2 = score.points2;

    // Deuce → vantagem
    if (p1 === 3 && p2 === 3 && score.advantage === null) {
      score.advantage = player === 1 ? "player1" : "player2";
      return { score, gameWon: false, setWon: false, winner: 0, tieBreakStarted: false };
    }

    // Com vantagem
    if (score.advantage !== null) {
      const advPlayer = score.advantage === "player1" ? 1 : 2;
      if (player === advPlayer) {
        // Vence o game
        score.advantage = null;
        completeGame(score, player);
        const setResult = evaluateSet(score, matchFormat);
        return {
          score,
          gameWon:         true,
          setWon:          setResult.setWon,
          winner:          player,
          tieBreakStarted: setResult.tieBreakStarted || false
        };
      } else {
        // Volta ao deuce
        score.advantage = null;
        return { score, gameWon: false, setWon: false, winner: 0, tieBreakStarted: false };
      }
    }

    // Progressão normal
    player === 1 ? score.points1++ : score.points2++;
    const gameResult = evaluateGame(score, matchFormat);
    if (gameResult.gameWon) {
      const setResult = evaluateSet(score, matchFormat);
      return {
        score,
        gameWon:         true,
        setWon:          setResult.setWon,
        winner:          gameResult.winner,
        tieBreakStarted: setResult.tieBreakStarted || false
      };
    }
    return { score, gameWon: false, setWon: false, winner: 0, tieBreakStarted: false };
  }

  // ── Sem vantagem (No AD) ───────────────────────────────
  if (noAd) {
    // 40x40 → próximo ponto vence
    if (score.points1 === 3 && score.points2 === 3) {
      score.advantage = null;
      completeGame(score, player);
      const setResult = evaluateSet(score, matchFormat);
      return {
        score,
        gameWon:         true,
        setWon:          setResult.setWon,
        winner:          player,
        tieBreakStarted: setResult.tieBreakStarted || false
      };
    }

    player === 1 ? score.points1++ : score.points2++;
    const gameResult = evaluateGame(score, matchFormat);
    if (gameResult.gameWon) {
      const setResult = evaluateSet(score, matchFormat);
      return {
        score,
        gameWon:         true,
        setWon:          setResult.setWon,
        winner:          gameResult.winner,
        tieBreakStarted: setResult.tieBreakStarted || false
      };
    }
    return { score, gameWon: false, setWon: false, winner: 0, tieBreakStarted: false };
  }

  // ── Fallback ───────────────────────────────────────────
  player === 1 ? score.points1++ : score.points2++;
  const gameResult = evaluateGame(score, matchFormat);
  if (gameResult.gameWon) {
    const setResult = evaluateSet(score, matchFormat);
    return {
      score,
      gameWon:         true,
      setWon:          setResult.setWon,
      winner:          gameResult.winner,
      tieBreakStarted: setResult.tieBreakStarted || false
    };
  }
  return { score, gameWon: false, setWon: false, winner: 0, tieBreakStarted: false };
}

// ─── Fim de partida ───────────────────────────────────────

function isMatchFinished(score, matchFormat) {
  const config = getMatchConfig(matchFormat, score);
  return score.sets1 >= config.setsToWin || score.sets2 >= config.setsToWin;
}

function getMatchWinner(score, matchFormat) {
  const config = getMatchConfig(matchFormat, score);
  if (score.sets1 >= config.setsToWin) return 1;
  if (score.sets2 >= config.setsToWin) return 2;
  return 0;
}