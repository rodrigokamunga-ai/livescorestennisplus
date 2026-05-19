(() => {
  "use strict";

  const MenuApp = (() => {
    const ADMIN_EMAIL = "rodrigokamunga@hotmail.com";
    const COLLECTION_NAME = "matches";
    const READ_ALERTS_KEY = "lsts_menu_alerts_read_signature";

    const el = {
      welcomeTitle: document.getElementById("welcomeTitle"),
      welcomeText: document.getElementById("welcomeText"),
      usersAdminBtn: document.getElementById("usersAdminBtn"),

      headerUserTitle: document.getElementById("headerUserTitle"),
      headerUserSubtitle: document.getElementById("headerUserSubtitle"),

      alertBtnTop: document.getElementById("alertBtnTop"),
      alertBadge: document.querySelector(".header-alert-badge"),
      alertModalOverlay: document.getElementById("alertModalOverlay"),
      alertModalBody: document.getElementById("alertModalBody"),
      closeAlertModalBtn: document.getElementById("closeAlertModalBtn"),
      closeAlertModalBtn2: document.getElementById("closeAlertModalBtn2"),

      logoutBtnBottom: document.getElementById("logoutBtnBottom"),
    };

    let currentAlertsSignature = "";

    function getName(user) {
      return user?.displayName || (user?.email ? user.email.split("@")[0] : "Usuário");
    }

    function goLogin() {
      window.location.replace("login.html");
    }

    async function doLogout() {
      try {
        localStorage.removeItem("lsts_admin_session");

        if (typeof __auth !== "undefined" && __auth) {
          await __auth.signOut();
        } else if (typeof firebase !== "undefined" && firebase.auth) {
          await firebase.auth().signOut();
        }

        goLogin();
      } catch (err) {
        console.error("Erro ao sair:", err);
        alert("Não foi possível sair. Tente novamente.");
      }
    }

    function setWelcome(user) {
      const name = getName(user);

      if (el.welcomeTitle) {
        el.welcomeTitle.textContent = `Bem-vindo, ${name}`;
      }

      if (el.welcomeText) {
        el.welcomeText.textContent = "Escolha uma área para abrir.";
      }

      if (el.headerUserTitle) {
        el.headerUserTitle.textContent = "Menu";
      }

      if (el.headerUserSubtitle) {
        el.headerUserSubtitle.textContent = "Acesso rápido às áreas do sistema";
      }
    }

    function openAlertModal() {
      if (el.alertModalOverlay) {
        el.alertModalOverlay.classList.add("show");
        el.alertModalOverlay.setAttribute("aria-hidden", "false");
      }

      // Ao abrir, marca como lido
      if (currentAlertsSignature) {
        localStorage.setItem(READ_ALERTS_KEY, currentAlertsSignature);
        updateBadgeVisibility();
      }
    }

    function closeAlertModal() {
      if (el.alertModalOverlay) {
        el.alertModalOverlay.classList.remove("show");
        el.alertModalOverlay.setAttribute("aria-hidden", "true");
      }
    }

    function todayKey() {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    function normalizeTime(value) {
      if (!value) return "--:--";

      if (typeof value !== "string") {
        return String(value);
      }

      const v = value.trim();

      // HH:MM
      if (/^\d{1,2}:\d{2}$/.test(v)) {
        const [h, m] = v.split(":");
        return `${h.padStart(2, "0")}:${m}`;
      }

      // 900 -> 09:00
      if (/^\d{3,4}$/.test(v)) {
        const padded = v.padStart(4, "0");
        return `${padded.slice(0, 2)}:${padded.slice(2)}`;
      }

      return v;
    }

    function normalizeDateOnly(value) {
      if (!value) return "";

      if (typeof value?.toDate === "function") {
        const d = value.toDate();
        if (isNaN(d.getTime())) return "";
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }

      if (value instanceof Date) {
        if (isNaN(value.getTime())) return "";
        const yyyy = value.getFullYear();
        const mm = String(value.getMonth() + 1).padStart(2, "0");
        const dd = String(value.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }

      if (typeof value === "string") {
        const v = value.trim();

        // 2026-05-19T09:00
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) {
          return v.slice(0, 10);
        }

        // 2026-05-19
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          return v;
        }

        // 19/05/2026
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
          const [dd, mm, yyyy] = v.split("/");
          return `${yyyy}-${mm}-${dd}`;
        }

        const d = new Date(v);
        if (!isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        }
      }

      return "";
    }

    function formatDateBR(value) {
      if (!value) return "";

      if (typeof value?.toDate === "function") {
        const d = value.toDate();
        if (isNaN(d.getTime())) return "";
        return d.toLocaleDateString("pt-BR");
      }

      if (value instanceof Date) {
        if (isNaN(value.getTime())) return "";
        return value.toLocaleDateString("pt-BR");
      }

      if (typeof value === "string") {
        const normalized = normalizeDateOnly(value);
        if (!normalized) return "";
        const [yyyy, mm, dd] = normalized.split("-");
        return `${dd}/${mm}/${yyyy}`;
      }

      return "";
    }

    function pickPlayer1(data) {
      return (
        data.player1 ||
        data.nomeJogador1 ||
        data.jogador1 ||
        data.player ||
        data.jogador ||
        "Jogador"
      );
    }

    function pickPlayer2(data) {
      return (
        data.player2 ||
        data.nomeJogador2 ||
        data.jogador2 ||
        data.adversario ||
        data.nomeAdversario ||
        "Adversário"
      );
    }

    function pickDate(data) {
      return (
        data.matchDateTime ||
        data.dataPartida ||
        data.data ||
        data.date ||
        data.matchDate ||
        data.dataJogo ||
        null
      );
    }

    function pickTime(data) {
      return (
        data.horaPartida ||
        data.hora ||
        data.time ||
        data.matchTime ||
        data.horario ||
        null
      );
    }

    function getAlertsSignature(matches) {
      if (!matches || !matches.length) return "";
      return matches
        .map((m) => `${m.id}|${m.horaPartida}|${m.jogador1}|${m.jogador2}`)
        .sort()
        .join(";");
    }

    function updateBadgeVisibility(count = 0) {
      if (!el.alertBadge) return;

      const seenSignature = localStorage.getItem(READ_ALERTS_KEY) || "";

      if (!count) {
        el.alertBadge.style.display = "none";
        el.alertBadge.textContent = "";
        return;
      }

      if (seenSignature === currentAlertsSignature) {
        el.alertBadge.style.display = "none";
        el.alertBadge.textContent = "";
        return;
      }

      el.alertBadge.style.display = "block";
      el.alertBadge.textContent = count > 9 ? "9+" : String(count);
    }

    function renderAlerts(matches) {
      if (!el.alertModalBody) return;

      if (!matches || matches.length === 0) {
        el.alertModalBody.innerHTML = ` <div class="alert-empty"> <strong>Nenhum jogo para hoje.</strong><br> Não há partidas programadas para o dia de hoje. </div> `;
        return;
      }

      const html = matches.map((item) => {
        const time = item.horaPartida || "--:--";
        const player1 = item.jogador1 || "Jogador";
        const player2 = item.jogador2 || "Adversário";

        return ` <div class="alert-game-item"> <div class="alert-game-top"> <div class="alert-game-info"> <div class="alert-game-kicker">Jogo do dia</div> <div class="alert-game-title">${time} — ${player1} vs ${player2}</div> </div> <div class="alert-game-time">${time}</div> </div> ${item.dataBR ? `<div class="alert-game-date">Data: ${item.dataBR}</div>` : ""} </div> `;
      }).join("");

      el.alertModalBody.innerHTML = `<div class="alert-game-list">${html}</div>`;
    }

    async function loadTodayAlerts(user) {
      if (!el.alertBadge || !el.alertModalBody) return;

      try {
        if (typeof firebase === "undefined" || !firebase.firestore || !user) {
          el.alertBadge.style.display = "none";
          renderAlerts([]);
          return;
        }

        const db = firebase.firestore();
        const targetDay = todayKey();
        const matches = [];

        const snapshot = await db.collection(COLLECTION_NAME).get();

        snapshot.forEach((doc) => {
          const data = doc.data() || {};

          // Somente partidas do perfil logado
          if (data.ownerId !== user.uid) return;

          const rawDate = pickDate(data);
          const docDate = normalizeDateOnly(rawDate);

          if (docDate !== targetDay) return;

          const normalizedTime = normalizeTime(
            pickTime(data) || (rawDate ? String(rawDate).slice(11, 16) : "")
          );

          matches.push({
            id: doc.id,
            jogador1: pickPlayer1(data),
            jogador2: pickPlayer2(data),
            horaPartida: normalizedTime,
            dataBR: formatDateBR(rawDate),
          });
        });

        matches.sort((a, b) => a.horaPartida.localeCompare(b.horaPartida));

        currentAlertsSignature = getAlertsSignature(matches);

        renderAlerts(matches);
        updateBadgeVisibility(matches.length);
      } catch (err) {
        console.error("Erro ao carregar alertas:", err);
        if (el.alertBadge) el.alertBadge.style.display = "none";
        renderAlerts([]);
      }
    }

    function bindEvents() {
      if (el.alertBtnTop) {
        el.alertBtnTop.addEventListener("click", openAlertModal);
      }

      if (el.closeAlertModalBtn) {
        el.closeAlertModalBtn.addEventListener("click", closeAlertModal);
      }

      if (el.closeAlertModalBtn2) {
        el.closeAlertModalBtn2.addEventListener("click", closeAlertModal);
      }

      if (el.alertModalOverlay) {
        el.alertModalOverlay.addEventListener("click", (e) => {
          if (e.target === el.alertModalOverlay) {
            closeAlertModal();
          }
        });
      }

      if (el.logoutBtnBottom) {
        el.logoutBtnBottom.addEventListener("click", doLogout);
      }

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          closeAlertModal();
        }
      });
    }

    function init() {
      bindEvents();

      const auth = (typeof __auth !== "undefined" && __auth)
        ? __auth
        : (typeof firebase !== "undefined" && firebase.auth ? firebase.auth() : null);

      if (!auth) {
        console.warn("Firebase Auth não encontrado.");
        return;
      }

      auth.onAuthStateChanged((user) => {
        if (!user) {
          goLogin();
          return;
        }

        setWelcome(user);

        if (el.usersAdminBtn) {
          el.usersAdminBtn.style.display = user.email === ADMIN_EMAIL ? "flex" : "none";
        }

        loadTodayAlerts(user);
      });
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => MenuApp.init());
})();