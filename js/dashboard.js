(() => {
    "use strict";
  
    const DashboardApp = (() => {
      const db = firebase.firestore();
      const PAGE_SIZE = 5;
  
      const state = {
        currentUser: null,
        currentUserName: "",
        allMatches: [],
        filteredMatches: [],
        pagedMatches: [],
        currentPage: 1,
        totalPages: 1,
        unsubscribe: null
      };
  
      const el = {
        yearFilter: document.getElementById("yearFilter"),
        player1Filter: document.getElementById("player1Filter"),
        player2Filter: document.getElementById("player2Filter"),
        applyFilterBtn: document.getElementById("applyFilterBtn"),
        clearFilterBtn: document.getElementById("clearFilterBtn"),
        totalMatches: document.getElementById("totalMatches"),
        totalWins: document.getElementById("totalWins"),
        totalLosses: document.getElementById("totalLosses"),
        dashboardMessage: document.getElementById("dashboardMessage"),
        pieChart: document.getElementById("pieChart"),
        barChart: document.getElementById("barChart"),
        dashboardTableBody: document.getElementById("dashboardTableBody"),
        prevPageBtn: document.getElementById("prevPageBtn"),
        nextPageBtn: document.getElementById("nextPageBtn"),
        pageInfo: document.getElementById("pageInfo"),
        tableMeta: document.getElementById("tableMeta")
      };
  
      const U = {
        normalizeText(value = "") {
          return String(value || "").trim().toLowerCase();
        },
  
        escapeHtml(str = "") {
          return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        },
  
        toDate(value) {
          if (!value) return null;
          if (value && typeof value.toDate === "function") {
            const d = value.toDate();
            return isNaN(d.getTime()) ? null : d;
          }
          const d = new Date(value);
          return isNaN(d.getTime()) ? null : d;
        },
  
        formatDate(value) {
          const d = U.toDate(value);
          if (!d) return "-";
          return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
        },
  
        getMatchYear(match) {
          const d = U.toDate(match.matchDateTime);
          return d ? String(d.getFullYear()) : "";
        },
  
        getCurrentUserProfile(user) {
          const displayName = String(user?.displayName || "").trim();
          if (displayName) return displayName;
  
          const email = String(user?.email || "").trim();
          if (email) return email.split("@")[0];
  
          return "";
        },
  
        getMatchWinner(match) {
          const status = U.normalizeText(match.status);
          const score = match.score || {};
  
          if (status === "wo") {
            const wo = U.normalizeText(match.winnerByWO);
            if (wo === "player1") return 1;
            if (wo === "player2") return 2;
            return null;
          }
  
          const sets1 = Number(score.sets1 || 0);
          const sets2 = Number(score.sets2 || 0);
  
          if (sets1 > sets2) return 1;
          if (sets2 > sets1) return 2;
  
          return null;
        }
      };
  
      function setMessage(text) {
        if (el.dashboardMessage) el.dashboardMessage.textContent = text || "";
      }
  
      function renderOptionsFromMatches() {
        const yearSet = new Set();
  
        state.allMatches.forEach((m) => {
          const year = U.getMatchYear(m);
          if (year) yearSet.add(year);
        });
  
        const currentYear = el.yearFilter?.value || "";
  
        if (el.yearFilter) {
          el.yearFilter.innerHTML = ` <option value="">Todos os anos</option> ${[...yearSet] .sort((a, b) => Number(b) - Number(a)) .map((y) => `<option value="${y}">${y}</option>`) .join("")} `;
          el.yearFilter.value = currentYear;
        }
  
        if (el.player1Filter) {
          el.player1Filter.value = state.currentUserName || "";
        }
      }
  
      function computeStats(matches) {
        let wins = 0;
        let losses = 0;
  
        const player1 = state.currentUserName;
        const player2 = String(el.player2Filter?.value || "").trim();
  
        matches.forEach((m) => {
          const matchP1 = U.normalizeText(m.player1 || "");
          const matchP2 = U.normalizeText(m.player2 || "");
          const currentP1 = U.normalizeText(player1);
          const selectedP2 = U.normalizeText(player2);
  
          if (selectedP2) {
            const samePair =
              (matchP1 === currentP1 && matchP2.includes(selectedP2)) ||
              (matchP1.includes(selectedP2) && matchP2 === currentP1);
  
            if (!samePair) return;
          }
  
          const winner = U.getMatchWinner(m);
  
          if (winner === 1 && matchP1 === currentP1) wins += 1;
          else if (winner === 2 && matchP2 === currentP1) wins += 1;
          else if (winner === 1 && matchP2 === currentP1) losses += 1;
          else if (winner === 2 && matchP1 === currentP1) losses += 1;
        });
  
        return { wins, losses };
      }
  
      function drawPieChart(wins, losses) {
        if (!el.pieChart) return;
  
        const canvas = el.pieChart;
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(w, h) * 0.35;
  
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#0f1726";
        ctx.fillRect(0, 0, w, h);
  
        const total = wins + losses;
  
        if (total === 0) {
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fill();
  
          ctx.fillStyle = "#e8eefc";
          ctx.font = "bold 18px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("Sem dados", cx, cy);
          return;
        }
  
        const winPct = Math.round((wins / total) * 100);
        const lossPct = 100 - winPct;
  
        const slices = [
          { value: wins, color: "#60a5fa", label: `${winPct}%` },
          { value: losses, color: "#ff7b7b", label: `${lossPct}%` }
        ];
  
        let start = -Math.PI / 2;
  
        slices.forEach((slice) => {
          if (slice.value <= 0) return;
  
          const angle = (slice.value / total) * Math.PI * 2;
          const end = start + angle;
  
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, radius, start, end);
          ctx.closePath();
          ctx.fillStyle = slice.color;
          ctx.fill();
  
          const mid = start + angle / 2;
          const tx = cx + Math.cos(mid) * (radius * 0.46);
          const ty = cy + Math.sin(mid) * (radius * 0.46);
  
          ctx.font = "bold 15px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(15, 23, 38, 0.9)";
          ctx.strokeText(slice.label, tx, ty);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(slice.label, tx, ty);
  
          start = end;
        });
  
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.60, 0, Math.PI * 2);
        const centerGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius * 0.6);
        centerGrad.addColorStop(0, "#182235");
        centerGrad.addColorStop(1, "#0f1726");
        ctx.fillStyle = centerGrad;
        ctx.fill();
  
        ctx.fillStyle = "#f4f8ff";
        ctx.font = "bold 34px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(total), cx, cy - 8);
  
        ctx.fillStyle = "rgba(232,238,252,0.78)";
        ctx.font = "bold 12px Arial";
        ctx.fillText("partidas", cx, cy + 18);
      }
  
      function drawBarChart(wins, losses) {
        if (!el.barChart) return;
  
        const canvas = el.barChart;
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
  
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#0f1726";
        ctx.fillRect(0, 0, w, h);
  
        const values = [
          { label: "Vitórias", value: wins, color: "#60a5fa" },
          { label: "Derrotas", value: losses, color: "#ff7b7b" }
        ];
  
        const maxVal = Math.max(1, ...values.map(v => v.value));
        const chartW = w - 120;
        const barH = 40;
        const gap = 28;
        const startX = 70;
        const startY = 70;
  
        ctx.font = "bold 14px Arial";
        ctx.textBaseline = "middle";
  
        values.forEach((item, index) => {
          const y = startY + index * (barH + gap);
          const width = (item.value / maxVal) * chartW;
  
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(startX, y, chartW, barH);
  
          const grad = ctx.createLinearGradient(startX, y, startX + width, y);
          grad.addColorStop(0, item.color);
          grad.addColorStop(1, "#ffffff");
  
          ctx.fillStyle = grad;
          ctx.fillRect(startX, y, width, barH);
  
          ctx.fillStyle = "#e8eefc";
          ctx.textAlign = "left";
          ctx.fillText(item.label, 8, y + barH / 2);
  
          ctx.textAlign = "right";
          ctx.fillText(String(item.value), w - 12, y + barH / 2);
        });
      }
  
      function renderTable(matches) {
        if (!el.dashboardTableBody) return;
  
        if (!matches.length) {
          el.dashboardTableBody.innerHTML = ` <tr> <td colspan="4">Nenhuma partida encontrada.</td> </tr> `;
          return;
        }
  
        const rows = matches
          .slice()
          .sort((a, b) => (U.toDate(b.matchDateTime)?.getTime() || 0) - (U.toDate(a.matchDateTime)?.getTime() || 0))
          .map((m) => {
            const winner = U.getMatchWinner(m);
            const winnerText =
              winner === 1 ? (m.player1 || "Jogador 1") :
              winner === 2 ? (m.player2 || "Jogador 2") :
              "Empate/WO";
  
            return ` <tr> <td>${U.escapeHtml(U.formatDate(m.matchDateTime))}</td> <td>${U.escapeHtml(m.player1 || "-")}</td> <td>${U.escapeHtml(m.player2 || "-")}</td> <td>${U.escapeHtml(winnerText)}</td> </tr> `;
          })
          .join("");
  
        el.dashboardTableBody.innerHTML = rows;
      }
  
      function updatePagination() {
        state.totalPages = Math.max(1, Math.ceil(state.filteredMatches.length / PAGE_SIZE));
        if (state.currentPage > state.totalPages) state.currentPage = state.totalPages;
        if (state.currentPage < 1) state.currentPage = 1;
  
        const start = (state.currentPage - 1) * PAGE_SIZE;
        const end = Math.min(start + PAGE_SIZE, state.filteredMatches.length);
        state.pagedMatches = state.filteredMatches.slice(start, start + PAGE_SIZE);
  
        if (el.pageInfo) {
          el.pageInfo.textContent = `Página ${state.currentPage} de ${state.totalPages}`;
        }
  
        if (el.tableMeta) {
          el.tableMeta.textContent = `${state.filteredMatches.length} registros`;
        }
  
        if (el.prevPageBtn) {
          el.prevPageBtn.disabled = state.currentPage <= 1;
        }
  
        if (el.nextPageBtn) {
          el.nextPageBtn.disabled = state.currentPage >= state.totalPages;
        }
  
        return { start, end };
      }
  
      function renderCurrentPage() {
        const rows = state.pagedMatches;
  
        if (!el.dashboardTableBody) return;
  
        if (!rows.length) {
          el.dashboardTableBody.innerHTML = ` <tr> <td colspan="4">Nenhuma partida encontrada.</td> </tr> `;
          return;
        }
  
        const html = rows
          .map((m) => {
            const winner = U.getMatchWinner(m);
            const winnerText =
              winner === 1 ? (m.player1 || "Jogador 1") :
              winner === 2 ? (m.player2 || "Jogador 2") :
              "Empate/WO";
  
            return ` <tr> <td>${U.escapeHtml(U.formatDate(m.matchDateTime))}</td> <td>${U.escapeHtml(m.player1 || "-")}</td> <td>${U.escapeHtml(m.player2 || "-")}</td> <td>${U.escapeHtml(winnerText)}</td> </tr> `;
          })
          .join("");
  
        el.dashboardTableBody.innerHTML = html;
      }
  
      function applyFilters() {
        const year = String(el.yearFilter?.value || "").trim();
        const player2 = String(el.player2Filter?.value || "").trim();
  
        let filtered = [...state.allMatches];
  
        if (year) {
          filtered = filtered.filter((m) => U.getMatchYear(m) === year);
        }
  
        const currentUser = state.currentUserName;
        if (currentUser) {
          const currentNorm = U.normalizeText(currentUser);
          filtered = filtered.filter((m) => U.normalizeText(m.player1 || "") === currentNorm);
        }
  
        if (player2) {
          const p2Norm = U.normalizeText(player2);
          filtered = filtered.filter((m) => {
            const matchP2 = U.normalizeText(m.player2 || "");
            const ownerName = U.normalizeText(m.ownerName || "");
            return matchP2.includes(p2Norm) || ownerName.includes(p2Norm);
          });
        }
  
        state.filteredMatches = filtered;
        state.currentPage = 1;
  
        const stats = computeStats(filtered);
  
        if (el.totalMatches) el.totalMatches.textContent = String(filtered.length);
        if (el.totalWins) el.totalWins.textContent = String(stats.wins);
        if (el.totalLosses) el.totalLosses.textContent = String(stats.losses);
  
        drawPieChart(stats.wins, stats.losses);
        drawBarChart(stats.wins, stats.losses);
  
        updatePagination();
        renderCurrentPage();
  
        if (!filtered.length) {
          setMessage("Nenhuma partida encontrada para os filtros aplicados.");
        } else {
          setMessage(`Exibindo ${filtered.length} partidas filtradas.`);
        }
      }
  
      function clearFilters() {
        if (el.yearFilter) el.yearFilter.value = "";
        if (el.player2Filter) el.player2Filter.value = "";
        applyFilters();
      }
  
      function listenMatches() {
        if (state.unsubscribe) {
          state.unsubscribe();
          state.unsubscribe = null;
        }
  
        state.unsubscribe = db.collection("matches")
          .where("ownerId", "==", state.currentUser.uid)
          .onSnapshot(
            (snapshot) => {
              state.allMatches = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .filter((m) => {
                  const status = U.normalizeText(m.status);
                  return status === "finished" || status === "wo";
                });
  
              renderOptionsFromMatches();
              applyFilters();
            },
            (err) => {
              console.error(err);
              setMessage("Erro ao carregar partidas.");
            }
          );
      }
  
      function bindEvents() {
        el.applyFilterBtn?.addEventListener("click", applyFilters);
        el.clearFilterBtn?.addEventListener("click", clearFilters);
  
        el.prevPageBtn?.addEventListener("click", () => {
          if (state.currentPage > 1) {
            state.currentPage--;
            updatePagination();
            renderCurrentPage();
          }
        });
  
        el.nextPageBtn?.addEventListener("click", () => {
          if (state.currentPage < state.totalPages) {
            state.currentPage++;
            updatePagination();
            renderCurrentPage();
          }
        });
      }
  
      function init() {
        bindEvents();
  
        if (typeof __auth === "undefined" || typeof __db === "undefined") {
          setMessage("Firebase não carregado corretamente.");
          return;
        }
  
        __auth.onAuthStateChanged((user) => {
          if (!user) {
            state.currentUser = null;
            setMessage("Usuário não autenticado.");
            return;
          }
  
          state.currentUser = user;
          state.currentUserName = U.getCurrentUserProfile(user);
  
          if (el.player1Filter) {
            el.player1Filter.value = state.currentUserName || "";
          }
  
          listenMatches();
        });
      }
  
      return { init };
    })();
  
    document.addEventListener("DOMContentLoaded", () => DashboardApp.init());
  })();