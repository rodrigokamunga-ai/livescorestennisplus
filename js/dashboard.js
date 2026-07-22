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

    const el = {
      yearFilter: document.getElementById("yearFilter"),
      modalityFilter: document.getElementById("modalityFilter"),
      gameFormatFilter: document.getElementById("gameFormatFilter"),
      player2Filter: document.getElementById("player2Filter"),

      totalMatches: document.getElementById("totalMatches"),
      totalWins: document.getElementById("totalWins"),
      totalLosses: document.getElementById("totalLosses"),

      totalTorneios: document.getElementById("totalTorneios"),
      totalRanking: document.getElementById("totalRanking"),
      totalTreino: document.getElementById("totalTreino"),

      winsTorneios: document.getElementById("winsTorneios"),
      winsRanking: document.getElementById("winsRanking"),
      winsTreino: document.getElementById("winsTreino"),

      lossesTorneios: document.getElementById("lossesTorneios"),
      lossesRanking: document.getElementById("lossesRanking"),
      lossesTreino: document.getElementById("lossesTreino"),

      dashboardMessage: document.getElementById("dashboardMessage"),
      pieChart: document.getElementById("pieChart"),
      barChart: document.getElementById("barChart"),

      toggleFiltersBtn: document.getElementById("toggleFiltersBtn"),
      applyFilterBtn: document.getElementById("applyFilterBtn"),
      clearFilterBtn: document.getElementById("clearFilterBtn"),
      filtersWrap: document.querySelector(".dashboard-filters")
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
        }
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
        lossesTreino: stats.losses.treino
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

      if (dashboardPieChart) {
        dashboardPieChart.destroy();
        dashboardPieChart = null;
      }

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

      if (dashboardYearChart) {
        dashboardYearChart.destroy();
        dashboardYearChart = null;
      }

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

    function applyFilters() {
      const year = String(el.yearFilter?.value || "").trim();
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
            U.normalizeText(U.getModalidade(match)) === modality
        );
      }

      if (gameFormat) {
        filtered = filtered.filter(
          (match) =>
            U.normalizeText(U.getGameFormat(match)) === gameFormat
        );
      }

      if (opponent) {
        filtered = filtered.filter((match) => {
          return [
            match.player1,
            match.player2,
            match.player3,
            match.player4
          ]
            .map((value) => U.normalizeText(value))
            .some((player) => player.includes(opponent));
        });
      }

      /*
       * Não filtramos novamente pelo nome do jogador.
       * A consulta do Firestore já usa ownerId.
       */
      state.filteredMatches = filtered;

      const stats = computeStats(filtered);

      updateCategoryCards(stats);
      drawPieChart(stats.totalWins, stats.totalLosses);
      drawYearComparisonChart(filtered);

      console.log("[Dashboard] partidas filtradas:", filtered);
      console.log("[Dashboard] estatísticas calculadas:", stats);

      setMessage(
        filtered.length
          ? `Exibindo ${filtered.length} partidas filtradas.`
          : "Nenhuma partida encontrada para os filtros aplicados."
      );
    }

    function clearFilters() {
      if (el.yearFilter) el.yearFilter.value = "";
      if (el.modalityFilter) el.modalityFilter.value = "";
      if (el.gameFormatFilter) el.gameFormatFilter.value = "";
      if (el.player2Filter) el.player2Filter.value = "";

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
