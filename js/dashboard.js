(() => {
  "use strict";

  const DashboardApp = (() => {
    const SESSION_KEY = "lsts_admin_session";
    const BIOMETRIC_SESSION_KEY = "lsts_biometric_session";
    const BIOMETRIC_CURRENT_KEY = "lsts_biometric_current";

    const TOURNAMENT_STAGES = new Set([
      "primeira rodada",
      "segunda rodada",
      "terceira rodada",
      "oitavas de final",
      "quartas de final",
      "semifinais",
      "final",
      "grupos"
    ]);

    const state = {
      currentUser: null,
      currentUserName: "",
      allMatches: [],
      filteredMatches: [],
      unsubscribe: null,
      filtersCollapsed: true
    };

    const getDb = () =>
      typeof __db !== "undefined" ? __db : firebase.firestore();

    const getAuth = () =>
      typeof __auth !== "undefined" ? __auth : firebase.auth();

    let dashboardPieChart = null;
    let dashboardYearChart = null;

    let tournamentReportPieChart = null;
    let tournamentAnnualChart = null;

    const el = {
      yearFilter:
        document.getElementById("yearFilter"),
    
      reportTypeFilter:
        document.getElementById("reportTypeFilter"),
    
      modalityFilter:
        document.getElementById("modalityFilter"),
    
      gameFormatFilter:
        document.getElementById("gameFormatFilter"),
    
      player2Filter:
        document.getElementById("player2Filter"),
    
      partidasReportSection:
        document.getElementById("partidasReportSection"),
    
      tournamentReportSection:
        document.getElementById("tournamentReportSection"),
    
      totalMatches:
        document.getElementById("totalMatches"),
    
      totalWins:
        document.getElementById("totalWins"),
    
      totalLosses:
        document.getElementById("totalLosses"),

      woWins: document.getElementById("woWins"),
      woLosses: document.getElementById("woLosses"),

      retWins: document.getElementById("retWins"),
      retLosses: document.getElementById("retLosses"),
    
      totalTorneios:
        document.getElementById("totalTorneios"),
    
      totalRanking:
        document.getElementById("totalRanking"),
    
      totalTreino:
        document.getElementById("totalTreino"),
    
      winsTorneios:
        document.getElementById("winsTorneios"),
    
      winsRanking:
        document.getElementById("winsRanking"),
    
      winsTreino:
        document.getElementById("winsTreino"),
    
      lossesTorneios:
        document.getElementById("lossesTorneios"),
    
      lossesRanking:
        document.getElementById("lossesRanking"),
    
      lossesTreino:
        document.getElementById("lossesTreino"),
    
      dashboardMessage:
        document.getElementById("dashboardMessage"),
    
      pieChart:
        document.getElementById("pieChart"),
    
      barChart:
        document.getElementById("barChart"),
    
      tournamentCount:
        document.getElementById("tournamentCount"),
    
      tournamentMatchCount:
        document.getElementById("tournamentMatchCount"),
    
      activityReportTitle:
        document.getElementById("activityReportTitle"),
    
      activityTournamentCircle:
        document.getElementById("activityTournamentCircle"),

      activityWinsCircle:
        document.getElementById("activityWinsCircle"),

      activityLossesCircle:
        document.getElementById("activityLossesCircle"),

      activityWinsCount:
        document.getElementById("activityWinsCount"),

      activityLossesCount:
        document.getElementById("activityLossesCount"),
    
      activityMatchesCircle:
        document.getElementById("activityMatchesCircle"),
    
      activityMatchesLabel:
        document.getElementById("activityMatchesLabel"),
    
      tournamentSetsTotal:
        document.getElementById("tournamentSetsTotal"),
    
      tournamentSetsWon:
        document.getElementById("tournamentSetsWon"),
    
      tournamentSetsLost:
        document.getElementById("tournamentSetsLost"),
    
      tournamentGamesTotal:
        document.getElementById("tournamentGamesTotal"),
    
      tournamentGamesWon:
        document.getElementById("tournamentGamesWon"),
    
      tournamentGamesLost:
        document.getElementById("tournamentGamesLost"),
    
      tournamentTieBreakTotal:
        document.getElementById("tournamentTieBreakTotal"),
    
      tournamentTieBreakWon:
        document.getElementById("tournamentTieBreakWon"),
    
      tournamentTieBreakLost:
        document.getElementById("tournamentTieBreakLost"),
    
      tournamentSuperTieBreakTotal:
        document.getElementById(
          "tournamentSuperTieBreakTotal"
        ),
    
      tournamentSuperTieBreakWon:
        document.getElementById(
          "tournamentSuperTieBreakWon"
        ),
    
      tournamentSuperTieBreakLost:
        document.getElementById(
          "tournamentSuperTieBreakLost"
        ),
    
      tournamentReportPieChart:
        document.getElementById(
          "tournamentReportPieChart"
        ),
    
      tournamentAnnualChart:
        document.getElementById(
          "tournamentAnnualChart"
        ),
    
      toggleFiltersBtn:
        document.getElementById("toggleFiltersBtn"),
    
      applyFilterBtn:
        document.getElementById("applyFilterBtn"),
    
      clearFilterBtn:
        document.getElementById("clearFilterBtn"),
    
      filtersWrap:
        document.querySelector(".dashboard-filters")
    };

    const U = {
      normalizeText(value = "") {
        return String(value ?? "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
      },

      toDate(value) {
        if (!value) return null;

        if (typeof value.toDate === "function") {
          const date = value.toDate();
          return Number.isNaN(date.getTime()) ? null : date;
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
      },

      getMatchYear(match) {
        const date = U.toDate(
          match.matchDateTime ||
          match.dateTime ||
          match.matchDate ||
          match.date
        );

        return date ? String(date.getFullYear()) : "";
      },

      getGameFormat(match) {
        const value = [
          match.gameFormat,
          match.formatoJogo,
          match.game_format
        ].find((item) => String(item || "").trim());

        return value ? String(value).trim() : "";
      },

      isDoubles(match) {
        const format = U.normalizeText(U.getGameFormat(match));
        return format === "duplas" || format === "duplas mistas";
      },

      getModalidade(match) {
        const value = [
          match.modality,
          match.modalidade
        ].find((item) => String(item || "").trim());

        return value ? String(value).trim() : "";
      },

      getProfileName(user) {
        const displayName = String(user?.displayName || "").trim();
        if (displayName) return displayName;

        const email = String(user?.email || "").trim();
        if (email) return email.split("@")[0];

        return "";
      },

      getCategory(match) {
        /*
         * A carreira.js usa tournamentStage:
         * - Ranking              => ranking
         * - Treino               => treino
         * - Final/Grupos/etc.    => torneios
         */
        const stage = U.normalizeText(
          match.tournamentStage ||
          match.stage ||
          match.etapa ||
          ""
        );

        if (stage === "ranking") return "ranking";
        if (stage === "treino") return "treino";

        if (TOURNAMENT_STAGES.has(stage)) {
          return "torneios";
        }

        /*
         * Compatibilidade para registros que possuem tournamentName,
         * mas não possuem tournamentStage.
         */
        if (String(match.tournamentName || "").trim()) {
          return "torneios";
        }

        return null;
      },

      getWinnerPosition(match) {
        const status = U.normalizeText(match.status);

        if (status === "wo") {
          const winner = U.normalizeText(
            match.winnerByWO ||
            match.winnerByWo ||
            match.woWinner
          );

          if (
            winner === "player1" ||
            winner === "p1" ||
            winner === "jogador1"
          ) {
            return 1;
          }

          if (
            winner === "player2" ||
            winner === "p2" ||
            winner === "jogador2"
          ) {
            return 2;
          }

          return null;
        }

        if (status === "ret") {
          const winner = U.normalizeText(
            match.winnerByRet ||
            match.retWinner
          );

          if (
            winner === "player1" ||
            winner === "p1" ||
            winner === "jogador1"
          ) {
            return 1;
          }

          if (
            winner === "player2" ||
            winner === "p2" ||
            winner === "jogador2"
          ) {
            return 2;
          }

          return null;
        }

        const score = match.score || {};
        const sets1 = Number(score.sets1 || 0);
        const sets2 = Number(score.sets2 || 0);

        if (sets1 > sets2) return 1;
        if (sets2 > sets1) return 2;

        return null;
      },

      getCurrentTeamPlayers(match) {
        const ownerName = U.normalizeText(
          match.ownerName || state.currentUserName
        );

        const p1 = String(match.player1 || "").trim();
        const p2 = String(match.player2 || "").trim();
        const p3 = String(match.player3 || "").trim();
        const p4 = String(match.player4 || "").trim();

        if (!U.isDoubles(match)) {
          if (U.normalizeText(p1) === ownerName) return [p1];
          if (U.normalizeText(p2) === ownerName) return [p2];
          return [p1];
        }

        const team1 =
          U.normalizeText(p1) === ownerName ||
          U.normalizeText(p2) === ownerName;

        const team2 =
          U.normalizeText(p3) === ownerName ||
          U.normalizeText(p4) === ownerName;

        if (team1) return [p1, p2];
        if (team2) return [p3, p4];

        return [p1, p2];
      },

      getCurrentUserResult(match) {
        const winner = U.getWinnerPosition(match);
        if (!winner) return null;

        const ownerName = U.normalizeText(
          match.ownerName || state.currentUserName
        );

        const currentName = U.normalizeText(
          state.currentUserName
        );

        const p1 = U.normalizeText(match.player1 || "");
        const p2 = U.normalizeText(match.player2 || "");

        if (U.isDoubles(match)) {
          const team = U.getCurrentTeamPlayers(match).map((name) =>
            U.normalizeText(name)
          );

          const winnerTeam = winner === 1
            ? [
                U.normalizeText(match.player1 || ""),
                U.normalizeText(match.player2 || "")
              ]
            : [
                U.normalizeText(match.player3 || ""),
                U.normalizeText(match.player4 || "")
              ];

          return team.some((name) => winnerTeam.includes(name))
            ? "win"
            : "loss";
        }

        const ownerIsPlayer1 =
          ownerName === p1 || currentName === p1;

        const ownerIsPlayer2 =
          ownerName === p2 || currentName === p2;

        if (winner === 1) {
          return ownerIsPlayer1 ? "win" : "loss";
        }

        if (winner === 2) {
          return ownerIsPlayer2 ? "win" : "loss";
        }

        return null;
      },

      isOwnerMatch(match) {
        return Boolean(
          state.currentUser?.uid &&
          String(match.ownerId || "").trim() === state.currentUser.uid
        );
      }
    };

    function setMessage(message) {
      if (el.dashboardMessage) {
        el.dashboardMessage.textContent = message || "";
      }
    }

    function getStoredValue(key) {
      try {
        const value = localStorage.getItem(key);
        if (!value) return null;

        try {
          return JSON.parse(value);
        } catch (_) {
          return value;
        }
      } catch (_) {
        return null;
      }
    }

    function getBiometricUser() {
      const value = getStoredValue(BIOMETRIC_CURRENT_KEY);

      if (!value || typeof value !== "object" || !value.uid) {
        return null;
      }

      return {
        uid: value.uid,
        email: value.email || "",
        displayName: value.displayName || ""
      };
    }

    async function loadProfileName(user) {
      try {
        const profileSnap = await getDb()
          .collection("profiles")
          .doc(user.uid)
          .get();

        if (profileSnap.exists) {
          const profile = profileSnap.data() || {};
          const profileName = String(profile.displayName || "").trim();

          if (profileName) {
            state.currentUserName = profileName;
            return;
          }
        }
      } catch (error) {
        console.warn("[Dashboard] Não foi possível carregar o perfil:", error);
      }

      state.currentUserName = U.getProfileName(user);
    }

    function computeStats(matches) {
      const stats = {
        total: {
          torneios: 0,
          ranking: 0,
          treino: 0
        },
      
        wins: {
          torneios: 0,
          ranking: 0,
          treino: 0
        },
      
        losses: {
          torneios: 0,
          ranking: 0,
          treino: 0
        },
      
        woWins: 0,
        woLosses: 0,
      
        retWins: 0,
        retLosses: 0
      };

      matches.forEach((match) => {
        const category = U.getCategory(match);

        if (!category) {
          console.warn("[Dashboard] Categoria não identificada:", {
            id: match.id,
            tournamentStage: match.tournamentStage,
            tournamentName: match.tournamentName,
            modality: match.modality
          });
          return;
        }

        stats.total[category] += 1;

        const result = U.getCurrentUserResult(match);

if (result === "win") {
  stats.wins[category] += 1;
}

if (result === "loss") {
  stats.losses[category] += 1;
}

/* * Estatísticas específicas de WO */
const status = U.normalizeText(match.status);

if (status === "wo") {
  if (result === "win") {
    stats.woWins += 1;
  }

  if (result === "loss") {
    stats.woLosses += 1;
  }
}

/* * Estatísticas específicas de abandono */
if (status === "ret") {
  if (result === "win") {
    stats.retWins += 1;
  }

  if (result === "loss") {
    stats.retLosses += 1;
  }
}
      });

      stats.totalMatches =
        stats.total.torneios +
        stats.total.ranking +
        stats.total.treino;

      stats.totalWins =
        stats.wins.torneios +
        stats.wins.ranking +
        stats.wins.treino;

      stats.totalLosses =
        stats.losses.torneios +
        stats.losses.ranking +
        stats.losses.treino;

      return stats;
    }

    function updateCategoryCards(stats) {
      const values = {
        totalMatches: stats.totalMatches,
        totalWins: stats.totalWins,
        totalLosses: stats.totalLosses,

        totalTorneios: stats.total.torneios,
        totalRanking: stats.total.ranking,
        totalTreino: stats.total.treino,

        winsTorneios: stats.wins.torneios,
        winsRanking: stats.wins.ranking,
        winsTreino: stats.wins.treino,

        lossesTorneios: stats.losses.torneios,
        lossesRanking: stats.losses.ranking,
        
        lossesTreino: stats.losses.treino,

        woWins: stats.woWins,
        woLosses: stats.woLosses,

        retWins: stats.retWins,
        retLosses: stats.retLosses
      };

      Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
      });
    }

    function renderYearOptions() {
      if (!el.yearFilter) return;

      const previous = el.yearFilter.value;
      const years = new Set();

      state.allMatches.forEach((match) => {
        const year = U.getMatchYear(match);
        if (year) years.add(year);
      });

      const orderedYears = [...years].sort(
        (a, b) => Number(b) - Number(a)
      );

      el.yearFilter.innerHTML =
        `<option value="">Todos os anos</option>` +
        orderedYears
          .map((year) => `<option value="${year}">${year}</option>`)
          .join("");

      if (orderedYears.includes(previous)) {
        el.yearFilter.value = previous;
      }
    }

    function updatePieClickDetails(wins, losses, opened = false) {
      const details = document.getElementById("pieClickDetails");
      const lossValue = document.getElementById("pieLossValue");
      const winValue = document.getElementById("pieWinValue");

      if (!details || !lossValue || !winValue) return;

      const total = Number(wins || 0) + Number(losses || 0);

      const winsPercentage = total > 0
        ? ((Number(wins || 0) / total) * 100).toFixed(1)
        : "0.0";

      const lossesPercentage = total > 0
        ? ((Number(losses || 0) / total) * 100).toFixed(1)
        : "0.0";

      /*
       * Derrotas ficam à direita.
       * Vitórias ficam à esquerda.
       */
      lossValue.textContent =
        `Derrotas: ${Number(losses || 0)} (${lossesPercentage}%)`;

      winValue.textContent =
        `Vitórias: ${Number(wins || 0)} (${winsPercentage}%)`;

      details.classList.toggle("is-open", Boolean(opened));
      details.setAttribute("aria-hidden", opened ? "false" : "true");
    }

    function destroyChartFromCanvas(canvas) {
      if (!canvas || typeof Chart === "undefined") {
        return;
      }
    
      const existingChart = Chart.getChart(canvas);
    
      if (existingChart) {
        existingChart.destroy();
      }
    }

    function drawPieChart(wins, losses) {
      if (!el.pieChart) return;

      if (typeof Chart === "undefined") {
        console.error("[Dashboard] Chart.js não foi carregado.");
        return;
      }

      const total =
        Number(wins || 0) +
        Number(losses || 0);

      let opened = false;

      destroyChartFromCanvas(el.pieChart);
dashboardPieChart = null;

      updatePieClickDetails(wins, losses, false);

      dashboardPieChart = new Chart(el.pieChart, {
        type: "doughnut",

        data: {
          labels: ["Derrotas", "Vitórias"],

          datasets: [
            {
              data: [
                Number(losses || 0),
                Number(wins || 0)
              ],

              backgroundColor: [
                "rgba(248, 113, 113, 0.92)",
                "rgba(190, 242, 100, 0.92)"
              ],

              borderColor: "#0b1220",
              borderWidth: 3,
              hoverOffset: 12,
              spacing: 3
            }
          ]
        },

        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "60%",

          animation: {
            duration: 700
          },

          /*
           * Desativa tooltip e interação nas metades.
           * Os valores só aparecem ao clicar no centro.
           */
          events: ["click"],

          plugins: {
            legend: {
              display: false
            },

            tooltip: {
              enabled: false
            }
          },

          onClick(event, activeElements, chart) {
            const canvasRect = chart.canvas.getBoundingClientRect();

            const clickX =
              event.native?.clientX ??
              event.x ??
              0;

            const clickY =
              event.native?.clientY ??
              event.y ??
              0;

            const x = clickX - canvasRect.left;
            const y = clickY - canvasRect.top;

            const meta =
              chart.getDatasetMeta(0);

            const arc = meta?.data?.[0];

            if (!arc) return;

            const centerX = arc.x;
            const centerY = arc.y;
            const innerRadius = arc.innerRadius;

            const distance = Math.sqrt(
              Math.pow(x - centerX, 2) +
              Math.pow(y - centerY, 2)
            );

            /*
             * Só abre quando o clique estiver dentro
             * do círculo central do gráfico.
             */
            const clickedCenter =
              distance <= innerRadius;

            if (!clickedCenter) {
              opened = false;
              updatePieClickDetails(wins, losses, false);
              return;
            }

            opened = !opened;
            updatePieClickDetails(wins, losses, opened);
          }
        },

        plugins: [
          {
            id: "dashboardCenterText",

            afterDraw(chart) {
              const { ctx, chartArea } = chart;

              if (!chartArea) return;

              const centerX =
                (chartArea.left + chartArea.right) / 2;

              const centerY =
                (chartArea.top + chartArea.bottom) / 2;

              ctx.save();

              ctx.textAlign = "center";
              ctx.textBaseline = "middle";

              ctx.fillStyle = "#f8fafc";
              ctx.font = "900 16px Inter, Arial, sans-serif";
              ctx.fillText(
                "Resultados",
                centerX,
                centerY - 10
              );

              ctx.fillStyle = "#94a3b8";
              ctx.font = "700 12px Inter, Arial, sans-serif";
              ctx.fillText(
                `Total: ${total}`,
                centerX,
                centerY + 13
              );

              ctx.restore();
            }
          }
        ]
      });
    }

    function drawYearComparisonChart(matches) {
      const canvas = document.getElementById("yearComparisonChart");

      if (!canvas || typeof Chart === "undefined") return;

      destroyChartFromCanvas(canvas);
dashboardYearChart = null;

      const byYear = {};

      matches.forEach((match) => {
        const year = U.getMatchYear(match);
        if (!year) return;

        if (!byYear[year]) {
          byYear[year] = {
            wins: 0,
            losses: 0
          };
        }

        const result = U.getCurrentUserResult(match);

        if (result === "win") {
          byYear[year].wins += 1;
        }

        if (result === "loss") {
          byYear[year].losses += 1;
        }
      });

      const years = Object.keys(byYear)
        .sort((a, b) => Number(b) - Number(a))
        .slice(0, 2)
        .sort((a, b) => Number(a) - Number(b));

      const labels = years.length
        ? years
        : ["Sem dados"];

      const wins = years.length
        ? years.map((year) => byYear[year].wins)
        : [0];

      const losses = years.length
        ? years.map((year) => byYear[year].losses)
        : [0];

      dashboardYearChart = new Chart(canvas, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Vitórias",
              data: wins,
              backgroundColor: "rgba(190, 242, 100, 0.88)",
              borderColor: "#bef264",
              borderWidth: 1,
              borderRadius: 10,
              barPercentage: 0.7,
              categoryPercentage: 0.62
            },
            {
              label: "Derrotas",
              data: losses,
              backgroundColor: "rgba(248, 113, 113, 0.88)",
              borderColor: "#f87171",
              borderWidth: 1,
              borderRadius: 10,
              barPercentage: 0.7,
              categoryPercentage: 0.62
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false
          },
          scales: {
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: "#cbd5e1",
                font: {
                  weight: "700"
                }
              }
            },
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0,
                color: "#cbd5e1"
              },
              grid: {
                color: "rgba(255,255,255,0.08)"
              }
            }
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "#e8eefc",
                usePointStyle: true,
                pointStyle: "circle",
                padding: 18
              }
            },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.dataset.label}: ${context.raw}`;
                }
              }
            }
          }
        }
      });
    }

    function drawTournamentReportPieChart( stats, reportCategory ) {
      const canvas = document.getElementById(
        "tournamentReportPieChart"
      );
    
      if (!canvas || typeof Chart === "undefined") {
        return;
      }
    
      destroyChartFromCanvas(canvas);
tournamentReportPieChart = null;
    
      const firstLabel =
  reportCategory === "torneios"
    ? "Torneios"
    : "Partidas";

const firstValue =
  reportCategory === "torneios"
    ? stats.tournaments
    : stats.matches;

const labels = [
  firstLabel,
  "Sets vencidos",
  "Sets perdidos",
  "Games vencidos",
  "Games perdidos",
  "Tie-break vencidos",
  "Tie-break perdidos",
  "Super tie-break vencidos",
  "Super tie-break perdidos"
];

const values = [
  firstValue,
  stats.setsWon,
  stats.setsLost,
  stats.gamesWon,
  stats.gamesLost,
  stats.tieBreakWon,
  stats.tieBreakLost,
  stats.superTieBreakWon,
  stats.superTieBreakLost
];
    
      const colors = [
        "#d8ff63",
        "#60a5fa",
        "#ff7b7b",
        "#a78bfa",
        "#f472b6",
        "#fbbf24",
        "#fb923c",
        "#34d399",
        "#f43f5e"
      ];
    
      tournamentReportPieChart = new Chart(canvas, {
        type: "doughnut",
    
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: colors,
              borderColor: "#0b1220",
              borderWidth: 3,
              spacing: 2,
              hoverOffset: 10
            }
          ]
        },
    
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "58%",
    
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "#e8eefc",
                usePointStyle: true,
                pointStyle: "circle",
                padding: 12,
                font: {
                  size: 11,
                  weight: "700"
                }
              }
            },
    
            tooltip: {
              callbacks: {
                label(context) {
                  const value = Number(context.raw || 0);
                  const total = context.dataset.data.reduce(
                    (sum, item) => sum + Number(item || 0),
                    0
                  );
    
                  const percentage = total > 0
                    ? ((value / total) * 100).toFixed(1)
                    : "0.0";
    
                  return `${context.label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        },
    
        plugins: [
          {
            id: "tournamentReportCenterText",
        
            afterDraw(chart) {
              const { ctx, chartArea } = chart;
        
              if (!chartArea) return;
        
              const x =
                (chartArea.left + chartArea.right) / 2;
        
              const y =
                (chartArea.top + chartArea.bottom) / 2;
        
              const centerTitle =
                reportCategory === "torneios"
                  ? "Torneios"
                  : reportCategory === "ranking"
                    ? "Ranking"
                    : "Treino";
        
              const totalValue =
                reportCategory === "torneios"
                  ? stats.tournaments
                  : stats.matches;
        
              ctx.save();
        
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
        
              /* * Título central */
              ctx.fillStyle = "#f8fafc";
              ctx.font = "900 16px Inter, Arial, sans-serif";
        
              ctx.fillText(
                centerTitle,
                x,
                y - 10
              );
        
              /* * Valor central */
              ctx.fillStyle = "#94a3b8";
              ctx.font = "700 12px Inter, Arial, sans-serif";
        
              ctx.fillText(
                `Total: ${totalValue}`,
                x,
                y + 13
              );
        
              ctx.restore();
            }
          }
        ]
      });
    }

    function drawTournamentAnnualChart( matches, reportCategory ) {
      const canvas = document.getElementById(
        "tournamentAnnualChart"
      );
    
      if (!canvas || typeof Chart === "undefined") {
        return;
      }
    
      destroyChartFromCanvas(canvas);
tournamentAnnualChart = null;
    
      const matchesByYear = {};
      const tournamentsByYear = {};
    
      matches.forEach((match) => {
        if (U.getCategory(match) !== reportCategory) {
          return;
        }
    
        const year = U.getMatchYear(match);
    
        if (!year) {
          return;
        }
    
        if (!matchesByYear[year]) {
          matchesByYear[year] = 0;
        }
    
        matchesByYear[year] += 1;
    
        /* * A quantidade de torneios só é utilizada * no relatório de Torneio. */
        if (reportCategory === "torneios") {
          if (!tournamentsByYear[year]) {
            tournamentsByYear[year] = new Set();
          }
    
          const tournamentName = U.normalizeText(
            match.tournamentName || "sem nome"
          );
    
          tournamentsByYear[year].add(
            `${tournamentName}-${year}`
          );
        }
      });
    
      const years = Object.keys(matchesByYear)
        .sort((a, b) => Number(b) - Number(a))
        .slice(0, 2)
        .sort((a, b) => Number(a) - Number(b));
    
      const labels = years.length
        ? years
        : ["Sem dados"];
    
      const matchValues = years.length
        ? years.map((year) => matchesByYear[year])
        : [0];
    
      /* * Ranking e Treino: * mostra somente a quantidade de partidas por ano. */
      if (
        reportCategory === "ranking" ||
        reportCategory === "treino"
      ) {
        tournamentAnnualChart = new Chart(canvas, {
          type: "bar",
    
          data: {
            labels,
    
            datasets: [
              {
                label: "Partidas",
                data: matchValues,
                backgroundColor: "rgba(96, 165, 250, 0.88)",
                borderColor: "#60a5fa",
                borderWidth: 1,
                borderRadius: 10,
                barPercentage: 0.65,
                categoryPercentage: 0.6
              }
            ]
          },
    
          options: {
            responsive: true,
            maintainAspectRatio: false,
    
            scales: {
              x: {
                grid: {
                  display: false
                },
    
                ticks: {
                  color: "#cbd5e1",
                  font: {
                    weight: "700"
                  }
                }
              },
    
              y: {
                beginAtZero: true,
    
                ticks: {
                  precision: 0,
                  color: "#cbd5e1"
                },
    
                grid: {
                  color: "rgba(255,255,255,0.08)"
                }
              }
            },
    
            plugins: {
              legend: {
                position: "bottom",
    
                labels: {
                  color: "#e8eefc",
                  usePointStyle: true,
                  pointStyle: "circle",
                  padding: 16
                }
              },
    
              tooltip: {
                callbacks: {
                  label(context) {
                    return `Partidas: ${context.raw}`;
                  }
                }
              }
            }
          }
        });
    
        return;
      }
    
      /* * Torneio: * mostra quantidade de torneios e partidas por ano. */
      const tournamentValues = years.length
        ? years.map((year) =>
            tournamentsByYear[year]?.size || 0
          )
        : [0];
    
      tournamentAnnualChart = new Chart(canvas, {
        type: "bar",
    
        data: {
          labels,
    
          datasets: [
            {
              label: "Torneios",
              data: tournamentValues,
              backgroundColor: "rgba(216, 255, 99, 0.88)",
              borderColor: "#d8ff63",
              borderWidth: 1,
              borderRadius: 10,
              barPercentage: 0.65,
              categoryPercentage: 0.6
            },
    
            {
              label: "Partidas",
              data: matchValues,
              backgroundColor: "rgba(96, 165, 250, 0.88)",
              borderColor: "#60a5fa",
              borderWidth: 1,
              borderRadius: 10,
              barPercentage: 0.65,
              categoryPercentage: 0.6
            }
          ]
        },
    
        options: {
          responsive: true,
          maintainAspectRatio: false,
    
          scales: {
            x: {
              grid: {
                display: false
              },
    
              ticks: {
                color: "#cbd5e1",
                font: {
                  weight: "700"
                }
              }
            },
    
            y: {
              beginAtZero: true,
    
              ticks: {
                precision: 0,
                color: "#cbd5e1"
              },
    
              grid: {
                color: "rgba(255,255,255,0.08)"
              }
            }
          },
    
          plugins: {
            legend: {
              position: "bottom",
    
              labels: {
                color: "#e8eefc",
                usePointStyle: true,
                pointStyle: "circle",
                padding: 16
              }
            },
    
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.dataset.label}: ${context.raw}`;
                }
              }
            }
          }
        }
      });
    }

    function drawBarChart(wins, losses) {
      if (!el.barChart) return;

      const canvas = el.barChart;
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0f1726";
      ctx.fillRect(0, 0, width, height);

      const rows = [
        {
          label: "Vitórias",
          value: wins,
          color: "#60a5fa",
          y: 78
        },
        {
          label: "Derrotas",
          value: losses,
          color: "#ff7b7b",
          y: 168
        }
      ];

      const max = Math.max(wins, losses, 1);
      const left = 100;
      const right = 24;
      const chartWidth = width - left - right;
      const barHeight = 34;

      rows.forEach((row) => {
        const barWidth = row.value > 0
          ? Math.max(8, (row.value / max) * chartWidth)
          : 0;

        ctx.fillStyle = "#f4f8ff";
        ctx.font = "800 14px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(row.label, 18, row.y + barHeight / 2);

        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(left, row.y, chartWidth, barHeight);

        if (barWidth > 0) {
          ctx.fillStyle = row.color;
          ctx.fillRect(left, row.y, barWidth, barHeight);
        }

        ctx.fillStyle = "#f4f8ff";
        ctx.font = "900 14px Arial";
        ctx.textAlign = "right";
        ctx.fillText(
          String(row.value),
          width - 14,
          row.y + barHeight / 2
        );
      });
    }

    function getTournamentSide(match) {
      const ownerName = U.normalizeText(
        match.ownerName || state.currentUserName
      );
    
      const p1 = U.normalizeText(match.player1 || "");
      const p2 = U.normalizeText(match.player2 || "");
      const p3 = U.normalizeText(match.player3 || "");
      const p4 = U.normalizeText(match.player4 || "");
    
      if (!U.isDoubles(match)) {
        if (ownerName === p1) return 1;
        if (ownerName === p2) return 2;
    
        if (U.normalizeText(state.currentUserName) === p1) return 1;
        if (U.normalizeText(state.currentUserName) === p2) return 2;
    
        return 1;
      }
    
      if (
        ownerName === p1 ||
        ownerName === p2 ||
        U.normalizeText(state.currentUserName) === p1 ||
        U.normalizeText(state.currentUserName) === p2
      ) {
        return 1;
      }
    
      if (
        ownerName === p3 ||
        ownerName === p4 ||
        U.normalizeText(state.currentUserName) === p3 ||
        U.normalizeText(state.currentUserName) === p4
      ) {
        return 2;
      }
    
      return 1;
    }
    
    function getSetHistory(match) {
      const history = match?.score?.setHistory;
    
      return Array.isArray(history) ? history : [];
    }
    
    function getSetResult(games1, games2, tieBreakPoints1 = 0, tieBreakPoints2 = 0) {
      if (games1 > games2) return 1;
      if (games2 > games1) return 2;
    
      if (tieBreakPoints1 > tieBreakPoints2) return 1;
      if (tieBreakPoints2 > tieBreakPoints1) return 2;
    
      return null;
    }
    
    function updateActivityReportCards( stats, reportCategory ) {
      const titles = {
        torneios: "Torneios",
        ranking: "Ranking",
        treino: "Treino"
      };
    
      const title =
        titles[reportCategory] || "Relatório";
    
      if (el.activityReportTitle) {
        el.activityReportTitle.textContent = title;
      }
    
      const isTournament =
        reportCategory === "torneios";
    
      /* * Círculo de torneios: * aparece somente no relatório de Torneio. */
      if (el.activityTournamentCircle) {
        el.activityTournamentCircle.style.display =
          isTournament ? "flex" : "none";
      }
    
      /* * Círculos de vitórias e derrotas: * aparecem somente em Ranking e Treino. */
      if (el.activityWinsCircle) {
        el.activityWinsCircle.style.display =
          isTournament ? "none" : "flex";
      }
    
      if (el.activityLossesCircle) {
        el.activityLossesCircle.style.display =
          isTournament ? "none" : "flex";
      }
    
      if (el.tournamentCount) {
        el.tournamentCount.textContent =
          String(stats.tournaments);
      }
    
      if (el.tournamentMatchCount) {
        el.tournamentMatchCount.textContent =
          String(stats.matches);
      }
    
      if (el.activityWinsCount) {
        el.activityWinsCount.textContent =
          String(stats.wins);
      }
    
      if (el.activityLossesCount) {
        el.activityLossesCount.textContent =
          String(stats.losses);
      }
    
      const values = {
        tournamentSetsTotal: stats.setsTotal,
        tournamentSetsWon: stats.setsWon,
        tournamentSetsLost: stats.setsLost,
    
        tournamentGamesTotal: stats.gamesTotal,
        tournamentGamesWon: stats.gamesWon,
        tournamentGamesLost: stats.gamesLost,
    
        tournamentTieBreakTotal: stats.tieBreakTotal,
        tournamentTieBreakWon: stats.tieBreakWon,
        tournamentTieBreakLost: stats.tieBreakLost,
    
        tournamentSuperTieBreakTotal:
          stats.superTieBreakTotal,
    
        tournamentSuperTieBreakWon:
          stats.superTieBreakWon,
    
        tournamentSuperTieBreakLost:
          stats.superTieBreakLost
      };
    
      Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
    
        if (element) {
          element.textContent = String(value);
        }
      });
    }
    
    function computeActivityReport(matches, reportCategory) {
      const stats = {
        category: reportCategory,

        tournaments: 0,
        matches: 0,

        wins: 0,
        losses: 0,

        setsTotal: 0,
        setsWon: 0,
        setsLost: 0,
    
        gamesTotal: 0,
        gamesWon: 0,
        gamesLost: 0,
    
        tieBreakTotal: 0,
        tieBreakWon: 0,
        tieBreakLost: 0,
    
        superTieBreakTotal: 0,
        superTieBreakWon: 0,
        superTieBreakLost: 0
      };
    
      const tournamentKeys = new Set();
    
      matches.forEach((match) => {
        if (U.getCategory(match) !== reportCategory) {
          return;
        }
    
        stats.matches += 1;

        const result = U.getCurrentUserResult(match);

        if (result === "win") {
          stats.wins += 1;
        }

        if (result === "loss") {
          stats.losses += 1;
        }

        if (reportCategory === "torneios") {
          const tournamentName = U.normalizeText(
            match.tournamentName || "sem nome"
          );
    
          const year = U.getMatchYear(match);
    
          tournamentKeys.add(
            `${tournamentName}-${year}`
          );
        }
    
        const side = getTournamentSide(match);
        const score = match.score || {};
        const history = getSetHistory(match);
    
        if (history.length) {
          history.forEach((set) => {
            const games1 = Number(set.games1 || 0);
            const games2 = Number(set.games2 || 0);
    
            const tieBreakPoints1 = Number(
              set.tieBreakPoints1 || 0
            );
    
            const tieBreakPoints2 = Number(
              set.tieBreakPoints2 || 0
            );
    
            const userGames =
              side === 1 ? games1 : games2;
    
            const opponentGames =
              side === 1 ? games2 : games1;
    
            stats.gamesTotal +=
              userGames + opponentGames;
    
            stats.gamesWon += userGames;
            stats.gamesLost += opponentGames;
    
            stats.setsTotal += 1;
    
            const setResult = getSetResult(
              games1,
              games2,
              tieBreakPoints1,
              tieBreakPoints2
            );
    
            if (setResult === side) {
              stats.setsWon += 1;
            } else if (setResult) {
              stats.setsLost += 1;
            }
    
            const tieBreakMode = U.normalizeText(
              set.tieBreakMode || ""
            );
    
            const tieBreakPointsTotal =
              tieBreakPoints1 + tieBreakPoints2;
    
            if (
              tieBreakMode === "tb7" &&
              tieBreakPointsTotal > 0
            ) {
              const winner =
                tieBreakPoints1 > tieBreakPoints2
                  ? 1
                  : 2;
    
              stats.tieBreakTotal += 1;
    
              if (winner === side) {
                stats.tieBreakWon += 1;
              } else {
                stats.tieBreakLost += 1;
              }
            }
    
            if (
              tieBreakMode === "super10" &&
              tieBreakPointsTotal > 0
            ) {
              const winner =
                tieBreakPoints1 > tieBreakPoints2
                  ? 1
                  : 2;
    
              stats.superTieBreakTotal += 1;
    
              if (winner === side) {
                stats.superTieBreakWon += 1;
              } else {
                stats.superTieBreakLost += 1;
              }
            }
          });
        } else {
          const games1 = Number(score.games1 || 0);
          const games2 = Number(score.games2 || 0);
    
          const sets1 = Number(score.sets1 || 0);
          const sets2 = Number(score.sets2 || 0);
    
          stats.gamesTotal += games1 + games2;
          stats.setsTotal += sets1 + sets2;
    
          if (side === 1) {
            stats.gamesWon += games1;
            stats.gamesLost += games2;
    
            stats.setsWon += sets1;
            stats.setsLost += sets2;
          } else {
            stats.gamesWon += games2;
            stats.gamesLost += games1;
    
            stats.setsWon += sets2;
            stats.setsLost += sets1;
          }
    
          const tieBreakMode = U.normalizeText(
            score.lastTieBreakMode || ""
          );
    
          const tieBreakPoints1 = Number(
            score.lastTieBreakPoints1 || 0
          );
    
          const tieBreakPoints2 = Number(
            score.lastTieBreakPoints2 || 0
          );
    
          const tieBreakPointsTotal =
            tieBreakPoints1 + tieBreakPoints2;
    
          if (
            tieBreakMode === "tb7" &&
            tieBreakPointsTotal > 0
          ) {
            const winner =
              tieBreakPoints1 > tieBreakPoints2
                ? 1
                : 2;
    
            stats.tieBreakTotal += 1;
    
            if (winner === side) {
              stats.tieBreakWon += 1;
            } else {
              stats.tieBreakLost += 1;
            }
          }
    
          if (
            tieBreakMode === "super10" &&
            tieBreakPointsTotal > 0
          ) {
            const winner =
              tieBreakPoints1 > tieBreakPoints2
                ? 1
                : 2;
    
            stats.superTieBreakTotal += 1;
    
            if (winner === side) {
              stats.superTieBreakWon += 1;
            } else {
              stats.superTieBreakLost += 1;
            }
          }
        }
      });
    
      stats.tournaments = tournamentKeys.size;
    
      return stats;
    }
    
    function showReportMode(mode) {
      const isPartidas = mode === "partidas";
    
      if (el.partidasReportSection) {
        el.partidasReportSection.hidden = !isPartidas;
      }
    
      if (el.tournamentReportSection) {
        el.tournamentReportSection.hidden = isPartidas;
      }
    }

    function applyFilters() {
      const reportType = String(
        el.reportTypeFilter?.value || "partidas"
      ).trim();
    
      const year = String(
        el.yearFilter?.value || ""
      ).trim();
    
      const modality = U.normalizeText(
        el.modalityFilter?.value || ""
      );
    
      const gameFormat = U.normalizeText(
        el.gameFormatFilter?.value || ""
      );
    
      const opponent = U.normalizeText(
        el.player2Filter?.value || ""
      );
    
      let filtered = [...state.allMatches];
    
      if (year) {
        filtered = filtered.filter(
          (match) => U.getMatchYear(match) === year
        );
      }
    
      if (modality) {
        filtered = filtered.filter(
          (match) =>
            U.normalizeText(
              U.getModalidade(match)
            ) === modality
        );
      }
    
      if (gameFormat) {
        filtered = filtered.filter(
          (match) =>
            U.normalizeText(
              U.getGameFormat(match)
            ) === gameFormat
        );
      }
    
      if (opponent) {
        filtered = filtered.filter((match) => {
          const players = [
            match.player1,
            match.player2,
            match.player3,
            match.player4
          ].map((value) =>
            U.normalizeText(value)
          );
    
          return players.some((player) =>
            player.includes(opponent)
          );
        });
      }
    
      state.filteredMatches = filtered;
    
      showReportMode(reportType);
    
      /* * RELATÓRIO NORMAL DE PARTIDAS */
      if (reportType === "partidas") {
        const stats = computeStats(filtered);
    
        updateCategoryCards(stats);
    
        drawPieChart(
          stats.totalWins,
          stats.totalLosses
        );
    
        drawYearComparisonChart(filtered);
    
        setMessage(
          filtered.length
            ? `Exibindo ${filtered.length} partidas filtradas.`
            : "Nenhuma partida encontrada para os filtros aplicados."
        );
    
        return;
      }
    
      /* * RELATÓRIO DE TORNEIO, RANKING OU TREINO */
      const reportCategoryMap = {
        torneio: "torneios",
        ranking: "ranking",
        treino: "treino"
      };
    
      const reportCategory =
        reportCategoryMap[reportType];
    
      if (!reportCategory) {
        setMessage("Tipo de relatório inválido.");
        return;
      }
    
      const reportMatches = filtered.filter(
        (match) =>
          U.getCategory(match) === reportCategory
      );
    
      const activityStats =
        computeActivityReport(
          reportMatches,
          reportCategory
        );
    
      updateActivityReportCards(
        activityStats,
        reportCategory
      );
    
      drawTournamentReportPieChart(
        activityStats,
        reportCategory
      );
    
      drawTournamentAnnualChart(
        reportMatches,
        reportCategory
      );
    
      setMessage(
        reportMatches.length
          ? `Exibindo ${reportMatches.length} registros de ${reportType}.`
          : `Nenhum registro encontrado para ${reportType}.`
      );
    }
    function clearFilters() {
      if (el.yearFilter) {
        el.yearFilter.value = "";
      }
    
      if (el.reportTypeFilter) {
        el.reportTypeFilter.value = "partidas";
      }
    
      if (el.modalityFilter) {
        el.modalityFilter.value = "";
      }
    
      if (el.gameFormatFilter) {
        el.gameFormatFilter.value = "";
      }
    
      if (el.player2Filter) {
        el.player2Filter.value = "";
      }
    
      applyFilters();
    }

    function toggleFilters() {
      state.filtersCollapsed = !state.filtersCollapsed;
    
      if (el.filtersWrap) {
        el.filtersWrap.style.display =
          state.filtersCollapsed ? "none" : "grid";
      }
    
      const icon = el.toggleFiltersBtn?.querySelector(
        ".career-bottom-icon ion-icon"
      );
    
      const label = el.toggleFiltersBtn?.querySelector(
        ".career-bottom-label"
      );
    
      if (icon) {
        icon.setAttribute(
          "name",
          state.filtersCollapsed
            ? "search-outline"
            : "close-outline"
        );
      }
    
      if (label) {
        label.textContent = state.filtersCollapsed
          ? "Filtros"
          : "Fechar";
      }
    
      /* * Quando abrir os filtros, direciona a tela * automaticamente para a área de pesquisa. */
      if (!state.filtersCollapsed && el.filtersWrap) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            const offsetTop = 82;
    
            const targetPosition =
              el.filtersWrap.getBoundingClientRect().top +
              window.scrollY -
              offsetTop;
    
            window.scrollTo({
              top: Math.max(0, targetPosition),
              behavior: "smooth"
            });
          }, 100);
        });
      }
    }

    function listenMatches() {
      if (!state.currentUser?.uid) {
        setMessage("Usuário não autenticado.");
        return;
      }

      state.unsubscribe?.();

      state.unsubscribe = getDb()
        .collection("matches")
        .where("ownerId", "==", state.currentUser.uid)
        .onSnapshot(
          (snapshot) => {
            state.allMatches = snapshot.docs
              .map((doc) => ({
                id: doc.id,
                ...doc.data()
              }))
              .filter((match) => {
                const status = U.normalizeText(match.status);

                return [
                  "finished",
                  "wo",
                  "ret"
                ].includes(status);
              });

            console.log(
              "[Dashboard] partidas carregadas:",
              state.allMatches
            );

            console.log(
              "[Dashboard] modalidades/etapas:",
              state.allMatches.map((match) => ({
                modality: match.modality,
                tournamentStage: match.tournamentStage,
                tournamentName: match.tournamentName,
                category: U.getCategory(match)
              }))
            );

            renderYearOptions();
            applyFilters();
          },
          (error) => {
            console.error(
              "[Dashboard] Erro ao carregar partidas:",
              error
            );

            setMessage(
              error.message || "Erro ao carregar partidas."
            );
          }
        );
    }

    function bindEvents() {
      el.reportTypeFilter?.addEventListener(
        "change",
        applyFilters
      );
      
      el.toggleFiltersBtn?.addEventListener(
        "click",
        toggleFilters
      );

      el.applyFilterBtn?.addEventListener(
        "click",
        applyFilters
      );

      el.clearFilterBtn?.addEventListener(
        "click",
        clearFilters
      );

      [
        el.yearFilter,
        el.modalityFilter,
        el.gameFormatFilter,
        el.player2Filter
      ].forEach((element) => {
        element?.addEventListener("change", applyFilters);
      });
    }

    async function init() {
      bindEvents();

      state.filtersCollapsed = true;

      if (el.filtersWrap) {
        el.filtersWrap.style.display = "none";
      }

      if (
        typeof firebase === "undefined" &&
        typeof __auth === "undefined"
      ) {
        setMessage("Firebase não carregado corretamente.");
        return;
      }

      const auth = getAuth();

      auth.onAuthStateChanged(async (user) => {
        if (user) {
          state.currentUser = user;
          await loadProfileName(user);
          listenMatches();
          return;
        }

        const biometricUser = getBiometricUser();

        if (biometricUser?.uid) {
          state.currentUser = biometricUser;
          state.currentUserName = U.getProfileName(
            biometricUser
          );
          listenMatches();
          return;
        }

        const hasLocalSession =
          localStorage.getItem(SESSION_KEY) === "1" ||
          Boolean(getStoredValue(SESSION_KEY));

        const hasBiometricSession =
          localStorage.getItem(BIOMETRIC_SESSION_KEY) === "1" ||
          Boolean(getStoredValue(BIOMETRIC_SESSION_KEY));

        if (!hasLocalSession && !hasBiometricSession) {
          setMessage("Usuário não autenticado.");
        }
      });
    }

    return { init };
  })();

  document.addEventListener(
    "DOMContentLoaded",
    () => DashboardApp.init()
  );
})();
