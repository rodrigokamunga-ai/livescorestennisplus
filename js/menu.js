(() => {
  "use strict";

  const MenuApp = (() => {
    const ADMIN_EMAIL      = "rodrigokamunga@hotmail.com";
    const COLLECTION_NAME  = "matches";
    const READ_ALERTS_KEY  = "lsts_menu_alerts_read_signature";
    const PUBLIC_URL       = `${window.location.origin}/index.html`;
    const SESSION_KEY      = "lsts_admin_session";
    const BIOMETRIC_SESSION_KEY = "lsts_biometric_session";

    // Fallback biométrico simples
    const BIOMETRIC_CURRENT_KEY = "lsts_biometric_current";

    const el = {
      welcomeTitle:        document.getElementById("welcomeTitle"),
      welcomeText:         document.getElementById("welcomeText"),
      usersAdminBtn:       document.getElementById("usersAdminBtn"),
      usersAdminMenuItem:  document.getElementById("usersAdminMenuItem"),
      headerUserTitle:     document.getElementById("headerUserTitle"),
      headerUserSubtitle:  document.getElementById("headerUserSubtitle"),
      alertBtnTop:         document.getElementById("alertBtnTop"),
      alertBadge:          document.querySelector(".header-alert-badge"),
      alertModalOverlay:   document.getElementById("alertModalOverlay"),
      alertModalBody:      document.getElementById("alertModalBody"),
      closeAlertModalBtn:  document.getElementById("closeAlertModalBtn"),
      closeAlertModalBtn2: document.getElementById("closeAlertModalBtn2"),
      logoutBtnBottom:     document.getElementById("logoutBtnBottom"),
      sharePublicBtn:      document.getElementById("sharePublicBtn"),
      profileAvatar:       document.getElementById("menuProfileAvatar")
    };

    let currentAlertsSignature = "";

    // ─── Helpers ──────────────────────────────────────────────────────────

    function normalizeEmail(email = "") {
      return String(email).trim().toLowerCase();
    }

    function getName(user) {
      return user?.displayName || (user?.email ? user.email.split("@")[0] : "Usuário");
    }

    function goLogin() {
      window.location.replace("login.html");
    }

    function getDb() {
      if (typeof __db !== "undefined" && __db) return __db;
      if (typeof firebase !== "undefined" && firebase.firestore) return firebase.firestore();
      return null;
    }

    function getAuth() {
      if (typeof __auth !== "undefined" && __auth) return __auth;
      if (typeof firebase !== "undefined" && firebase.auth) return firebase.auth();
      return null;
    }

    function hasLocalSession() {
      return localStorage.getItem(SESSION_KEY) === "1";
    }

    function hasBiometricSession() {
      return localStorage.getItem(BIOMETRIC_SESSION_KEY) === "1";
    }

    function getBiometricCurrentUser() {
      try {
        const raw = localStorage.getItem(BIOMETRIC_CURRENT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        return {
          uid: parsed.uid || "",
          email: parsed.email || "",
          displayName: parsed.displayName || ""
        };
      } catch (_) {
        return null;
      }
    }

    function isAllowedOfflineSession() {
      return hasLocalSession() || hasBiometricSession();
    }

    async function buildFallbackUser() {
      const biometricUser = getBiometricCurrentUser();
      if (biometricUser?.uid) return biometricUser;

      return null;
    }

    // ─── Foto do perfil ───────────────────────────────────────────────────

    async function loadProfileAvatar(user) {
      if (!el.profileAvatar || !user?.uid) return;

      try {
        const db = getDb();
        if (!db) return;

        const doc = await db.collection("profiles").doc(user.uid).get();

        if (doc.exists) {
          const data = doc.data();
          if (data.photoBase64) {
            el.profileAvatar.src = data.photoBase64;
            return;
          }
        }

        el.profileAvatar.src = "img/perfil-padrao.png";
      } catch (err) {
        console.warn("Foto de perfil não carregada:", err.message);
        el.profileAvatar.src = "img/perfil-padrao.png";
      }
    }

    // ─── Logout ───────────────────────────────────────────────────────────

    async function doLogout() {
      try {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(BIOMETRIC_SESSION_KEY);
        localStorage.removeItem(BIOMETRIC_CURRENT_KEY);

        const auth = getAuth();
        if (auth) await auth.signOut();

        goLogin();
      } catch (err) {
        console.error("Erro ao sair:", err);
        alert("Não foi possível sair. Tente novamente.");
      }
    }

    // ─── Compartilhar ─────────────────────────────────────────────────────

    async function sharePublicLink() {
      try {
        const shareData = {
          title: "Live Scores Tennis",
          text:  "Acesse a tela pública do sistema:",
          url:   PUBLIC_URL
        };

        if (navigator.share) {
          await navigator.share(shareData);
          return;
        }

        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(PUBLIC_URL);
          alert("Link da tela pública copiado!");
          return;
        }

        const tmp = document.createElement("input");
        tmp.value = PUBLIC_URL;
        tmp.setAttribute("readonly", "");
        tmp.style.cssText = "position:fixed;left:-9999px";
        document.body.appendChild(tmp);
        tmp.select();
        tmp.setSelectionRange(0, 99999);
        document.execCommand("copy");
        document.body.removeChild(tmp);
        alert("Link da tela pública copiado!");
      } catch (err) {
        console.error("Erro ao compartilhar:", err);
        alert("Não foi possível compartilhar o link.");
      }
    }

    // ─── Bem-vindo ────────────────────────────────────────────────────────

    function setWelcome(user) {
      const name = getName(user);
      if (el.welcomeTitle)       el.welcomeTitle.textContent = `Bem-vindo, ${name}`;
      if (el.welcomeText)        el.welcomeText.textContent  = "Escolha uma área para abrir.";
      if (el.headerUserTitle)    el.headerUserTitle.textContent = "Menu";
      if (el.headerUserSubtitle) el.headerUserSubtitle.textContent = "Acesso rápido às áreas do sistema";
    }

    function setBiometricWelcome(user) {
      const name = getName(user);
      if (el.welcomeTitle)       el.welcomeTitle.textContent = `Bem-vindo, ${name}`;
      if (el.welcomeText)        el.welcomeText.textContent = "Acesso liberado pela biometria.";
      if (el.headerUserTitle)    el.headerUserTitle.textContent = "Menu";
      if (el.headerUserSubtitle) el.headerUserSubtitle.textContent = "Acesso rápido às áreas do sistema";
    }

    // ─── Modal de alertas ─────────────────────────────────────────────────

    function openAlertModal() {
      if (el.alertModalOverlay) {
        el.alertModalOverlay.classList.add("show");
        el.alertModalOverlay.setAttribute("aria-hidden", "false");
      }
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

    function updateBadgeVisibility(count = 0) {
      if (!el.alertBadge) return;
      const seen = localStorage.getItem(READ_ALERTS_KEY) || "";
      if (!count || seen === currentAlertsSignature) {
        el.alertBadge.style.display = "none";
        el.alertBadge.textContent = "";
        return;
      }
      el.alertBadge.style.display = "block";
      el.alertBadge.textContent = count > 9 ? "9+" : String(count);
    }

    // ─── Helpers de data/hora ─────────────────────────────────────────────

    function normalizeTime(value) {
      if (!value) return "--:--";
      if (typeof value !== "string") return String(value);
      const v = value.trim();
      if (/^\d{1,2}:\d{2}$/.test(v)) {
        const [h, m] = v.split(":");
        return `${h.padStart(2, "0")}:${m}`;
      }
      if (/^\d{3,4}$/.test(v)) {
        const p = v.padStart(4, "0");
        return `${p.slice(0, 2)}:${p.slice(2)}`;
      }
      return v;
    }

    function normalizeDateOnly(value) {
      if (!value) return "";
      if (typeof value?.toDate === "function") {
        const d = value.toDate();
        if (isNaN(d.getTime())) return "";
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      }
      if (value instanceof Date) {
        if (isNaN(value.getTime())) return "";
        return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
      }
      if (typeof value === "string") {
        const v = value.trim();
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return v.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
          const [dd, mm, yyyy] = v.split("/");
          return `${yyyy}-${mm}-${dd}`;
        }
        const d = new Date(v);
        if (!isNaN(d.getTime()))
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      }
      return "";
    }

    function formatDateBR(value) {
      if (!value) return "";
      if (typeof value?.toDate === "function") {
        const d = value.toDate();
        return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
      }
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? "" : value.toLocaleDateString("pt-BR");
      }
      if (typeof value === "string") {
        const n = normalizeDateOnly(value);
        if (!n) return "";
        const [yyyy, mm, dd] = n.split("-");
        return `${dd}/${mm}/${yyyy}`;
      }
      return "";
    }

    // ─── Helpers de partida ───────────────────────────────────────────────

    const pickPlayer1 = (d) => d.player1 || d.nomeJogador1 || d.jogador1 || d.player || d.jogador || "Jogador";
    const pickPlayer2 = (d) => d.player2 || d.nomeJogador2 || d.jogador2 || d.adversario || d.nomeAdversario || "Adversário";
    const pickPlayer3 = (d) => d.player3 || d.nomeJogador3 || d.jogador3 || "Jogador 3";
    const pickPlayer4 = (d) => d.player4 || d.nomeJogador4 || d.jogador4 || "Jogador 4";
    const pickDate    = (d) => d.matchDateTime || d.dataPartida || d.data || d.date || d.matchDate || d.dataJogo || null;
    const pickTime    = (d) => d.horaPartida || d.hora || d.time || d.matchTime || d.horario || null;

    function getMatchDateTimeLabel(data) {
      const rawDate = pickDate(data);
      const dateBR  = formatDateBR(rawDate);
      const time    = normalizeTime(pickTime(data) || (rawDate ? String(rawDate).slice(11, 16) : ""));
      return dateBR ? `${dateBR} - ${time}` : "";
    }

    function isDoublesMatch(data) {
      const gf = String(data?.gameFormat || "").trim().toLowerCase();
      return gf === "duplas" || gf === "duplas mistas";
    }

    function formatPlayersLine(data) {
      const p1 = pickPlayer1(data), p2 = pickPlayer2(data);
      const p3 = pickPlayer3(data), p4 = pickPlayer4(data);
      if (isDoublesMatch(data)) {
        return `<div class="alert-game-teams"><div class="alert-team-line">${p1}/${p2} X</div><div class="alert-team-line">${p3}/${p4}</div></div>`;
      }
      return `<div class="alert-game-title">${p1} X ${p2}</div>`;
    }

    function getAlertsSignature(matches) {
      if (!matches?.length) return "";
      return matches
        .map((m) => `${m.id}|${m.horaPartida}|${m.jogador1}|${m.jogador2}|${m.jogador3}|${m.jogador4}`)
        .sort().join(";");
    }

    function renderAlerts(matches) {
      if (!el.alertModalBody) return;
      if (!matches?.length) {
        el.alertModalBody.innerHTML = `<div class="alert-empty"><strong>Nenhum jogo para hoje.</strong><br>Não há partidas programadas para o dia de hoje.</div>`;
        return;
      }
      const html = matches.map((item) => ` <div class="alert-game-item"> <div class="alert-game-top"> <div class="alert-game-info"> <div class="alert-game-kicker">Jogo do dia</div> ${item.playersHTML || ""} </div> </div> <div class="alert-game-meta"> <div class="alert-game-date">${item.dateTimeLabel || "--"}</div> <div class="alert-game-extra"> <span class="alert-meta-pill">${item.categoryName || "-"}</span> <span class="alert-meta-pill">${item.tournamentStage || "-"}</span> </div> </div> </div> `).join("");

      el.alertModalBody.innerHTML = `<div class="alert-game-list">${html}</div>`;
    }

    async function loadTodayAlerts(user) {
      if (!el.alertBadge || !el.alertModalBody || !user?.uid) return;
      try {
        const db = getDb();
        if (!db) { renderAlerts([]); return; }

        const now  = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

        const matches  = [];
        const snapshot = await db.collection(COLLECTION_NAME).get();

        snapshot.forEach((doc) => {
          const data = doc.data() || {};
          if (data.ownerId !== user.uid) return;
          const rawDate = pickDate(data);
          if (normalizeDateOnly(rawDate) !== today) return;
          const normalizedTime = normalizeTime(pickTime(data) || (rawDate ? String(rawDate).slice(11,16) : ""));
          matches.push({
            id: doc.id,
            jogador1: pickPlayer1(data),
            jogador2: pickPlayer2(data),
            jogador3: pickPlayer3(data),
            jogador4: pickPlayer4(data),
            horaPartida:     normalizedTime,
            dateTimeLabel:   getMatchDateTimeLabel(data),
            categoryName:    data.categoryName || "",
            tournamentStage: data.tournamentStage || "",
            playersHTML:     formatPlayersLine(data)
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

    // ─── Eventos ──────────────────────────────────────────────────────────

    function bindEvents() {
      el.alertBtnTop?.addEventListener("click", openAlertModal);
      el.closeAlertModalBtn?.addEventListener("click", closeAlertModal);
      el.closeAlertModalBtn2?.addEventListener("click", closeAlertModal);

      el.alertModalOverlay?.addEventListener("click", (e) => {
        if (e.target === el.alertModalOverlay) closeAlertModal();
      });

      el.logoutBtnBottom?.addEventListener("click", doLogout);

      el.sharePublicBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        sharePublicLink();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAlertModal();
      });
    }

    // ─── Init ─────────────────────────────────────────────────────────────

    function init() {
      bindEvents();

      const auth = getAuth();
      if (!auth) {
        console.warn("Firebase Auth não encontrado.");
        return;
      }

      auth.onAuthStateChanged(async (user) => {
        const localSession = hasLocalSession();
        const biometricSession = hasBiometricSession();

        console.log("[menu] onAuthStateChanged user:", user ? user.uid : null,
          "localSession:", localSession,
          "biometricSession:", biometricSession
        );

        if (user) {
          setWelcome(user);

          const isAdmin = normalizeEmail(user.email) === normalizeEmail(ADMIN_EMAIL);
          if (el.usersAdminBtn)       el.usersAdminBtn.style.display      = isAdmin ? "flex" : "none";
          if (el.usersAdminMenuItem)  el.usersAdminMenuItem.style.display = isAdmin ? "flex" : "none";

          await Promise.allSettled([
            loadProfileAvatar(user),
            loadTodayAlerts(user)
          ]);

          return;
        }

        if (localSession || biometricSession) {
          const fallbackUser = await buildFallbackUser();

          if (fallbackUser?.uid) {
            setBiometricWelcome(fallbackUser);

            const isAdmin = normalizeEmail(fallbackUser.email) === normalizeEmail(ADMIN_EMAIL);
            if (el.usersAdminBtn)       el.usersAdminBtn.style.display      = isAdmin ? "flex" : "none";
            if (el.usersAdminMenuItem)  el.usersAdminMenuItem.style.display = isAdmin ? "flex" : "none";

            await Promise.allSettled([
              loadProfileAvatar(fallbackUser),
              loadTodayAlerts(fallbackUser)
            ]);

            return;
          }

          // se houver sessão biométrica mas não conseguiu reconstruir o usuário,
          // pelo menos não manda para login imediatamente
          if (localSession || biometricSession) {
            if (el.welcomeTitle)       el.welcomeTitle.textContent = "Bem-vindo";
            if (el.welcomeText)        el.welcomeText.textContent = "Acesso liberado pela biometria.";
            if (el.headerUserTitle)    el.headerUserTitle.textContent = "Menu";
            if (el.headerUserSubtitle) el.headerUserSubtitle.textContent = "Acesso rápido às áreas do sistema";
            if (el.profileAvatar)      el.profileAvatar.src = "img/perfil-padrao.png";
            if (el.usersAdminBtn)      el.usersAdminBtn.style.display = "none";
            if (el.usersAdminMenuItem) el.usersAdminMenuItem.style.display = "none";
            return;
          }
        }

        goLogin();
      });
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => MenuApp.init());
})();
