(() => {
  "use strict";

  const db = firebase.firestore();
  const auth = firebase.auth();

  const params = new URLSearchParams(window.location.search);
  const urlMatchId = params.get("id") || "";

  const STORAGE_KEYS = {
    p1: "matchReport_p1Collapsed",
    p2: "matchReport_p2Collapsed",
    comp: "matchReport_compCollapsed",
    chart: "matchReport_chartCollapsed",
    year: "matchReport_yearFilter",
    type: "matchReport_matchTypeFilter",
    opponent: "matchReport_opponentFilter",
    match: "matchReport_matchFilter",
    viewMode: "matchReport_viewMode",
    filters: "matchReport_filtersCollapsed"
  };

  let currentMatch = null;
  let pieChart = null;
  let lastChartSignature = "";
  let allFinishedMatches = [];
  let selectedYear = "";
  let selectedType = "";
  let selectedOpponent = "";
  let selectedMatchId = "";
  let currentUser = null;

  function num(v) {
    return Number(v || 0);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  }

  function formatTime(totalSeconds) {
    const sec = Math.max(0, Number(totalSeconds || 0));
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  function formatDateBR(value) {
    if (!value) return "-";

    if (value?.toDate && typeof value.toDate === "function") {
      const d = value.toDate();
      return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("pt-BR");
    }

    const str = String(value);
    const d = new Date(str.includes("T") ? str : `${str}T00:00:00`);
    if (isNaN(d.getTime())) return str;

    return d.toLocaleDateString("pt-BR");
  }

  function getCategoriaNome(m) {
    return m?.categoryName || m?.categoriaNome || m?.cat || "-";
  }

  function getFormatLabel(code) {
    const v = String(code || "").trim();
    if (!v) return "-";
    return v;
  }

  function getMatchStatus(m) {
    return String(m?.status || "").trim().toLowerCase();
  }

  function isFinishedStatus(status) {
    return ["finished", "wo", "ret"].includes(String(status || "").trim().toLowerCase());
  }

  function getGameFormat(match) {
    return String(match?.gameFormat || match?.modality || match?.gameType || match?.gameTypeName || "Simples").trim();
  }

  function isDoublesFormat(match) {
    return getGameFormat(match).toLowerCase().includes("duplas");
  }

  function getMatchType(match) {
    return isDoublesFormat(match) ? "duplas" : "simples";
  }

  function getPlayerNames(match) {
    return {
      p1: String(match?.player1 || match?.n1 || "Jogador 1").trim(),
      p2: String(match?.player2 || match?.n2 || "Jogador 2").trim(),
      p3: String(match?.player3 || match?.n3 || "Jogador 3").trim(),
      p4: String(match?.player4 || match?.n4 || "Jogador 4").trim()
    };
  }

  function getTeamNames(match) {
    const names = getPlayerNames(match);

    if (!isDoublesFormat(match)) {
      return {
        team1: names.p1,
        team2: names.p2
      };
    }

    return {
      team1: `${names.p1} / ${names.p2}`,
      team2: `${names.p3} / ${names.p4}`
    };
  }

  function getOpponentName(match, myUid) {
    const names = getPlayerNames(match);
    const ownerId = String(match?.ownerId || "");

    const p1uid = String(match?.player1Uid || match?.uid1 || match?.ownerPlayer1Uid || "");
    const p2uid = String(match?.player2Uid || match?.uid2 || match?.ownerPlayer2Uid || "");
    const p3uid = String(match?.player3Uid || match?.uid3 || match?.ownerPlayer3Uid || "");
    const p4uid = String(match?.player4Uid || match?.uid4 || match?.ownerPlayer4Uid || "");

    if (!isDoublesFormat(match)) {
      if (p1uid && String(myUid) === p1uid) return names.p2;
      if (p2uid && String(myUid) === p2uid) return names.p1;
      if (ownerId && ownerId === String(myUid)) return names.p2;
      return names.p2;
    }

    if (p1uid && p2uid) {
      if (String(myUid) === p1uid || String(myUid) === p2uid) return `${names.p3} / ${names.p4}`;
      if (String(myUid) === p3uid || String(myUid) === p4uid) return `${names.p1} / ${names.p2}`;
    }

    if (ownerId && ownerId === String(myUid)) {
      return `${names.p3} / ${names.p4}`;
    }

    return `${names.p3} / ${names.p4}`;
  }

  function getMatchDateValue(match) {
    const candidates = [
      match?.finishedAt,
      match?.dataPartida,
      match?.matchDateTime,
      match?.createdAt,
      match?.updatedAt,
      match?.startedAt
    ];

    for (const value of candidates) {
      if (!value) continue;
      const d = value?.toDate && typeof value.toDate === "function" ? value.toDate() : new Date(value);
      if (!isNaN(d.getTime())) return d;
    }

    return null;
  }

  function getMatchDateLabel(match) {
    const d = getMatchDateValue(match);
    return d ? d.toLocaleDateString("pt-BR") : "-";
  }

  function getMatchLabel(match) {
    const names = getTeamNames(match);
    return `${names.team1} X ${names.team2} - ${getMatchDateLabel(match)}`;
  }

  function getScore(match) {
    return match?.score || {};
  }

  function getMatchTeamStats(match) {
    return {
      team1: match?.stats?.player1 || {},
      team2: match?.stats?.player2 || {}
    };
  }

  function getWinnerName(match) {
    const score = getScore(match);
    const names = getTeamNames(match);

    if (match?.status === "wo") {
      if (String(match?.winnerByWO || "") === "player1") return names.team1;
      if (String(match?.winnerByWO || "") === "player2") return names.team2;
    }

    if (match?.status === "ret") {
      if (String(match?.winnerByRet || "") === "player1") return names.team2;
      if (String(match?.winnerByRet || "") === "player2") return names.team1;
    }

    if (num(score.sets1) > num(score.sets2)) return names.team1;
    if (num(score.sets2) > num(score.sets1)) return names.team2;

    if (num(score.totalPoints1) > num(score.totalPoints2)) return names.team1;
    if (num(score.totalPoints2) > num(score.totalPoints1)) return names.team2;

    return "-";
  }

  function getBreakPointsText(score) {
    return `${num(score.breakPointsWon1)}/${num(score.breakPointsChances1)} x ${num(score.breakPointsWon2)}/${num(score.breakPointsChances2)}`;
  }

  function pct(won, attempts) {
    const a = num(attempts);
    if (a <= 0) return "0%";
    return `${Math.round((num(won) / a) * 100)}%`;
  }

  function perfScore(score) {
    const p1 = num(score.totalPoints1);
    const p2 = num(score.totalPoints2);
    const total = p1 + p2;
    if (total === 0) return 0.0;

    let s = 5 + ((p1 - p2) / total) * 5;
    s = Math.max(0, Math.min(10, s));
    return Math.round(s * 10) / 10;
  }

  function calcWinners(st) {
    return (
      num(st?.ace) +
      num(st?.dropshotWinner) +
      num(st?.smashWinner) +
      num(st?.voleioWinner) +
      num(st?.forehandWinner) +
      num(st?.backhandWinner) +
      num(st?.returnPoint) +
      num(st?.baselinePoint)
    );
  }

  function calcErrorsNF(st) {
    return (
      num(st?.doubleFault) +
      num(st?.dropshotError) +
      num(st?.smashError) +
      num(st?.voleioError) +
      num(st?.forehandError) +
      num(st?.backhandError) +
      num(st?.returnError) +
      num(st?.baselineError) +
      num(st?.forcedError)
    );
  }

  function calcNetPoints(st) {
    return num(st?.smashWinner) + num(st?.voleioWinner) + num(st?.dropshotWinner);
  }

  function calcNetErrors(st) {
    return num(st?.smashError) + num(st?.voleioError) + num(st?.dropshotError);
  }

  function getGamesValue(score, side) {
    const direct = side === 1 ? score?.games1 : score?.games2;
    if (direct !== undefined && direct !== null && direct !== "") return num(direct);

    const fallback =
      side === 1
        ? (score?.gamesWon1 || score?.setsGames1 || score?.games || 0)
        : (score?.gamesWon2 || score?.setsGames2 || score?.games || 0);

    return num(fallback);
  }

  function getMatchHeaderData(match) {
    return {
      phase:
        match?.["Fase do torneio, treino ou ranking"] ||
        match?.tournamentPhase ||
        match?.faseTorneio ||
        match?.faseDoTorneio ||
        match?.phase ||
        match?.categoryPhase ||
        match?.tipoFase ||
        "-",
      tournament: match?.tournamentName || match?.nomeTorneio || match?.tournament || "-",
      category: getCategoriaNome(match),
      surface: match?.courtSurface || match?.tipoPiso || match?.surface || "-",
      format: getFormatLabel(match?.matchFormat || match?.gameFormat),
      datetime: (() => {
        const d = getMatchDateValue(match);
        if (!d) return "-";
        const date = d.toLocaleDateString("pt-BR");
        const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        return `${date} ${time}`;
      })(),
      court: match?.court || match?.quadra || "-",
      duration: formatTime(match?.durationSeconds || match?.accumulatedSeconds || 0)
    };
  }

  function updateMatchHeader(match) {
    const h = getMatchHeaderData(match);
    setText("meta-phase", h.phase);
    setText("meta-tournament", h.tournament);
    setText("meta-cat", h.category);
    setText("meta-surface", h.surface);
    setText("meta-format", h.format);
    setText("meta-datetime", h.datetime);
    setText("meta-court", h.court);
    setText("meta-duration", h.duration);
  }

  function updateComparisonHeaders(match) {
    const names = getTeamNames(match);
    const colP1 = document.getElementById("col-p1");
    const colP2 = document.getElementById("col-p2");

    if (colP1) colP1.textContent = names.team1;
    if (colP2) colP2.textContent = names.team2;
  }

  function setPlayerHeaderNames(match) {
    const names = getTeamNames(match);
    const winner = getWinnerName(match);

    const p1NameEl = document.getElementById("p1-name");
    const p2NameEl = document.getElementById("p2-name");
    const p1Badge = document.getElementById("p1-badge");
    const p2Badge = document.getElementById("p2-badge");

    if (p1Badge) p1Badge.textContent = names.team1;
    if (p2Badge) p2Badge.textContent = names.team2;

    if (p1NameEl) {
      p1NameEl.innerHTML = `${names.team1}${winner === names.team1 ? ' <span class="winner-tag">VENCEDOR</span>' : ""}`;
    }

    if (p2NameEl) {
      p2NameEl.innerHTML = `${names.team2}${winner === names.team2 ? ' <span class="winner-tag">VENCEDOR</span>' : ""}`;
    }

    updateComparisonHeaders(match);
  }

  function getLoggedUserName(user) {
    if (!user) return "Usuário";
    const name = String(user.displayName || "").trim();
    if (name) return name;

    const email = String(user.email || "").trim();
    if (email) return email.split("@")[0];

    return "Usuário";
  }

  function updatePageTitleForUser(user) {
    const pageTitle = document.getElementById("pageTitle");
    if (!pageTitle) return;
    pageTitle.textContent = `Relatórios - ${getLoggedUserName(user)}`;
  }

  function getFiltersElement() {
    return document.querySelector(".report-filters");
  }

  function updateFiltersToggleButton() {
    const btn = document.getElementById("toggleFiltersBtn");
    const filters = getFiltersElement();
    if (!btn || !filters) return;

    const hidden = filters.classList.contains("hide");
    const icon = btn.querySelector(".career-bottom-icon");
    const label = btn.querySelector(".career-bottom-label");

    if (hidden) {
      if (icon) icon.textContent = "🔎";
      if (label) label.textContent = "Filtros";
    } else {
      if (icon) icon.textContent = "📋";
      if (label) label.textContent = "Lista";
    }
  }

  function setFiltersVisible(visible) {
    const filters = getFiltersElement();
    if (!filters) return;
    filters.classList.toggle("hide", !visible);
    localStorage.setItem(STORAGE_KEYS.filters, visible ? "0" : "1");
    updateFiltersToggleButton();
  }

  function toggleFilters() {
    const filters = getFiltersElement();
    if (!filters) return;
    const shouldShow = filters.classList.contains("hide");
    setFiltersVisible(shouldShow);
  }

  function loadUIState() {
    applyCollapseState(1, localStorage.getItem(STORAGE_KEYS.p1) === "1");
    applyCollapseState(2, localStorage.getItem(STORAGE_KEYS.p2) === "1");
    applyComparisonState(localStorage.getItem(STORAGE_KEYS.comp) === "1");
    applyChartState(localStorage.getItem(STORAGE_KEYS.chart) === "1");

    const savedView = localStorage.getItem(STORAGE_KEYS.viewMode);
    const viewSel = document.getElementById("viewMode");
    if (savedView && viewSel) viewSel.value = savedView;

    const hidden = localStorage.getItem(STORAGE_KEYS.filters) === "1";
    const filters = getFiltersElement();
    if (filters) filters.classList.toggle("hide", hidden);
    updateFiltersToggleButton();
  }

  function saveUIState() {
    localStorage.setItem(STORAGE_KEYS.p1, document.getElementById("box-p1")?.classList.contains("collapsed") ? "1" : "0");
    localStorage.setItem(STORAGE_KEYS.p2, document.getElementById("box-p2")?.classList.contains("collapsed") ? "1" : "0");
    localStorage.setItem(STORAGE_KEYS.comp, document.getElementById("comparisonBody")?.classList.contains("hide") ? "1" : "0");
    localStorage.setItem(STORAGE_KEYS.chart, document.getElementById("chartBody")?.classList.contains("hide") ? "1" : "0");
    localStorage.setItem(STORAGE_KEYS.viewMode, document.getElementById("viewMode")?.value || "both");
    localStorage.setItem(STORAGE_KEYS.filters, getFiltersElement()?.classList.contains("hide") ? "1" : "0");
    updateFiltersToggleButton();
  }

  function applyCollapseState(player, collapsed) {
    const box = document.getElementById(`box-p${player}`);
    const btn = document.getElementById(`toggle-p${player}`);
    if (!box || !btn) return;
    box.classList.toggle("collapsed", collapsed);
    btn.textContent = collapsed ? "Expandir" : "Recolher";
  }

  function applyComparisonState(collapsed) {
    const body = document.getElementById("comparisonBody");
    const btn = document.getElementById("toggle-comparison");
    if (!body || !btn) return;
    body.classList.toggle("hide", collapsed);
    btn.textContent = collapsed ? "Expandir" : "Recolher";
  }

  function applyChartState(collapsed) {
    const body = document.getElementById("chartBody");
    const btn = document.getElementById("toggle-chart");
    if (!body || !btn) return;
    body.classList.toggle("hide", collapsed);
    btn.textContent = collapsed ? "Expandir" : "Recolher";
  }

  function togglePlayer(player) {
    const box = document.getElementById(`box-p${player}`);
    const btn = document.getElementById(`toggle-p${player}`);
    if (!box || !btn) return;
    box.classList.toggle("collapsed");
    btn.textContent = box.classList.contains("collapsed") ? "Expandir" : "Recolher";
    saveUIState();
  }

  function toggleComparison() {
    const body = document.getElementById("comparisonBody");
    const btn = document.getElementById("toggle-comparison");
    if (!body || !btn) return;
    body.classList.toggle("hide");
    btn.textContent = body.classList.contains("hide") ? "Expandir" : "Recolher";
    saveUIState();
  }

  function toggleChart() {
    const body = document.getElementById("chartBody");
    const btn = document.getElementById("toggle-chart");
    if (!body || !btn) return;
    body.classList.toggle("hide");
    btn.textContent = body.classList.contains("hide") ? "Expandir" : "Recolher";
    saveUIState();
  }

  function buildChartLegend(items, totalAll) {
    const legend = document.getElementById("chartLegend");
    if (!legend) return;

    legend.innerHTML = items.map(item => {
      const pctv = totalAll > 0 ? ((item.value / totalAll) * 100).toFixed(1) : "0.0";
      return `<div class="legend-item"><span class="legend-color" style="background:${item.color};"></span><div class="txt"><div class="k">${item.label}</div><div class="v">${item.value} • ${pctv}%</div></div></div>`;
    }).join("");
  }

  function renderMatchChart(m) {
    const { team1: s1, team2: s2 } = getMatchTeamStats(m);
    const names = getTeamNames(m);
    const score = getScore(m);

    const chartData = [
      { label: `${names.team1} - Pontos Totais`, value: num(score.totalPoints1), color: "rgba(190,242,100,.92)" },
      { label: `${names.team2} - Pontos Totais`, value: num(score.totalPoints2), color: "rgba(56,189,248,.92)" },
      { label: `${names.team1} - Winners`, value: calcWinners(s1), color: "rgba(167,139,250,.92)" },
      { label: `${names.team2} - Winners`, value: calcWinners(s2), color: "rgba(34,211,238,.92)" },
      { label: `${names.team1} - Break Points`, value: num(score.breakPointsWon1), color: "rgba(249,115,22,.92)" },
      { label: `${names.team2} - Break Points`, value: num(score.breakPointsWon2), color: "rgba(251,113,133,.92)" }
    ];

    const signature = JSON.stringify(chartData.map(x => x.value));
    buildChartLegend(chartData, chartData.reduce((a, b) => a + b.value, 0));
    if (signature === lastChartSignature && pieChart) return;
    lastChartSignature = signature;

    const ctx = document.getElementById("matchChart");
    if (!ctx) return;

    const labels = chartData.map(x => x.label);
    const values = chartData.map(x => x.value);
    const colors = chartData.map(x => x.color);

    if (pieChart) {
      pieChart.destroy();
      pieChart = null;
    }

    pieChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: "#0b1220",
          borderWidth: 3,
          hoverOffset: 10,
          spacing: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "58%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                const label = context.label || "";
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const p = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
                return `${label}: ${value} (${p}%)`;
              }
            }
          }
        }
      },
      plugins: [{
        id: "centerText",
        afterDraw(chart) {
          const { ctx, chartArea } = chart;
          if (!chartArea) return;

          const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
          const x = (chartArea.left + chartArea.right) / 2;
          const y = (chartArea.top + chartArea.bottom) / 2;

          ctx.save();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#f8fafc";
          ctx.font = "900 16px Inter, sans-serif";
          ctx.fillText("Gráfico da Partida", x, y - 10);
          ctx.fillStyle = "#94a3b8";
          ctx.font = "700 12px Inter, sans-serif";
          ctx.fillText(`Total: ${total}`, x, y + 12);
          ctx.restore();
        }
      }]
    });
  }

  function renderSummary(m) {
    const mode = document.getElementById("viewMode")?.value || "both";
    const showBoth = mode === "both";

    const s1 = (m.stats && m.stats.player1) ? m.stats.player1 : {};
    const s2 = (m.stats && m.stats.player2) ? m.stats.player2 : {};
    const score = getScore(m);

    updateMatchHeader(m);
    setText("sum-perf", perfScore(score).toFixed(1));

    const games1 = getGamesValue(score, 1);
    const games2 = getGamesValue(score, 2);

    setText(
      "sum-total",
      showBoth ? `${num(score.totalPoints1)} x ${num(score.totalPoints2)}` : mode === "1" ? `${num(score.totalPoints1)}` : `${num(score.totalPoints2)}`
    );
    setText(
      "sum-games",
      showBoth ? `${games1} x ${games2}` : mode === "1" ? `${games1}` : `${games2}`
    );
    setText(
      "sum-sets",
      showBoth ? `${num(score.sets1)} x ${num(score.sets2)}` : mode === "1" ? `${num(score.sets1)}` : `${num(score.sets2)}`
    );

    const winners1 = calcWinners(s1);
    const winners2 = calcWinners(s2);
    const enf1 = calcErrorsNF(s1);
    const enf2 = calcErrorsNF(s2);

    setText("sum-winners", showBoth ? `${winners1} x ${winners2}` : mode === "1" ? `${winners1}` : `${winners2}`);
    setText("sum-enf", showBoth ? `${enf1} x ${enf2}` : mode === "1" ? `${enf1}` : `${enf2}`);
    setText(
      "sum-bp",
      showBoth
        ? getBreakPointsText(score)
        : mode === "1"
          ? `${num(score.breakPointsWon1)}/${num(score.breakPointsChances1)}`
          : `${num(score.breakPointsWon2)}/${num(score.breakPointsChances2)}`
    );

    const s1Serve1 = pct(s1.serve1Won, s1.serve1Attempts);
    const s1Serve2 = pct(s1.serve2Won, s1.serve2Attempts);
    const s2Serve1 = pct(s2.serve1Won, s2.serve1Attempts);
    const s2Serve2 = pct(s2.serve2Won, s2.serve2Attempts);

    setText(
      "sum-servepct",
      showBoth
        ? `${s1Serve1}/${s1Serve2} x ${s2Serve1}/${s2Serve2}`
        : mode === "1"
          ? `${s1Serve1}/${s1Serve2}`
          : `${s2Serve1}/${s2Serve2}`
    );

    setPlayerHeaderNames(m);

    setText("p1-ace", num(s1.ace));
    setText("p1-df", num(s1.doubleFault));
    setText("p1-s1", s1Serve1);
    setText("p1-s2", s1Serve2);
    setText("p1-win", `${num(s1.forehandWinner)}/${num(s1.backhandWinner)}`);
    setText("p1-ef", num(s1.forcedError));
    setText("p1-bp", `${num(score.breakPointsWon1)}/${num(score.breakPointsChances1)}`);
    setText("p1-rede", `${calcNetPoints(s1)}/${calcNetErrors(s1)}`);
    setText("p1-ed", num(s1.returnError));
    setText("p1-pd", num(s1.returnPoint));
    setText("p1-lb", `${num(s1.baselinePoint)}/${num(s1.baselineError)}`);
    setText("p1-perf", perfScore(score).toFixed(1));

    setText("p2-ace", num(s2.ace));
    setText("p2-df", num(s2.doubleFault));
    setText("p2-s1", s2Serve1);
    setText("p2-s2", s2Serve2);
    setText("p2-win", `${num(s2.forehandWinner)}/${num(s2.backhandWinner)}`);
    setText("p2-ef", num(s2.forcedError));
    setText("p2-bp", `${num(score.breakPointsWon2)}/${num(score.breakPointsChances2)}`);
    setText("p2-rede", `${calcNetPoints(s2)}/${calcNetErrors(s2)}`);
    setText("p2-ed", num(s2.returnError));
    setText("p2-pd", num(s2.returnPoint));
    setText("p2-lb", `${num(s2.baselinePoint)}/${num(s2.baselineError)}`);
    setText("p2-perf", perfScore(score).toFixed(1));

    setText("t-ace1", num(s1.ace));
    setText("t-ace2", num(s2.ace));
    setText("t-df1", num(s1.doubleFault));
    setText("t-df2", num(s2.doubleFault));
    setText("t-fw1", num(s1.forehandWinner));
    setText("t-fw2", num(s2.forehandWinner));
    setText("t-bw1", num(s1.backhandWinner));
    setText("t-bw2", num(s2.backhandWinner));
    setText("t-enffh1", num(s1.enfFH));
    setText("t-enffh2", num(s2.enfFH));
    setText("t-enfbh1", num(s1.enfBH));
    setText("t-enfbh2", num(s2.enfBH));
    setText("t-rede1", calcNetPoints(s1));
    setText("t-rede2", calcNetPoints(s2));
    setText("t-redeerr1", calcNetErrors(s1));
    setText("t-redeerr2", calcNetErrors(s2));
    setText("t-ef1", num(s1.forcedError));
    setText("t-ef2", num(s2.forcedError));
    setText("t-ed1", num(s1.returnError));
    setText("t-ed2", num(s2.returnError));
    setText("t-pd1", num(s1.returnPoint));
    setText("t-pd2", num(s2.returnPoint));
    setText("t-plb1", num(s1.baselinePoint));
    setText("t-plb2", num(s2.baselinePoint));
    setText("t-elb1", num(s1.baselineError));
    setText("t-elb2", num(s2.baselineError));
    setText("t-bp1", `${num(score.breakPointsWon1)}/${num(score.breakPointsChances1)}`);
    setText("t-bp2", `${num(score.breakPointsWon2)}/${num(score.breakPointsChances2)}`);
    setText("t-perf1", perfScore(score).toFixed(1));
    setText("t-perf2", perfScore(score).toFixed(1));
    setText("t-total1", num(score.totalPoints1));
    setText("t-total2", num(score.totalPoints2));
    setText("t-g1", games1);
    setText("t-g2", games2);
    setText("t-s1", num(score.sets1));
    setText("t-s2", num(score.sets2));

    document.getElementById("box-p1")?.classList.remove("hide", "active");
    document.getElementById("box-p2")?.classList.remove("hide", "active");
    document.getElementById("comparisonPanel")?.classList.remove("hide");

    if (mode === "1") {
      document.getElementById("box-p1")?.classList.add("active");
      document.getElementById("box-p2")?.classList.add("hide");
      document.getElementById("comparisonPanel")?.classList.add("hide");
    } else if (mode === "2") {
      document.getElementById("box-p2")?.classList.add("active");
      document.getElementById("box-p1")?.classList.add("hide");
      document.getElementById("comparisonPanel")?.classList.add("hide");
    }

    renderMatchChart(m);
  }

  function renderAll() {
    const viewSel = document.getElementById("viewMode");
    if (viewSel) localStorage.setItem(STORAGE_KEYS.viewMode, viewSel.value || "both");
    if (currentMatch) renderSummary(currentMatch);
  }

  async function gerarPDF() {
    if (!currentMatch) return;

    const m = currentMatch;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");
    const pageW = 210;
    const pageH = 297;
    const margin = 12;
    const contentW = pageW - margin * 2;

    const c = {
      header: [30, 41, 59],
      accent: [190, 242, 100],
      blue: [56, 189, 248],
      text: [248, 250, 252],
      muted: [148, 163, 184],
      line: [226, 232, 240],
      dark: [15, 23, 42],
      greenSoft: [220, 252, 231],
      blueSoft: [224, 242, 254],
      purpleSoft: [237, 233, 254],
      amberSoft: [254, 243, 199],
      redSoft: [254, 226, 226]
    };

    const { team1: s1, team2: s2 } = getMatchTeamStats(m);
    const score = getScore(m);
    const names = getTeamNames(m);
    const safe = v => (v ?? "-");
    const fileName = `relatorio_${(names.team1 || "jogador1").replace(/\s+/g, "_")}_vs_${(names.team2 || "jogador2").replace(/\s+/g, "_")}.pdf`;

    function addHeader() {
      doc.setFillColor(...c.header);
      doc.roundedRect(margin, 10, contentW, 34, 4, 4, "F");
      doc.setFillColor(...c.accent);
      doc.roundedRect(margin, 10, 6, 34, 2, 2, "F");
      doc.setTextColor(...c.accent);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("RELATÓRIO DA PARTIDA", margin + 12, 21);
      doc.setTextColor(...c.text);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.text(`${names.team1} x ${names.team2}`, margin + 12, 29);
      doc.setTextColor(...c.muted);
      doc.setFontSize(8.5);
      doc.text(`Categoria: ${safe(getCategoriaNome(m))}`, margin + 12, 36);

      const xInfo = 122;
      doc.text(`Status: ${safe(m.status)}`, xInfo, 19);
      doc.text(`Vencedor: ${safe(getWinnerName(m))}`, xInfo, 25);
      doc.text(`Duração: ${safe(formatTime(m.durationSeconds || m.accumulatedSeconds || 0))}`, xInfo, 31);
      doc.text(`Data: ${formatDateBR(m.finishedAt || m.dataPartida || m.matchDateTime)}`, xInfo, 37);
    }

    function addSectionTitle(title, y) {
      doc.setTextColor(...c.blue);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.text(title, margin, y);
      doc.setDrawColor(...c.blue);
      doc.setLineWidth(0.5);
      doc.line(margin, y + 2, pageW - margin, y + 2);
    }

    function drawMetricCard(x, y, w, h, title, v1, v2, bg) {
      doc.setFillColor(...bg);
      doc.setDrawColor(230, 236, 242);
      doc.roundedRect(x, y, w, h, 3, 3, "FD");
      doc.setTextColor(...c.dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(String(title).toUpperCase(), x + 4, y + 5.5);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`${names.team1}: ${v1}`, x + 4, y + 12.5);
      doc.text(`${names.team2}: ${v2}`, x + 4, y + 18);
    }

    function drawRow(y, title, v1, v2) {
      doc.setFillColor(250, 251, 253);
      doc.setDrawColor(...c.line);
      doc.roundedRect(margin, y, contentW, 11.5, 2, 2, "FD");
      doc.setTextColor(17, 24, 39);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(title, margin + 4, y + 7.7);
      doc.setFont("helvetica", "normal");
      doc.text(String(v1), 95, y + 7.7);
      doc.text(String(v2), 150, y + 7.7);
    }

    function addFooter(pageNum, totalPages) {
      doc.setTextColor(...c.muted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, pageH - 10);
      doc.text(`Página ${pageNum} de ${totalPages}`, pageW - 38, pageH - 10);
    }

    const pages = [];
    let page = [];
    let y = 54;

    function ensureSpace(linesNeeded = 12) {
      if (y + linesNeeded > pageH - 20) {
        pages.push(page);
        page = [];
        y = 16;
      }
    }

    page.push({ type: "header" });

    page.push({
      type: "metricRow",
      y: 64,
      cards: [
        [margin, 64, 58, 24, "Pontos Totais", num(score.totalPoints1), num(score.totalPoints2), c.greenSoft],
        [margin + 61, 64, 58, 24, "Games", getGamesValue(score, 1), getGamesValue(score, 2), c.blueSoft],
        [margin + 122, 64, 58, 24, "Sets", num(score.sets1), num(score.sets2), c.purpleSoft]
      ]
    });

    page.push({
      type: "metricRow",
      y: 94,
      cards: [
        [margin, 94, 58, 24, "Winners", calcWinners(s1), calcWinners(s2), c.greenSoft],
        [margin + 61, 94, 58, 24, "Erros NF", calcErrorsNF(s1), calcErrorsNF(s2), c.redSoft],
        [margin + 122, 94, 58, 24, "Break Point", `${num(score.breakPointsWon1)}/${num(score.breakPointsChances1)}`, `${num(score.breakPointsWon2)}/${num(score.breakPointsChances2)}`, c.amberSoft]
      ]
    });

    y = 126;
    page.push({ type: "section", title: "Estatísticas Principais", y });
    y += 7;

    const rows = [
      ["Aces", num(s1.ace), num(s2.ace)],
      ["Duplas Faltas", num(s1.doubleFault), num(s2.doubleFault)],
      ["Winners Forehand", num(s1.forehandWinner), num(s2.forehandWinner)],
      ["Winners Backhand", num(s1.backhandWinner), num(s2.backhandWinner)],
      ["Erros Não Forçados FH", num(s1.enfFH), num(s2.enfFH)],
      ["Erros Não Forçados BH", num(s1.enfBH), num(s2.enfBH)],
      ["Pontos na Rede", calcNetPoints(s1), calcNetPoints(s2)],
      ["Erros na Rede", calcNetErrors(s1), calcNetErrors(s2)],
      ["Erros Forçados", num(s1.forcedError), num(s2.forcedError)],
      ["Erros de Devolução", num(s1.returnError), num(s2.returnError)],
      ["Pontos de Devolução", num(s1.returnPoint), num(s2.returnPoint)],
      ["Pontos da Linha de Base", num(s1.baselinePoint), num(s2.baselinePoint)],
      ["Erros da Linha de Base", num(s1.baselineError), num(s2.baselineError)],
      ["1º Serviço", `${num(s1.serve1Won)}/${num(s1.serve1Attempts)}`, `${num(s2.serve1Won)}/${num(s2.serve1Attempts)}`],
      ["2º Serviço", `${num(s1.serve2Won)}/${num(s1.serve2Attempts)}`, `${num(s2.serve2Won)}/${num(s2.serve2Attempts)}`]
    ];

    rows.forEach(r => {
      ensureSpace(13);
      page.push({ type: "row", y, data: r });
      y += 14;
    });

    ensureSpace(18);
    page.push({ type: "section", title: "Resumo Visual dos Jogadores", y });
    y += 7;

    const resumoRows = [
      ["Aces", num(s1.ace), num(s2.ace)],
      ["DF", num(s1.doubleFault), num(s2.doubleFault)],
      ["1º Serviço", pct(s1.serve1Won, s1.serve1Attempts), pct(s2.serve1Won, s2.serve1Attempts)],
      ["2º Serviço", pct(s1.serve2Won, s1.serve2Attempts), pct(s2.serve2Won, s2.serve2Attempts)],
      ["Winners FH/BH", `${num(s1.forehandWinner)}/${num(s1.backhandWinner)}`, `${num(s2.forehandWinner)}/${num(s2.backhandWinner)}`],
      ["Erro Forçado", num(s1.forcedError), num(s2.forcedError)],
      ["Break Points", `${num(score.breakPointsWon1)}/${num(score.breakPointsChances1)}`, `${num(score.breakPointsWon2)}/${num(score.breakPointsChances2)}`],
      ["Pontos na Rede", `${calcNetPoints(s1)}/${calcNetErrors(s1)}`, `${calcNetPoints(s2)}/${calcNetErrors(s2)}`],
      ["Erros de Devolução", num(s1.returnError), num(s2.returnError)],
      ["Pontos de Devolução", num(s1.returnPoint), num(s2.returnPoint)],
      ["Linha de Base", `${num(s1.baselinePoint)}/${num(s1.baselineError)}`, `${num(s2.baselinePoint)}/${num(s2.baselineError)}`],
      ["Performance", perfScore(score).toFixed(1), perfScore(score).toFixed(1)]
    ];

    resumoRows.forEach(r => {
      ensureSpace(13);
      page.push({ type: "row", y, data: r });
      y += 14;
    });

    pages.push(page);

    pages.forEach((items, idx) => {
      if (idx > 0) doc.addPage();

      if (idx === 0) {
        addHeader();
      }

      items.forEach(item => {
        if (item.type === "section") {
          addSectionTitle(item.title, item.y);
        } else if (item.type === "metricRow") {
          item.cards.forEach(card => drawMetricCard(...card));
        } else if (item.type === "row") {
          drawRow(item.y, item.data[0], item.data[1], item.data[2]);
        }
      });

      addFooter(idx + 1, pages.length);
    });

    doc.save(fileName);
  }

  function setStatus(message) {
    const el = document.getElementById("reportStatus");
    if (el) el.textContent = message;
  }

  function renderInitialEmptyState() {
    setText("meta-phase", "-");
    setText("meta-tournament", "-");
    setText("meta-cat", "-");
    setText("meta-surface", "-");
    setText("meta-format", "-");
    setText("meta-datetime", "-");
    setText("meta-court", "-");
    setText("meta-duration", "-");
    setText("sum-perf", "0.0");

    setText("sum-total", "0 x 0");
    setText("sum-games", "0 x 0");
    setText("sum-sets", "0 x 0");
    setText("sum-winners", "0 x 0");
    setText("sum-enf", "0 x 0");
    setText("sum-bp", "0/0 x 0/0");
    setText("sum-servepct", "0%/0% x 0%/0%");

    setText("p1-ace", "0");
    setText("p1-df", "0");
    setText("p1-s1", "0%");
    setText("p1-s2", "0%");
    setText("p1-win", "0/0");
    setText("p1-ef", "0");
    setText("p1-bp", "0/0");
    setText("p1-rede", "0/0");
    setText("p1-ed", "0");
    setText("p1-pd", "0");
    setText("p1-lb", "0/0");
    setText("p1-perf", "0.0");

    setText("p2-ace", "0");
    setText("p2-df", "0");
    setText("p2-s1", "0%");
    setText("p2-s2", "0%");
    setText("p2-win", "0/0");
    setText("p2-ef", "0");
    setText("p2-bp", "0/0");
    setText("p2-rede", "0/0");
    setText("p2-ed", "0");
    setText("p2-pd", "0");
    setText("p2-lb", "0/0");
    setText("p2-perf", "0.0");
  }

  function normalizeMatchForLists(match) {
    const status = getMatchStatus(match);
    const dateObj = getMatchDateValue(match);
    const year = dateObj ? String(dateObj.getFullYear()) : "";
    const opponent = getOpponentName(match, currentUser?.uid || "");
    const type = getMatchType(match);

    return {
      id: match.id,
      raw: match,
      status,
      year,
      type,
      opponent,
      label: getMatchLabel(match)
    };
  }

  function filterFinishedMatches() {
    return allFinishedMatches
      .filter((m) => isFinishedStatus(getMatchStatus(m)))
      .map(normalizeMatchForLists);
  }

  function getAvailableYears(matches) {
    const years = Array.from(new Set(matches.map(m => m.year).filter(Boolean)));
    return years.sort((a, b) => Number(b) - Number(a));
  }

  function populateYearFilter(matches) {
    const select = document.getElementById("yearFilter");
    if (!select) return;

    const years = getAvailableYears(matches);
    select.innerHTML =
      `<option value="">Todos os anos</option>` +
      years.map(y => `<option value="${y}">${y}</option>`).join("");

    const saved = localStorage.getItem(STORAGE_KEYS.year) || "";
    if (saved && years.includes(saved)) {
      select.value = saved;
      selectedYear = saved;
    } else {
      selectedYear = "";
    }
  }

  function populateTypeFilter() {
    const select = document.getElementById("matchTypeFilter");
    if (!select) return;

    const saved = localStorage.getItem(STORAGE_KEYS.type) || "";
    if (saved === "simples" || saved === "duplas") {
      select.value = saved;
      selectedType = saved;
    } else {
      selectedType = "";
    }
  }

  function populateOpponentFilter(matches) {
    const select = document.getElementById("adversaryFilter");
    if (!select) return;

    const filtered = matches.filter(m => {
      const okYear = !selectedYear || m.year === selectedYear;
      const okType = !selectedType || m.type === selectedType;
      return okYear && okType;
    });

    const opponents = Array.from(new Set(filtered.map(m => m.opponent).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    select.innerHTML =
      `<option value="">Selecione um adversário</option>` +
      opponents.map(op => `<option value="${op}">${op}</option>`).join("");

    const saved = localStorage.getItem(STORAGE_KEYS.opponent) || "";
    if (saved && opponents.includes(saved)) {
      select.value = saved;
      selectedOpponent = saved;
    } else {
      selectedOpponent = "";
    }
  }

  function populateMatchFilter(matches) {
    const select = document.getElementById("matchFilter");
    if (!select) return;

    const filtered = matches.filter(m => {
      const okYear = !selectedYear || m.year === selectedYear;
      const okType = !selectedType || m.type === selectedType;
      const okOpponent = !selectedOpponent || m.opponent === selectedOpponent;
      return okYear && okType && okOpponent;
    });

    filtered.sort((a, b) => {
      const da = getMatchDateValue(a.raw)?.getTime() || 0;
      const dbv = getMatchDateValue(b.raw)?.getTime() || 0;
      return dbv - da;
    });

    select.innerHTML =
      `<option value="">Selecione uma partida</option>` +
      filtered.map(m => `<option value="${m.id}">${m.label}</option>`).join("");

    const saved = localStorage.getItem(STORAGE_KEYS.match) || "";
    if (saved && filtered.some(m => m.id === saved)) {
      select.value = saved;
      selectedMatchId = saved;
    } else {
      selectedMatchId = "";
    }
  }

  function refreshFilters() {
    const matches = filterFinishedMatches();

    populateYearFilter(matches);
    populateTypeFilter();
    populateOpponentFilter(matches);
    populateMatchFilter(matches);

    if (matches.length === 0) {
      setStatus("Nenhuma partida finalizada encontrada para o jogador logado.");
      currentMatch = null;
      renderInitialEmptyState();
      return;
    }

    const filtered = matches.filter(m => {
      const okYear = !selectedYear || m.year === selectedYear;
      const okType = !selectedType || m.type === selectedType;
      const okOpponent = !selectedOpponent || m.opponent === selectedOpponent;
      return okYear && okType && okOpponent;
    });

    if (filtered.length === 0) {
      setStatus("Nenhuma partida encontrada com os filtros selecionados.");
      currentMatch = null;
      renderInitialEmptyState();
      return;
    }

    setStatus("Selecione os filtros para exibir o relatório.");
    currentMatch = null;
    renderInitialEmptyState();
  }

  function loadMatchListByOpponent() {
    const yearSel = document.getElementById("yearFilter");
    const typeSel = document.getElementById("matchTypeFilter");
    const oppSel = document.getElementById("adversaryFilter");

    selectedYear = yearSel?.value || "";
    selectedType = typeSel?.value || "";
    selectedOpponent = oppSel?.value || "";
    selectedMatchId = "";

    localStorage.setItem(STORAGE_KEYS.year, selectedYear);
    localStorage.setItem(STORAGE_KEYS.type, selectedType);
    localStorage.setItem(STORAGE_KEYS.opponent, selectedOpponent);
    localStorage.removeItem(STORAGE_KEYS.match);

    refreshFilters();
  }

  async function loadSelectedMatchReport() {
    const matchSel = document.getElementById("matchFilter");
    selectedMatchId = matchSel?.value || "";

    if (!selectedMatchId) {
      currentMatch = null;
      renderInitialEmptyState();
      setStatus("Selecione uma partida para exibir o relatório.");
      return;
    }

    localStorage.setItem(STORAGE_KEYS.match, selectedMatchId);

    const match = allFinishedMatches.find(m => m.id === selectedMatchId);
    if (match) {
      currentMatch = match.raw || match;
      renderSummary(currentMatch);
      setStatus(`Exibindo: ${getMatchLabel(currentMatch)}`);
      return;
    }

    try {
      const snap = await db.collection("matches").doc(selectedMatchId).get();
      if (!snap.exists) return;

      currentMatch = { id: snap.id, ...snap.data() };
      renderSummary(currentMatch);
      setStatus(`Exibindo: ${getMatchLabel(currentMatch)}`);
    } catch (err) {
      console.error("Erro ao carregar partida selecionada:", err);
      setStatus("Erro ao carregar a partida selecionada.");
    }
  }

  function syncSelectListeners() {
    const yearSel = document.getElementById("yearFilter");
    const typeSel = document.getElementById("matchTypeFilter");
    const oppSel = document.getElementById("adversaryFilter");
    const matchSel = document.getElementById("matchFilter");

    if (yearSel) {
      yearSel.addEventListener("change", () => {
        selectedYear = yearSel.value || "";
        selectedType = "";
        selectedOpponent = "";
        selectedMatchId = "";

        localStorage.setItem(STORAGE_KEYS.year, selectedYear);
        localStorage.removeItem(STORAGE_KEYS.type);
        localStorage.removeItem(STORAGE_KEYS.opponent);
        localStorage.removeItem(STORAGE_KEYS.match);

        refreshFilters();
      });
    }

    if (typeSel) {
      typeSel.addEventListener("change", () => {
        selectedType = typeSel.value || "";
        selectedOpponent = "";
        selectedMatchId = "";

        localStorage.setItem(STORAGE_KEYS.type, selectedType);
        localStorage.removeItem(STORAGE_KEYS.opponent);
        localStorage.removeItem(STORAGE_KEYS.match);

        refreshFilters();
      });
    }

    if (oppSel) {
      oppSel.addEventListener("change", () => {
        selectedOpponent = oppSel.value || "";
        selectedMatchId = "";

        localStorage.setItem(STORAGE_KEYS.opponent, selectedOpponent);
        localStorage.removeItem(STORAGE_KEYS.match);

        refreshFilters();
      });
    }

    if (matchSel) {
      matchSel.addEventListener("change", () => {
        loadSelectedMatchReport();
      });
    }
  }

  async function fetchMatchesForLoggedUser(user) {
    if (!user) {
      setStatus("Nenhum usuário logado encontrado.");
      return;
    }

    currentUser = user;
    updatePageTitleForUser(user);
    setStatus("Carregando partidas finalizadas...");

    try {
      const ownerId = user.uid;
      const snap = await db.collection("matches")
        .where("ownerId", "==", ownerId)
        .get();

      allFinishedMatches = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(m => isFinishedStatus(getMatchStatus(m)));

      refreshFilters();

      if (selectedMatchId) {
        const savedMatch = allFinishedMatches.find(m => m.id === selectedMatchId);
        if (savedMatch) {
          currentMatch = savedMatch.raw || savedMatch;
          renderSummary(currentMatch);
          setStatus(`Exibindo: ${getMatchLabel(currentMatch)}`);
          return;
        }
      }

      if (urlMatchId) {
        const fromUrl = allFinishedMatches.find(m => m.id === urlMatchId);
        if (fromUrl) {
          currentMatch = fromUrl.raw || fromUrl;
          renderSummary(currentMatch);
          setStatus(`Exibindo: ${getMatchLabel(currentMatch)}`);
          return;
        }
      }
    } catch (err) {
      console.error("Erro ao buscar partidas:", err);
      setStatus("Erro ao carregar partidas finalizadas.");
    }
  }

  function init() {
    loadUIState();
    renderInitialEmptyState();

    window.togglePlayer = togglePlayer;
    window.toggleComparison = toggleComparison;
    window.toggleChart = toggleChart;
    window.toggleFilters = toggleFilters;
    window.renderAll = renderAll;
    window.gerarPDF = gerarPDF;
    window.loadMatchListByOpponent = loadMatchListByOpponent;
    window.loadSelectedMatchReport = loadSelectedMatchReport;

    const toggleFiltersBtn = document.getElementById("toggleFiltersBtn");
    if (toggleFiltersBtn) {
      toggleFiltersBtn.addEventListener("click", () => {
        toggleFilters();
        saveUIState();
      });
    }

    syncSelectListeners();

    auth.onAuthStateChanged((user) => {
      if (user) {
        currentUser = user;
        updatePageTitleForUser(user);
        fetchMatchesForLoggedUser(user);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
