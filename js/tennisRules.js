function normalizeText(text) {
  return String(text || "").toLowerCase().trim();
}

function noAdEnabled(matchFormat) {
  return normalizeText(matchFormat).includes("sem vantagem");
}

function advantageEnabled(matchFormat) {
  return normalizeText(matchFormat).includes("com vantagem");
}

function isProSet(matchFormat) {
  return normalizeText(matchFormat).includes("pro de 8 games");
}

function isSetOf4Games(matchFormat) {
  return normalizeText(matchFormat).includes("4 games");
}

function getCurrentSetNumber(score) {
  return (score?.setHistory?.length || 0) + 1;
}

function resolveTieBreakMode(matchFormat, score = null) {
  const setNumber = getCurrentSetNumber(score);

  if (setNumber === 3) return "super10";
  return "tb7";
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

  if (!noAd) {
    if (points1 >= 3 && points2 >= 3) {
      if (points1 === points2) return "DEUCE";
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
  if (isProSet(matchFormat)) return 8;
  if (isSetOf4Games(matchFormat)) return 4;
  return 6;
}

function getTieBreakTarget(score) {
  if (score?.tieBreakMode === "tb7") return 7;
  if (score?.tieBreakMode === "super10") return 10;
  return null;
}

function isTieBreakNeeded(games1, games2, matchFormat, score = null) {
  if (isProSet(matchFormat)) return false;

  if (isSetOf4Games(matchFormat)) {
    return games1 === 3 && games2 === 3;
  }

  // Regra final: em 6x6 entra tiebreak de 7 pontos
  return games1 === 6 && games2 === 6;
}

function isSetWon(games1, games2, matchFormat) {
  const diff = Math.abs(games1 - games2);

  if (isSetOf4Games(matchFormat)) {
    return (games1 >= 4 || games2 >= 4) && diff >= 2;
  }

  if (isProSet(matchFormat)) {
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

function getMatchSetsToWin(matchFormat) {
  const text = normalizeText(matchFormat);

  if (
    text.includes("1 set com vantagem") ||
    text.includes("1 set sem vantagem") ||
    text.includes("1 set pro")
  ) {
    return 1;
  }

  return 2;
}

function getMatchConfig(matchFormat, score = null) {
  return {
    noAd: noAdEnabled(matchFormat),
    advantage: advantageEnabled(matchFormat),
    tieBreakMode: resolveTieBreakMode(matchFormat, score),
    proSet8: isProSet(matchFormat),
    setOf4Games: isSetOf4Games(matchFormat),
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
    setHistory: [],
    server: "player1"
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
    server: score.server || "player1"
  };
}

function addPoint(score, player) {
  if (player === 1) score.points1 += 1;
  if (player === 2) score.points2 += 1;
}

function removePoint(score, player) {
  if (player === 1) score.points1 = Math.max(0, score.points1 - 1);
  if (player === 2) score.points2 = Math.max(0, score.points2 - 1);
}

function completeGame(score, winner) {
  if (winner === 1) score.games1 += 1;
  else score.games2 += 1;

  score.points1 = 0;
  score.points2 = 0;
}

function completeSet(score, winner, fromTieBreak = false) {
  if (fromTieBreak) {
    if (winner === 1) score.games1 += 1;
    if (winner === 2) score.games2 += 1;
  }

  const completedSet = {
    setNumber: score.setHistory.length + 1,
    games1: score.games1,
    games2: score.games2,
    winner
  };

  score.setHistory.push(completedSet);

  if (winner === 1) score.sets1 += 1;
  else score.sets2 += 1;

  score.games1 = 0;
  score.games2 = 0;
  score.points1 = 0;
  score.points2 = 0;
  score.tieBreakMode = null;
  score.tieBreakPoints1 = 0;
  score.tieBreakPoints2 = 0;
}

function evaluateGame(score, matchFormat) {
  const noAd = noAdEnabled(matchFormat);

  if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
    const target = getTieBreakTarget(score);
    const winner = tieBreakWinner(score.tieBreakPoints1, score.tieBreakPoints2, target);

    if (winner) {
      completeSet(score, winner, true);
      return { gameWon: false, setWon: true, winner };
    }

    return { gameWon: false, setWon: false, winner: 0 };
  }

  if (!noAd) {
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
      completeSet(score, winner, true);
      return { setWon: true, winner, tieBreakStarted: false };
    }

    return { setWon: false, winner: 0, tieBreakStarted: false };
  }

  if (isSetWon(score.games1, score.games2, matchFormat)) {
    const winner = score.games1 > score.games2 ? 1 : 2;
    completeSet(score, winner, false);
    return { setWon: true, winner, tieBreakStarted: false };
  }

  if (isTieBreakNeeded(score.games1, score.games2, matchFormat, score)) {
    score.tieBreakMode = resolveTieBreakMode(matchFormat, score);
    score.tieBreakPoints1 = 0;
    score.tieBreakPoints2 = 0;
    score.points1 = 0;
    score.points2 = 0;

    return { setWon: false, winner: 0, tieBreakStarted: true };
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

  addPoint(score, player);

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