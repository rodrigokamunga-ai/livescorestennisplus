function normalizeText(text) {
  return String(text || "").toLowerCase().trim();
}

function noAdEnabled(matchFormat) {
  return normalizeText(matchFormat).includes("sem vantagem");
}

function advantageEnabled(matchFormat) {
  return normalizeText(matchFormat).includes("com vantagem");
}

function isOneSetSuper10(matchFormat) {
  const text = normalizeText(matchFormat);
  return text.includes("1 set") && text.includes("supertiebreak de 10 pontos");
}

function isTwoSetsSuper10(matchFormat) {
  const text = normalizeText(matchFormat);
  return text.includes("2 sets") && text.includes("supertiebreak de 10 pontos");
}

function isPro8Super10(matchFormat) {
  const text = normalizeText(matchFormat);
  return text.includes("pro de 8 games") && text.includes("supertiebreak de 10 pontos");
}

function isAllowedFormat(matchFormat) {
  return (
    isOneSetSuper10(matchFormat) ||
    isTwoSetsSuper10(matchFormat) ||
    isPro8Super10(matchFormat)
  );
}

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

  // Regra pedida: 40x40 deve aparecer como ponto decisivo
  if (!noAd) {
    if (points1 >= 3 && points2 >= 3) {
      if (points1 === points2) return "40x40 - Ponto decisivo";
      if (points1 === points2 + 1) return "AD";
      if (points2 === points1 + 1) return "AD";
    }
    return `${getPointLabel(points1)}x${getPointLabel(points2)}`;
  }

  if (points1 === 3 && points2 === 3) {
    return "40x40 - Ponto decisivo";
  }

  return `${getPointLabel(points1)}x${getPointLabel(points2)}`;
}

function getSetTarget(matchFormat) {
  const text = normalizeText(matchFormat);
  if (text.includes("pro de 8 games")) return 8;
  return 6;
}

function getTieBreakTarget(score) {
  return score?.tieBreakMode === "super10" ? 10 : 7;
}

function getMatchSetsToWin(matchFormat) {
  const text = normalizeText(matchFormat);

  if (text.includes("2 sets")) return 2;
  if (text.includes("1 set")) return 1;

  return 1;
}

function isTieBreakNeeded(games1, games2, matchFormat) {
  const text = normalizeText(matchFormat);

  if (text.includes("pro de 8 games")) {
    return games1 === 7 && games2 === 7;
  }

  return games1 === 6 && games2 === 6;
}

function isSetWon(games1, games2, matchFormat) {
  const diff = Math.abs(games1 - games2);

  if (normalizeText(matchFormat).includes("pro de 8 games")) {
    return (games1 >= 8 || games2 >= 8) && diff >= 2;
  }

  return (games1 >= 6 || games2 >= 6) && diff >= 2;
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

  const finishedSets = Array.isArray(score?.setHistory) ? score.setHistory.length : 0;
  return finishedSets >= 2 && score.sets1 === 1 && score.sets2 === 1;
}

function shouldUseSuper10InCurrentSet(matchFormat) {
  return isOneSetSuper10(matchFormat) || isPro8Super10(matchFormat);
}

function resolveTieBreakMode(matchFormat, score = null) {
  if (shouldStartSuper10AfterSets(matchFormat, score)) return "super10";
  return "tb7";
}

function getMatchConfig(matchFormat, score = null) {
  return {
    noAd: noAdEnabled(matchFormat),
    advantage: advantageEnabled(matchFormat),
    tieBreakMode: resolveTieBreakMode(matchFormat, score),
    setsToWin: getMatchSetsToWin(matchFormat),
    setTarget: getSetTarget(matchFormat)
  };
}

function defaultScore() {
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
    server: "player1",

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
    tieBreakMode:
      score.tieBreakMode === "tb7" || score.tieBreakMode === "super10"
        ? score.tieBreakMode
        : null,
    lastTieBreakMode:
      score.lastTieBreakMode === "tb7" || score.lastTieBreakMode === "super10"
        ? score.lastTieBreakMode
        : null,
    server: score.server || "player1",
    totalPoints1: Number(score.totalPoints1 || 0),
    totalPoints2: Number(score.totalPoints2 || 0),
    breakPointsWon1: Number(score.breakPointsWon1 || 0),
    breakPointsWon2: Number(score.breakPointsWon2 || 0),
    breakPointsChances1: Number(score.breakPointsChances1 || 0),
    breakPointsChances2: Number(score.breakPointsChances2 || 0)
  };
}

function completeGame(score, winner) {
  if (winner === 1) score.games1 += 1;
  else score.games2 += 1;

  score.points1 = 0;
  score.points2 = 0;
}

