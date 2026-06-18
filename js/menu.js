(() => {
  "use strict";

  const MenuApp = (() => {
    const ADMIN_EMAIL = "rodrigokamunga@hotmail.com";
    const COLLECTION_NAME = "matches";
    const READ_ALERTS_KEY = "lsts_menu_alerts_read_signature";
    const SESSION_KEY = "lsts_admin_session";
    const BIOMETRIC_SESSION_KEY = "lsts_biometric_session";
    const BIOMETRIC_UID_KEY = "lsts_biometric_uid";
    const BIOMETRIC_CURRENT_KEY = "lsts_biometric_current";
    const SHARE_TOKEN_KEY_PREFIX = "lsts_share_token_";

    const DEFAULT_AVATAR_URL = new URL("img/perfil-padrao.png", window.location.href).href;

    const el = {
      welcomeTitle: document.getElementById("welcomeTitle"),
      welcomeText: document.getElementById("welcomeText"),
      usersAdminBtn: document.getElementById("usersAdminBtn"),
      usersAdminMenuItem: document.getElementById("usersAdminMenuItem"),
      headerUserTitle: document.getElementById("headerUserTitle"),
      headerUserSubtitle: document.getElementById("headerUserSubtitle"),
      alertBtnTop: document.getElementById("alertBtnTop"),
      alertBadge: document.querySelector(".header-alert-badge"),
      alertModalOverlay: document.getElementById("alertModalOverlay"),
      alertModalBody: document.getElementById("alertModalBody"),
      closeAlertModalBtn: document.getElementById("closeAlertModalBtn"),
      closeAlertModalBtn2: document.getElementById("closeAlertModalBtn2"),
      logoutBtnBottom: document.getElementById("logoutBtnBottom"),
      sharePublicBtn: document.getElementById("sharePublicBtn"),
      profileAvatar: document.getElementById("menuProfileAvatar"),
      viewPublicBtn:
        document.getElementById("viewPublicBtn") ||
        document.querySelector('a[href="public.html"]')
    };

    let currentAlertsSignature = "";

    // ─── Helpers gerais ──────────────────────────────────────────────────

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

    async function buildFallbackUser() {
      const biometricUser = getBiometricCurrentUser();
      if (biometricUser?.uid) return biometricUser;

      const uid = localStorage.getItem(BIOMETRIC_UID_KEY) || "";
      if (!uid) return null;

      try {
        const db = getDb();
        if (!db) return null;

        const profileSnap = await db.collection("profiles").doc(uid).get();
        const profileData = profileSnap.exists ? (profileSnap.data() || {}) : {};

        const userSnap = await db.collection("users").doc(uid).get();
        const userData = userSnap.exists ? (userSnap.data() || {}) : {};

        return {
          uid,
          email: userData.email || profileData.email || "",
          displayName: profileData.displayName || userData.displayName || ""
        };
      } catch (err) {
        console.warn("Erro ao reconstruir usuário biométrico no menu:", err);
        return {
          uid,
          email: "",
          displayName: ""
        };
      }
    }

    function setDefaultAvatar() {
      if (el.profileAvatar) {
        el.profileAvatar.src = DEFAULT_AVATAR_URL;
      }
    }

    async function loadProfileAvatar(user) {
      if (!el.profileAvatar || !user?.uid) return;

      try {
        const db = getDb();
        if (!db) {
          setDefaultAvatar();
          return;
        }

        el.profileAvatar.onerror = () => {
          el.profileAvatar.src = DEFAULT_AVATAR_URL;
        };

        const doc = await db.collection("profiles").doc(user.uid).get();

        if (doc.exists) {
          const data = doc.data();
          if (data.photoBase64) {
            el.profileAvatar.src = data.photoBase64;
            return;
          }
        }

        setDefaultAvatar();
      } catch (err) {
        console.warn("Foto de perfil não carregada:", err.message);
        setDefaultAvatar();
      }
    }

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

    // ─── Token de compartilhamento ───────────────────────────────────────

    function makeToken() {
      if (window.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, "");
      return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    }

    function getTokenCacheKey(uid) {
      return `${SHARE_TOKEN_KEY_PREFIX}${uid}`;
    }

    function buildPublicUrl(user, shareToken) {
      const url = new URL("public.html", window.location.href);
      url.searchParams.set("ownerId", user.uid);
      url.searchParams.set("shareToken", shareToken);
      return url.href;
    }

    async function copySilently(text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        }

        const tmp = document.createElement("input");
        tmp.value = text;
        tmp.setAttribute("readonly", "");
        tmp.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand("copy");
        document.body.removeChild(tmp);
        return true;
      } catch (err) {
        console.error("Erro ao copiar link:", err);
        return false;
      }
    }

    async function ensureShareTokenForUser(user) {
      const db = getDb();
      if (!db || !user?.uid) return null;

      const cacheKey = getTokenCacheKey(user.uid);
      const cachedToken = localStorage.getItem(cacheKey);
      if (cachedToken) return cachedToken;

      try {
        // 1) tenta pegar de profiles/{uid}
        const profileRef = db.collection("profiles").doc(user.uid);
        const profileSnap = await profileRef.get();
        const profileData = profileSnap.exists ? (profileSnap.data() || {}) : {};

        if (String(profileData.shareToken || "").trim()) {
          const token = String(profileData.shareToken).trim();
          localStorage.setItem(cacheKey, token);
          return token;
        }

        // 2) tenta pegar de alguma partida pública do usuário
        const matchesSnap = await db.collection(COLLECTION_NAME)
          .where("ownerId", "==", user.uid)
          .where("shareEnabled", "==", true)
          .limit(1)
          .get();

        let token = String(profileData.shareToken || "").trim() || "";

        if (!token && !matchesSnap.empty) {
          const data = matchesSnap.docs[0].data() || {};
          token = String(data.shareToken || "").trim();
        }

        // 3) se ainda não existir, cria um novo
        if (!token) token = makeToken();

        // grava em profiles/{uid} para persistir
        await profileRef.set({
          shareToken: token,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // opcional: grava também nas partidas públicas do usuário sem token
        const allPublicSnap = await db.collection(COLLECTION_NAME)
          .where("ownerId", "==", user.uid)
          .where("shareEnabled", "==", true)
          .get();

        if (!allPublicSnap.empty) {
          const batch = db.batch();
          allPublicSnap.forEach((doc) => {
            const data = doc.data() || {};
            if (!String(data.shareToken || "").trim()) {
              batch.update(doc.ref, {
                shareToken: token,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
          });
          await batch.commit();
        }

        localStorage.setItem(cacheKey, token);
        return token;
      } catch (error) {
        console.error("Erro ao garantir shareToken:", error);
        return null;
      }
    }

    // ─── Botões da tela pública ───────────────────────────────────────────

    async function setupPublicButtons(user) {
      if (!el.sharePublicBtn && !el.viewPublicBtn) return;

      if (!user) {
        if (el.sharePublicBtn) {
          el.sharePublicBtn.style.pointerEvents = "none";
          el.sharePublicBtn.style.opacity = "0.6";
          el.sharePublicBtn.title = "Você precisa estar autenticado para compartilhar";
        }

        if (el.viewPublicBtn) {
          el.viewPublicBtn.style.pointerEvents = "none";
          el.viewPublicBtn.style.opacity = "0.6";
          el.viewPublicBtn.title = "Você precisa estar autenticado para visualizar sua tela pública";
        }
        return;
      }

      if (el.sharePublicBtn) {
        el.sharePublicBtn.style.pointerEvents = "";
        el.sharePublicBtn.style.opacity = "";
        el.sharePublicBtn.title = "Compartilhar sua tela pública";
      }

      if (el.viewPublicBtn) {
        el.viewPublicBtn.style.pointerEvents = "";
        el.viewPublicBtn.style.opacity = "";
        el.viewPublicBtn.title = "Abrir sua tela pública";
      }

      const token = await ensureShareTokenForUser(user);
      if (!token) {
        const fallbackUrl = new URL("public.html", window.location.href);
        fallbackUrl.searchParams.set("ownerId", user.uid);

        if (el.viewPublicBtn) {
          el.viewPublicBtn.href = fallbackUrl.href;
        }

        if (el.sharePublicBtn) {
          el.sharePublicBtn.onclick = async (e) => {
            e.preventDefault();
            await copySilently(fallbackUrl.href);
          };
        }
        return;
      }

      const publicUrl = buildPublicUrl(user, token);

      if (el.viewPublicBtn) {
        el.viewPublicBtn.href = publicUrl;
      }

      if (el.sharePublicBtn) {
        el.sharePublicBtn.onclick = async (e) => {
          e.preventDefault();

          try {
            if (navigator.share) {
              try {
                await navigator.share({
                  title: "Tela Pública - TennisPro",
                  text: "Acesse minha tela pública de partidas do TennisPro:",
                  url: publicUrl
                });
                return;
              } catch (shareError) {
                if (shareError && shareError.name === "AbortError") return;
              }
            }

            await copySilently(publicUrl);
          } catch (error) {
            console.error("Erro ao compartilhar:", error);
            await copySilently(publicUrl);
          }
        };
      }
    }

    // ─── Bem-vindo ────────────────────────────────────────────────────────

    function setWelcome(user) {
      const name = getName(user);
      if (el.welcomeTitle) el.welcomeTitle.textContent = `Bem-vindo, ${name}`;
      if (el.welcomeText) el.welcomeText.textContent = "Escolha uma área para abrir.";
      if (el.headerUserTitle) el.headerUserTitle.textContent = "Menu";
      if (el.headerUserSubtitle) el.headerUserSubtitle.textContent = "Acesso rápido às áreas do sistema";
    }

    function setBiometricWelcome(user) {
      const name = getName(user);
      if (el.welcomeTitle) el.welcomeTitle.textContent = `Bem-vindo, ${name}`;
      if (el.welcomeText) el.welcomeText.textContent = "Acesso liberado pela biometria.";
      if (el.headerUserTitle) el.headerUserTitle.textContent = "Menu";
      if (el.headerUserSubtitle) el.headerUserSubtitle.textContent = "Acesso rápido às áreas do sistema";
    }

    // ─── Alertas ─────────────────────────────────────────────────────────

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

    // ─── Data/Hora ───────────────────────────────────────────────────────

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
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
      if (value instanceof Date) {
        if (isNaN(value.getTime())) return "";
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
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
        if (!isNaN(d.getTime())) {
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }
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

    // ─── Partidas / alertas ───────────────────────────────────────────────

    const pickPlayer1 = (d) => d.player1 || d.nomeJogador1 || d.jogador1 || d.player || d.jogador || "Jogador";
    const pickPlayer2 = (d) => d.player2 || d.nomeJogador2 || d.jogador2 || d.adversario || d.nomeAdversario || "Adversário";
    const pickPlayer3 = (d) => d.player3 || d.nomeJogador3 || d.jogador3 || "Jogador 3";
    const pickPlayer4 = (d) => d.player4 || d.nomeJogador4 || d.jogador4 || "Jogador 4";
    const pickDate = (d) => d.matchDateTime || d.dataPartida || d.data || d.date || d.matchDate || d.dataJogo || null;
    const pickTime = (d) => d.horaPartida || d.hora || d.time || d.matchTime || d.horario || null;

    function getMatchDateTimeLabel(data) {
      const rawDate = pickDate(data);
      const dateBR = formatDateBR(rawDate);
      const time = normalizeTime(pickTime(rawDate ? rawDate : null) || (rawDate ? String(rawDate).slice(11, 16) : ""));
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
        return `<div class="alert-game-teams"><div class="alert-team-line">${p1}/${p2}</div><div class="alert-team-line">${p3}/${p4}</div></div>`;
      }
      return `<div class="alert-game-title">${p1} X ${p2}</div>`;
    }

    function getAlertsSignature(matches) {
      if (!matches?.length) return "";
      return matches
        .map((m) => `${m.id}|${m.horaPartida}|${m.jogador1}|${m.jogador2}|${m.jogador3}|${m.jogador4}`)
        .sort()
        .join(";");
    }

    function renderAlerts(matches) {
      if (!el.alertModalBody) return;
      if (!matches?.length) {
        el.alertModalBody.innerHTML = `<div class="alert-empty"><strong>Nenhum jogo para hoje.</strong><br>Não há partidas programadas para o dia de hoje.</div>`;
        return;
      }

      const html = matches
        .map((item) => ` <div class="alert-game-item"> <div class="alert-game-top"> <div class="alert-game-info"> <div class="alert-game-kicker">Jogo do dia</div> ${item.playersHTML || ""} </div> </div> <div class="alert-game-meta"> <div class="alert-game-date">${item.dateTimeLabel || "--"}</div> <div class="alert-game-extra"> <span class="alert-meta-pill">${item.categoryName || "-"}</span> <span class="alert-meta-pill">${item.tournamentStage || "-"}</span> </div> </div> </div> `)
        .join("");

      el.alertModalBody.innerHTML = `<div class="alert-game-list">${html}</div>`;
    }

    async function loadTodayAlerts(user) {
      if (!el.alertBadge || !el.alertModalBody || !user?.uid) return;

      try {
        const db = getDb();
        if (!db) {
          renderAlerts([]);
          return;
        }

        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        const matches = [];
        const snapshot = await db.collection(COLLECTION_NAME).get();

        snapshot.forEach((doc) => {
          const data = doc.data() || {};
          if (data.ownerId !== user.uid) return;

          const rawDate = pickDate(data);
          if (normalizeDateOnly(rawDate) !== today) return;

          const normalizedTime = normalizeTime(pickTime(data) || (rawDate ? String(rawDate).slice(11, 16) : ""));

          matches.push({
            id: doc.id,
            jogador1: pickPlayer1(data),
            jogador2: pickPlayer2(data),
            jogador3: pickPlayer3(data),
            jogador4: pickPlayer4(data),
            horaPartida: normalizedTime,
            dateTimeLabel: getMatchDateTimeLabel(data),
            categoryName: data.categoryName || "",
            tournamentStage: data.tournamentStage || "",
            playersHTML: formatPlayersLine(data)
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

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAlertModal();
      });
    }

    // ─── Init ─────────────────────────────────────────────────────────────

    async function init() {
      bindEvents();
      setDefaultAvatar();

      const auth = getAuth();
      if (!auth) {
        console.warn("Firebase Auth não encontrado.");
        return;
      }

      auth.onAuthStateChanged(async (user) => {
        const localSession = hasLocalSession();
        const biometricSession = hasBiometricSession();

        if (user) {
          setWelcome(user);

          const isAdmin = normalizeEmail(user.email) === normalizeEmail(ADMIN_EMAIL);
          if (el.usersAdminBtn) el.usersAdminBtn.style.display = isAdmin ? "flex" : "none";
          if (el.usersAdminMenuItem) el.usersAdminMenuItem.style.display = isAdmin ? "flex" : "none";

          await Promise.allSettled([
            loadProfileAvatar(user),
            loadTodayAlerts(user),
            setupPublicButtons(user)
          ]);

          return;
        }

        if (localSession || biometricSession) {
          const fallbackUser = await buildFallbackUser();

          if (fallbackUser?.uid) {
            setBiometricWelcome(fallbackUser);

            const isAdmin = normalizeEmail(fallbackUser.email) === normalizeEmail(ADMIN_EMAIL);
            if (el.usersAdminBtn) el.usersAdminBtn.style.display = isAdmin ? "flex" : "none";
            if (el.usersAdminMenuItem) el.usersAdminMenuItem.style.display = isAdmin ? "flex" : "none";

            await Promise.allSettled([
              loadProfileAvatar(fallbackUser),
              loadTodayAlerts(fallbackUser),
              setupPublicButtons(fallbackUser)
            ]);

            return;
          }

          if (el.welcomeTitle) el.welcomeTitle.textContent = "Bem-vindo";
          if (el.welcomeText) el.welcomeText.textContent = "Acesso liberado pela biometria.";
          if (el.headerUserTitle) el.headerUserTitle.textContent = "Menu";
          if (el.headerUserSubtitle) el.headerUserSubtitle.textContent = "Acesso rápido às áreas do sistema";
          setDefaultAvatar();
          if (el.usersAdminBtn) el.usersAdminBtn.style.display = "none";
          if (el.usersAdminMenuItem) el.usersAdminMenuItem.style.display = "none";
          return;
        }

        goLogin();
      });
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => MenuApp.init());
})();
