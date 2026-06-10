"use strict";

// ─── Referências ──────────────────────────────────────────────────────────────

const form           = document.getElementById("loginForm");
const msg            = document.getElementById("loginMsg");
const emailInput     = document.getElementById("email");
const passwordInput  = document.getElementById("password");
const rememberMe     = document.getElementById("rememberMe");
const biometricBtn   = document.getElementById("biometricLoginBtn");
const googleLoginBtn = document.getElementById("googleLoginBtn");

const REDIRECT_URL       = "menu.html";
const SESSION_KEY        = "lsts_admin_session";
const REMEMBER_EMAIL_KEY = "rememberedEmail";
const BIOMETRIC_KEY      = "lsts_biometric_uid";
const BIOMETRIC_CRED_KEY = "lsts_biometric_credId";

// ─── ✅ Verificação de ambiente ───────────────────────────────────────────────

const IS_FILE    = location.protocol === "file:";
const IS_HTTPS   = location.protocol === "https:";
const IS_LOCAL   = location.hostname === "localhost" ||
                   location.hostname === "127.0.0.1";
const IS_SECURE  = window.isSecureContext;

const CAN_USE_FIREBASE  = !IS_FILE; // Firebase Auth exige http ou https
const CAN_USE_GOOGLE    = !IS_FILE && (IS_HTTPS || IS_LOCAL);
const CAN_USE_BIOMETRIC = IS_SECURE && (IS_HTTPS || IS_LOCAL);

// ─── Preenche e-mail salvo ────────────────────────────────────────────────────

const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
if (savedEmail && emailInput && rememberMe) {
  emailInput.value   = savedEmail;
  rememberMe.checked = true;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function setMsg(text, type = "info") {
  if (!msg) return;
  msg.textContent = text || "";
  msg.style.color =
    type === "success" ? "#86efac" :
    type === "error"   ? "#fca5a5" :
                         "rgba(232,238,252,0.9)";
}

function goHome() {
  window.location.replace(REDIRECT_URL);
}

function saveSession() {
  localStorage.setItem(SESSION_KEY, "1");
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ─── ✅ Aviso de ambiente inseguro ────────────────────────────────────────────

function applyUnsafeEnvironmentUI() {
  // Desabilita botão Google
  if (googleLoginBtn) {
    googleLoginBtn.disabled           = true;
    googleLoginBtn.style.opacity      = "0.4";
    googleLoginBtn.style.cursor       = "not-allowed";
    googleLoginBtn.style.pointerEvents = "none";
    googleLoginBtn.innerHTML =
      `<span>⚠️ Google indisponível — abra via https://localhost:8443</span>`;
  }

  // Oculta biometria
  if (biometricBtn) biometricBtn.style.display = "none";

  // Aviso na tela
  setMsg(
    "⚠️ Abra o sistema via https://localhost:8443 para ter acesso completo.",
    "error"
  );
}

// ─── Erros Firebase ───────────────────────────────────────────────────────────

function getAuthErrorMsg(code) {
  const errors = {
    "auth/invalid-credential":     "E-mail ou senha incorretos. Verifique e tente novamente.",
    "auth/wrong-password":         "Senha incorreta. Verifique e tente novamente.",
    "auth/user-not-found":         "Nenhuma conta encontrada com este e-mail.",
    "auth/invalid-email":          "O endereço de e-mail é inválido.",
    "auth/user-disabled":          "Esta conta foi desativada. Entre em contato com o suporte.",
    "auth/requires-recent-login":  "Por segurança, faça login novamente para continuar.",
    "auth/user-token-expired":     "Sua sessão expirou. Faça login novamente.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
    "auth/timeout":                "A requisição demorou muito. Tente novamente.",
    "auth/too-many-requests":      "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    "auth/quota-exceeded":         "Limite de requisições atingido. Tente novamente mais tarde.",
    "auth/operation-not-allowed":  "Este método de login não está habilitado.",
    "auth/operation-not-supported-in-this-environment":
      "Abra o sistema via https://localhost:8443.",
    "auth/popup-closed-by-user":   "Login com Google cancelado. Tente novamente.",
    "auth/cancelled-popup-request":"Requisição cancelada. Tente novamente.",
    "auth/account-exists-with-different-credential":
      "Este e-mail já está vinculado a outro método de login.",
    "auth/unauthorized-domain":
      "Domínio não autorizado. Adicione-o no Firebase Console.",
    "auth/internal-error":         "Erro interno. Tente novamente.",
  };
  return errors[code] || "Ocorreu um erro inesperado. Tente novamente.";
}

// ─── Verifica bloqueio no Firestore ──────────────────────────────────────────

async function checkUserBlocked(uid) {
  try {
    const doc = await __db.collection("users").doc(uid).get();
    if (!doc.exists) return false;
    return doc.data()?.blocked === true;
  } catch (err) {
    console.error("Erro ao verificar bloqueio:", err);
    return true;
  }
}

async function forceLogout() {
  try {
    clearSession();
    await __auth.signOut();
  } catch (_) {}
}

// ─── ✅ Inicializa Firebase Auth (só em http/https) ───────────────────────────

function initFirebaseAuth() {
  // ✅ Bloqueia completamente se for file://
  if (!CAN_USE_FIREBASE) {
    applyUnsafeEnvironmentUI();
    return;
  }

  // Configura persistência e escuta mudanças de sessão
  __auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
      __auth.onAuthStateChanged(async (user) => {
        if (!user) return;

        // Verifica bloqueio ao restaurar sessão persistida
        const isBlocked = await checkUserBlocked(user.uid);
        if (isBlocked) {
          await forceLogout();
          setMsg(
            "⛔ Sua conta está bloqueada. Entre em contato com o administrador.",
            "error"
          );
          return;
        }

        saveSession();
        goHome();
      });
    })
    .catch((err) => {
      console.error("Erro ao configurar persistência:", err);
      setMsg("Erro ao configurar login.", "error");
    });

  // Captura retorno do redirect do Google
  handleGoogleRedirectResult();

  // Inicializa biometria
  initBiometricLogin();

  // Configura botão Google
  initGoogleLogin();
}