function completeSet(score, winner, fromTieBreak = false, matchFormat = "") {
  if (fromTieBreak) {
    score.lastTieBreakMode = score.tieBreakMode;
    score.lastTieBreakPoints1 = Number(score.tieBreakPoints1 || 0);
    score.lastTieBreakPoints2 = Number(score.tieBreakPoints2 || 0);
  } else {
    score.lastTieBreakMode = null;
    score.lastTieBreakPoints1 = 0;
    score.lastTieBreakPoints2 = 0;
  }

  const completedSet = {
    setNumber: score.setHistory.length + 1,
    games1: score.games1,
    games2: score.games2,
    winner,
    tieBreakMode: fromTieBreak ? score.tieBreakMode : null,
    tieBreakPoints1: fromTieBreak ? Number(score.tieBreakPoints1 || 0) : null,
    tieBreakPoints2: fromTieBreak ? Number(score.tieBreakPoints2 || 0) : null
  };

  score.setHistory.push(completedSet);

  if (winner === 1) score.sets1 += 1;
  else score.sets2 += 1;

  score.games1 = 0;
  score.games2 = 0;
  score.points1 = 0;
  score.points2 = 0;
  score.tieBreakPoints1 = 0;
  score.tieBreakPoints2 = 0;
  score.tieBreakMode = null;

  if (shouldStartSuper10AfterSets(matchFormat, score)) {
    score.tieBreakMode = "super10";
  }
}

function evaluateGame(score, matchFormat) {
  const noAd = noAdEnabled(matchFormat);

  if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
    const target = getTieBreakTarget(score);
    const winner = tieBreakWinner(score.tieBreakPoints1, score.tieBreakPoints2, target);

    if (winner) {
      completeSet(score, winner, true, matchFormat);
      return { gameWon: false, setWon: true, winner };
    }

    return { gameWon: false, setWon: false, winner: 0 };
  }

  if (!noAd) {
    // Regra de vantagem normal.
    // No momento em que um jogador abre 2 pontos após o 40x40, o game fecha.
    if (
      (score.points1 >= 4 || score.points2 >= 4) &&
      Math.abs(score.points1 - score.points2) >= 2
    ) {
      const winner = score.points1 > score.points2 ? 1 : 2;
      completeGame(score, winner);
      return { gameWon: true, setWon: false, winner };
    }

    return { gameWon: false, setWon: false, winner: 0 };
  }

  // No-ad
  if (score.points1 === 3 && score.points2 === 3) {
    return { gameWon: false, setWon: false, winner: 0 };
  }

  if (score.points1 >= 4 || score.points2 >= 4) {
    const winner = score.points1 > score.points2 ? 1 : 2;
    completeGame(score, winner);
    return { gameWon: true, setWon: false, winner };
  }

  return { gameWon: false, setWon: false, winner: 0 };
}

function evaluateSet(score, matchFormat) {
  if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
    const target = getTieBreakTarget(score);
    const winner = tieBreakWinner(score.tieBreakPoints1, score.tieBreakPoints2, target);

    if (winner) {
      completeSet(score, winner, true, matchFormat);
      return { setWon: true, winner, tieBreakStarted: false };
    }

    return { setWon: false, winner: 0, tieBreakStarted: false };
  }

  if (shouldStartSuper10AfterSets(matchFormat, score)) {
    score.tieBreakMode = "super10";
    score.tieBreakPoints1 = 0;
    score.tieBreakPoints2 = 0;
    score.points1 = 0;
    score.points2 = 0;
    return { setWon: false, winner: 0, tieBreakStarted: true };
  }

  if (isTieBreakNeeded(score.games1, score.games2, matchFormat)) {
    if (shouldUseSuper10InCurrentSet(matchFormat)) {
      score.tieBreakMode = "super10";
    } else {
      score.tieBreakMode = "tb7";
    }

    score.tieBreakPoints1 = 0;
    score.tieBreakPoints2 = 0;
    score.points1 = 0;
    score.points2 = 0;

    return { setWon: false, winner: 0, tieBreakStarted: true };
  }

  if (isSetWon(score.games1, score.games2, matchFormat)) {
    const winner = score.games1 > score.games2 ? 1 : 2;
    completeSet(score, winner, false, matchFormat);
    return { setWon: true, winner, tieBreakStarted: false };
  }

  return { setWon: false, winner: 0, tieBreakStarted: false };
}

function updateScoreWithPoint(score, player, matchFormat) {
  if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
    if (player === 1) score.tieBreakPoints1 += 1;
    if (player === 2) score.tieBreakPoints2 += 1;

    const setResult = evaluateSet(score, matchFormat);
    return {
      score,
      gameWon: false,
      setWon: setResult.setWon,
      winner: setResult.winner,
      tieBreakStarted: setResult.tieBreakStarted || false
    };
  }

  if (player === 1) score.points1 += 1;
  if (player === 2) score.points2 += 1;

  const gameResult = evaluateGame(score, matchFormat);
  if (gameResult.gameWon) {
    const setResult = evaluateSet(score, matchFormat);
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
}

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