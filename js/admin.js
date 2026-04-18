(() => {
  "use strict";

  const AdminApp = (() => {
    const ADMIN_KEY = 'lsts_admin_session';
    const PAGE_SIZE = 8;

    const state = {
      allMatches: [],
      filteredMatches: [],
      currentPage: 1,
      matchesExpanded: true
    };

    const el = {
      form: document.getElementById('matchForm'),
      tbody: document.getElementById('matchesTable'),
      msg: document.getElementById('adminMsg'),
      dialog: document.getElementById('detailsDialog'),
      detailsContent: document.getElementById('detailsContent'),
      docId: document.getElementById('docId'),
      categoryName: document.getElementById('categoryName'),
      matchFormat: document.getElementById('matchFormat'),
      matchDateTime: document.getElementById('matchDateTime'),
      court: document.getElementById('court'),
      tournamentStage: document.getElementById('tournamentStage'),
      player1: document.getElementById('player1'),
      player2: document.getElementById('player2'),
      winnerByWO: document.getElementById('winnerByWO'),
      status: document.getElementById('status'),
      formTitle: document.getElementById('formTitle'),
      logoutBtn: document.getElementById('logoutBtn'),
      newMatchBtn: document.getElementById('newMatchBtn'),
      clearBtn: document.getElementById('clearBtn'),
      closeDialogBtn: document.getElementById('closeDialogBtn'),
      filterPlayers: document.getElementById('filterPlayers'),
      filterCategory: document.getElementById('filterCategory'),
      filterStatus: document.getElementById('filterStatus'),
      prevPageBtn: document.getElementById('prevPageBtn'),
      nextPageBtn: document.getElementById('nextPageBtn'),
      pageInfo: document.getElementById('pageInfo'),
      totalPagesEl: document.getElementById('totalPages'),
      toggleMatchesBtn: document.getElementById('toggleMatchesBtn'),
      matchesSection: document.getElementById('matchesSection')
    };

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

      getSetTarget(matchFormat) {
        if (U.isProSet(matchFormat)) return 8;
        if (U.isSetOf4Games(matchFormat)) return 4;
        return 6;
      },

      getMatchSetsToWin(matchFormat) {
        const text = U.normalizeText(matchFormat);
        if (
          text.includes("1 set com vantagem") ||
          text.includes("1 set sem vantagem") ||
          text.includes("1 set pro")
        ) {
          return 1;
        }
        return 2;
      },

      normalizeMatchFormat(value) {
        const raw = String(value || "").trim().toLowerCase();
        const map = {
          '3 sets com vantagem': '3 sets com vantagem',
          '3 sets sem vantagem': '3 sets sem vantagem',
          '2 sets com vantagem + um supertiebreak de 10 pontos': '2 sets com vantagem + um supertiebreak de 10 pontos',
          '2 sets sem vantagem + um supertiebreak de 10 pontos': '2 sets sem vantagem + um supertiebreak de 10 pontos',
          '1 set com vantagem + um supertiebreak de 10 pontos': '1 set com vantagem + um supertiebreak de 10 pontos',
          '1 set sem vantagem + um supertiebreak de 10 pontos': '1 set sem vantagem + um supertiebreak de 10 pontos',
          '1 set com vantagem + um tiebreak de 7 pontos': '1 set com vantagem + um tiebreak de 7 pontos',
          '1 set sem vantagem + um tiebreak de 7 pontos': '1 set sem vantagem + um tiebreak de 7 pontos',
          '1 set pro de 8 games com vantagem + um tiebreak de 7 pontos': '1 set pro de 8 games com vantagem + um tiebreak de 7 pontos',
          '1 set pro de 8 games sem vantagem + um tiebreak de 7 pontos': '1 set pro de 8 games sem vantagem + um tiebreak de 7 pontos',
          '1 set pro de 8 games sem vantagem + um supertiebreak de 10 pontos': '1 set pro de 8 games sem vantagem + um supertiebreak de 10 pontos',
          '2 sets de 4 games sem vantagem + um supertiebreak de 10 pontos': '2 sets de 4 games sem vantagem + um supertiebreak de 10 pontos',
          '2 sets de 4 games com vantagem + um supertiebreak de 10 pontos': '2 sets de 4 games com vantagem + um supertiebreak de 10 pontos'
        };
        return map[raw] || String(value || "").trim();
      },

      resolveTieBreakMode(matchFormat, score = null) {
        const currentSetNumber = (Array.isArray(score?.setHistory) ? score.setHistory.length : 0) + 1;
        if (currentSetNumber === 3) return "super10";
        return "tb7";
      },

      getPointLabel(points) {
        if (points <= 0) return "0";
        if (points === 1) return "15";
        if (points === 2) return "30";
        return "40";
      },

      getPointDisplay(points1, points2, matchFormat, score = null) {
        if (score && (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10")) {
          return `${score.tieBreakPoints1 || 0}x${score.tieBreakPoints2 || 0}`;
        }

        const noAd = U.noAdEnabled(matchFormat);

        if (!noAd) {
          if (points1 >= 3 && points2 >= 3) {
            if (points1 === points2) return "DEUCE";
            if (points1 === points2 + 1) return "AD";
            if (points2 === points1 + 1) return "AD";
          }
          return `${U.getPointLabel(points1)}x${U.getPointLabel(points2)}`;
        }

        if (points1 === 3 && points2 === 3) return "40x40 - Ponto decisivo";
        return `${U.getPointLabel(points1)}x${U.getPointLabel(points2)}`;
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
          server: score.server || "player1"
        };
      },

      getMatchConfig(matchFormat, score = null) {
        return {
          noAd: U.noAdEnabled(matchFormat),
          advantage: U.advantageEnabled(matchFormat),
          tieBreakMode: U.resolveTieBreakMode(matchFormat, score),
          proSet8: U.isProSet(matchFormat),
          setOf4Games: U.isSetOf4Games(matchFormat),
          setsToWin: U.getMatchSetsToWin(matchFormat),
          setTarget: U.getSetTarget(matchFormat)
        };
      },

      normalizeStatus(value) {
        return String(value || '').trim().toLowerCase();
      },

      statusLabel(statusValue) {
        const s = String(statusValue || '').trim().toLowerCase();
        if (s === 'live') return 'Em andamento';
        if (s === 'finished') return 'Finalizada';
        if (s === 'wo') return 'WO';
        return 'Jogos do dia';
      },

      formatDateTimeDisplay(value) {
        if (!value) return '-';
        if (value.toDate && typeof value.toDate === 'function') return value.toDate().toLocaleString('pt-BR');
        const d = new Date(value);
        return !isNaN(d.getTime()) ? d.toLocaleString('pt-BR') : value;
      },

      getDateTimeValue(value) {
        if (!value) return 0;
        if (value.toDate && typeof value.toDate === 'function') return value.toDate().getTime();
        const d = new Date(value);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      },

      isToday(value) {
        if (!value) return false;
        const d = value?.toDate && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
        if (isNaN(d.getTime())) return false;
        const today = new Date();
        return d.getFullYear() === today.getFullYear() &&
               d.getMonth() === today.getMonth() &&
               d.getDate() === today.getDate();
      },

      buildScoreForSave(matchFormatValue, scoreData = {}) {
        const score = U.normalizeScore(scoreData);
        return {
          ...score,
          points1: Number(score.points1 || 0),
          points2: Number(score.points2 || 0),
          games1: Number(score.games1 || 0),
          games2: Number(score.games2 || 0),
          sets1: Number(score.sets1 || 0),
          sets2: Number(score.sets2 || 0),
          tieBreakMode: score.tieBreakMode || null,
          tieBreakPoints1: Number(score.tieBreakPoints1 || 0),
          tieBreakPoints2: Number(score.tieBreakPoints2 || 0),
          setHistory: Array.isArray(score.setHistory) ? score.setHistory : []
        };
      }
    };

    function setMsg(text) {
      if (el.msg) el.msg.textContent = text || '';
    }

    function goLogin() {
      window.location.replace('login.html');
    }

    function clearForm() {
      if (el.form) el.form.reset();
      if (el.docId) el.docId.value = '';
      if (el.status) el.status.value = 'scheduled';
      if (el.winnerByWO) el.winnerByWO.value = '';
      if (el.formTitle) el.formTitle.textContent = 'Nova partida';
      setMsg('');
    }

    function fillForm(data, id) {
      if (el.docId) el.docId.value = id || '';
      if (el.categoryName) el.categoryName.value = data?.categoryName || '';
      if (el.matchFormat) el.matchFormat.value = U.normalizeMatchFormat(data?.matchFormat || '');
      if (el.matchDateTime) el.matchDateTime.value = data?.matchDateTime || '';
      if (el.court) el.court.value = data?.court || '';
      if (el.tournamentStage) el.tournamentStage.value = data?.tournamentStage || '';
      if (el.player1) el.player1.value = data?.player1 || '';
      if (el.player2) el.player2.value = data?.player2 || '';
      if (el.winnerByWO) el.winnerByWO.value = data?.winnerByWO || '';
      if (el.status) el.status.value = data?.status || 'scheduled';
      if (el.formTitle) el.formTitle.textContent = id ? 'Editando partida' : 'Nova partida';
    }

    function buildPublicLink(id) {
      return `${location.origin}${location.pathname.replace('admin.html', 'player.html')}?id=${id}`;
    }

    function detailsHTML(d, id) {
      const link = buildPublicLink(id);
      return `<div><strong>Categoria:</strong> ${d.categoryName || '-'}</div><div><strong>Formato:</strong> ${U.normalizeMatchFormat(d.matchFormat || '-')}</div><div><strong>Data e hora do jogo:</strong> ${U.formatDateTimeDisplay(d.matchDateTime)}</div><div><strong>Quadra:</strong> ${d.court || '-'}</div><div><strong>Fase:</strong> ${d.tournamentStage || '-'}</div><div><strong>Jogador 1:</strong> ${d.player1 || '-'}</div><div><strong>Jogador 2:</strong> ${d.player2 || '-'}</div><div><strong>Status:</strong> ${U.statusLabel(d.status)}</div><div><strong>WO:</strong> ${d.winnerByWO || 'Nenhum'}</div><div><strong>Link da partida:</strong> <a href="${link}" target="_blank" rel="noreferrer">${link}</a></div>`;
    }

    function rowHTML(docSnap) {
      const d = docSnap.data();
      return `<tr><td><div class="players-cell"><strong>${d.player1 || 'Jogador 1'}</strong><span>vs</span><strong>${d.player2 || 'Jogador 2'}</strong></div></td><td title="${d.categoryName || '-'}">${d.categoryName || '-'}</td><td><span class="status-tag status-${U.normalizeStatus(d.status)}">${U.statusLabel(d.status)}</span></td><td><div class="action-icons"><button class="icon-btn" data-action="copy" data-id="${docSnap.id}" title="Copiar link" aria-label="Copiar link">🔗</button><button class="icon-btn" data-action="detail" data-id="${docSnap.id}" title="Detalhar" aria-label="Detalhar">👁️</button><button class="icon-btn" data-action="edit" data-id="${docSnap.id}" title="Editar" aria-label="Editar">✏️</button><button class="icon-btn danger" data-action="delete" data-id="${docSnap.id}" title="Excluir" aria-label="Excluir">🗑️</button></div></td></tr>`;
    }

    function sortLocalMatches() {
      state.allMatches.sort((a, b) => {
        const aStatus = U.normalizeStatus(a.data?.status);
        const bStatus = U.normalizeStatus(b.data?.status);

        const aIsToday = aStatus === 'scheduled';
        const bIsToday = bStatus === 'scheduled';

        if (aIsToday !== bIsToday) return aIsToday ? -1 : 1;

        const ta = U.getDateTimeValue(a.data?.matchDateTime);
        const tb = U.getDateTimeValue(b.data?.matchDateTime);

        return ta - tb;
      });
    }

    function applyFilters() {
      const p = el.filterPlayers.value.trim().toLowerCase();
      const c = el.filterCategory.value.trim().toLowerCase();
      const s = el.filterStatus.value.trim().toLowerCase();

      state.filteredMatches = state.allMatches.filter(({ data }) => {
        const playerText = `${data.player1 || ''} ${data.player2 || ''}`.toLowerCase();
        const categoryText = `${data.categoryName || ''}`.toLowerCase();
        const statusText = U.normalizeStatus(data.status);

        return (!p || playerText.includes(p)) &&
               (!c || categoryText.includes(c)) &&
               (!s || statusText === s);
      });

      state.currentPage = 1;
      renderPagination();
      renderCurrentPage();
    }

    function renderPagination() {
      const totalPages = Math.max(1, Math.ceil(state.filteredMatches.length / PAGE_SIZE));
      if (state.currentPage > totalPages) state.currentPage = totalPages;
      if (state.currentPage < 1) state.currentPage = 1;
      if (el.pageInfo) el.pageInfo.textContent = String(state.currentPage);
      if (el.totalPagesEl) el.totalPagesEl.textContent = String(totalPages);
      if (el.prevPageBtn) el.prevPageBtn.disabled = state.currentPage <= 1;
      if (el.nextPageBtn) el.nextPageBtn.disabled = state.currentPage >= totalPages;
    }

    function renderCurrentPage() {
      const start = (state.currentPage - 1) * PAGE_SIZE;
      const pageItems = state.filteredMatches.slice(start, start + PAGE_SIZE);

      el.tbody.innerHTML = pageItems.length
        ? pageItems.map(({ docSnap }) => rowHTML(docSnap)).join('')
        : `<tr><td colspan="4" class="empty-card">Nenhuma partida encontrada.</td></tr>`;
    }

    function refreshList() {
      sortLocalMatches();
      applyFilters();
    }

    function setMatchesCollapsed(collapsed) {
      state.matchesExpanded = !collapsed;
      el.matchesSection?.classList.toggle('matches-collapsed', collapsed);
      if (el.toggleMatchesBtn) {
        el.toggleMatchesBtn.textContent = collapsed ? 'Expandir lista' : 'Recolher lista';
      }
    }

    function bindEvents() {
      const session = localStorage.getItem(ADMIN_KEY);
      if (session !== '1') return goLogin();

      el.logoutBtn?.addEventListener('click', async () => {
        try {
          localStorage.removeItem(ADMIN_KEY);
          await __auth.signOut();
          goLogin();
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      });

      el.newMatchBtn?.addEventListener('click', clearForm);
      el.clearBtn?.addEventListener('click', clearForm);
      el.closeDialogBtn?.addEventListener('click', () => el.dialog.close());

      el.filterPlayers?.addEventListener('input', applyFilters);
      el.filterCategory?.addEventListener('input', applyFilters);
      el.filterStatus?.addEventListener('change', applyFilters);

      el.toggleMatchesBtn?.addEventListener('click', () => {
        setMatchesCollapsed(state.matchesExpanded);
      });

      el.prevPageBtn?.addEventListener('click', () => {
        if (state.currentPage > 1) {
          state.currentPage--;
          renderPagination();
          renderCurrentPage();
        }
      });

      el.nextPageBtn?.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(state.filteredMatches.length / PAGE_SIZE));
        if (state.currentPage < totalPages) {
          state.currentPage++;
          renderPagination();
          renderCurrentPage();
        }
      });

      el.form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        setMsg('Salvando...');

        const selectedFormat = U.normalizeMatchFormat(el.matchFormat ? el.matchFormat.value : '');

        const data = {
          categoryName: el.categoryName?.value.trim() || '',
          matchFormat: selectedFormat,
          matchDateTime: el.matchDateTime?.value || '',
          court: el.court?.value.trim() || '',
          tournamentStage: el.tournamentStage?.value || '',
          player1: el.player1?.value.trim() || '',
          player2: el.player2?.value.trim() || '',
          winnerByWO: el.winnerByWO?.value || '',
          status: el.status?.value || 'scheduled',
          score: U.buildScoreForSave(selectedFormat, {
            tieBreakMode: null,
            points1: 0,
            points2: 0,
            games1: 0,
            games2: 0,
            sets1: 0,
            sets2: 0,
            tieBreakPoints1: 0,
            tieBreakPoints2: 0,
            setHistory: []
          }),
          durationSeconds: 0,
          startedAt: null,
          finishedAt: null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
          if (el.docId?.value) {
            await __db.collection('matches').doc(el.docId.value).update(data);
            setMsg('Partida atualizada.');
          } else {
            await __db.collection('matches').add({
              ...data,
              matchId: `JOGO-${Date.now().toString().slice(-6)}`,
              publicLinkId: crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now()).slice(-8),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            setMsg('Partida criada.');
          }
          clearForm();
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      });

      el.tbody?.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const { id, action } = btn.dataset;
        const ref = __db.collection('matches').doc(id);

        try {
          if (action === 'delete' && confirm('Excluir esta partida?')) {
            await ref.delete();
            setMsg('Partida excluída.');
          }

          if (action === 'edit') {
            const snap = await ref.get();
            if (snap.exists) fillForm(snap.data(), id);
          }

          if (action === 'detail') {
            const snap = await ref.get();
            if (snap.exists) {
              el.detailsContent.innerHTML = detailsHTML(snap.data(), id);
              el.dialog.showModal();
            }
          }

          if (action === 'copy') {
            const link = buildPublicLink(id);
            await navigator.clipboard.writeText(link);
            setMsg('Link copiado.');
          }
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      });
    }

    function initSnapshot() {
      __db.collection('matches').onSnapshot(
        (snap) => {
          state.allMatches = snap.docs.map((docSnap) => ({ docSnap, data: docSnap.data() }));
          refreshList();
        },
        (err) => {
          console.error(err);
          setMsg(err.message);
        }
      );
    }

    function init() {
      bindEvents();
      setMatchesCollapsed(false);
      initSnapshot();
    }

    return { init };
  })();

  document.addEventListener('DOMContentLoaded', () => AdminApp.init());
})();