// ─── Login com e-mail e senha ─────────────────────────────────────────────────

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  // ✅ Bloqueia submit se estiver em file://
  if (!CAN_USE_FIREBASE) {
    setMsg(
      "⚠️ Abra o sistema via https://localhost:8443 para fazer login.",
      "error"
    );
    return;
  }

  setMsg("Entrando...", "info");

  const email    = emailInput?.value.trim() || "";
  const password = passwordInput?.value     || "";

  if (!email)    return setMsg("Informe o e-mail.", "error");
  if (!password) return setMsg("Informe a senha.",  "error");

  try {
    const credential = await __auth.signInWithEmailAndPassword(email, password);
    const user       = credential.user;

    // Verifica bloqueio
    const isBlocked = await checkUserBlocked(user.uid);
    if (isBlocked) {
      await forceLogout();
      setMsg(
        "⛔ Sua conta está bloqueada. Entre em contato com o administrador.",
        "error"
      );
      return;
    }

    if (rememberMe?.checked) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    saveSession();
    goHome();

  } catch (err) {
    console.error(err);
    setMsg(getAuthErrorMsg(err.code), "error");
  }
});

// ─── Google: finaliza login ───────────────────────────────────────────────────

async function finishGoogleLogin(user) {
  const isBlocked = await checkUserBlocked(user.uid);
  if (isBlocked) {
    await forceLogout();
    setMsg(
      "⛔ Sua conta está bloqueada. Entre em contato com o administrador.",
      "error"
    );
    return;
  }

  // Garante perfil no Firestore
  if (window.__db) {
    const docRef  = __db.collection("users").doc(user.uid);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      await docRef.set({
        uid:         user.uid,
        ownerId:     user.uid,
        displayName: user.displayName || "",
        email:       user.email       || "",
        role:        "user",
        blocked:     false,
        createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }

  saveSession();
  setMsg("✅ Login com Google realizado!", "success");
  setTimeout(goHome, 800);
}

// ─── Trata retorno do redirect do Google ─────────────────────────────────────

async function handleGoogleRedirectResult() {
  // ✅ Ignora se não estiver em http/https
  if (!CAN_USE_GOOGLE) return;

  try {
    const result = await __auth.getRedirectResult();
    if (!result || !result.user) return;

    setMsg("Finalizando login com Google...", "info");
    await finishGoogleLogin(result.user);

  } catch (err) {
    if (err.code && err.code !== "auth/no-auth-event") {
      console.error("Erro no redirect Google:", err);
      setMsg(getAuthErrorMsg(err.code), "error");
    }
  }
}

// ─── Botão Google ─────────────────────────────────────────────────────────────

function initGoogleLogin() {
  if (!CAN_USE_GOOGLE) return;

  googleLoginBtn?.addEventListener("click", async () => {
    setMsg("Abrindo Google...", "info");

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      let result;

      try {
        // 1️⃣ Tenta popup
        result = await __auth.signInWithPopup(provider);
      } catch (popupErr) {
        // 2️⃣ Fallback para redirect
        if (
          popupErr.code === "auth/operation-not-supported-in-this-environment" ||
          popupErr.code === "auth/popup-blocked" ||
          popupErr.code === "auth/popup-closed-by-user"
        ) {
          setMsg("Redirecionando para o Google...", "info");
          await __auth.signInWithRedirect(provider);
          return;
        }
        throw popupErr;
      }

      await finishGoogleLogin(result.user);

    } catch (err) {
      console.error("Erro no login com Google:", err);
      setMsg(getAuthErrorMsg(err.code), "error");
    }
  });
}

// ─── Biometria ────────────────────────────────────────────────────────────────

function initBiometricLogin() {
  const uid       = localStorage.getItem(BIOMETRIC_KEY);
  const credIdB64 = localStorage.getItem(BIOMETRIC_CRED_KEY);

  // ✅ Só exibe se ambiente seguro + credencial registrada
  if (!CAN_USE_BIOMETRIC || !uid || !credIdB64 || !window.PublicKeyCredential) {
    if (biometricBtn) biometricBtn.style.display = "none";
    return;
  }

  if (biometricBtn) biometricBtn.style.display = "flex";

  biometricBtn?.addEventListener("click", async () => {
    try {
      setMsg("Aguardando biometria...", "info");

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credIdBytes = Uint8Array.from(
        atob(credIdB64),
        c => c.charCodeAt(0)
      );

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            type:       "public-key",
            id:         credIdBytes,
            transports: ["internal"]
          }],
          userVerification: "required",
          timeout:          60000
        }
      });

      if (!assertion) {
        setMsg("Biometria não reconhecida. Tente novamente.", "error");
        return;
      }

      // Verifica bloqueio antes de liberar
      const isBlocked = await checkUserBlocked(uid);
      if (isBlocked) {
        setMsg(
          "⛔ Sua conta está bloqueada. Entre em contato com o administrador.",
          "error"
        );
        return;
      }

      saveSession();
      setMsg("✅ Acesso liberado pela biometria!", "success");
      setTimeout(goHome, 800);

    } catch (err) {
      console.warn("Biometria falhou:", err);

      if (err.name === "SecurityError") {
        setMsg("⚠️ Biometria bloqueada. Acesse via https://localhost:8443", "error");
      } else if (err.name === "NotAllowedError") {
        setMsg("Biometria cancelada. Use e-mail e senha.", "error");
      } else if (err.name === "NotSupportedError") {
        setMsg("Biometria não suportada neste dispositivo.", "error");
        if (biometricBtn) biometricBtn.style.display = "none";
      } else {
        setMsg("Não foi possível autenticar pela biometria.", "error");
      }
    }
  });
}

// ─── ✅ Inicialização ─────────────────────────────────────────────────────────

initFirebaseAuth();