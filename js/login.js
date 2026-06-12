"use strict";

// ─── Referências ──────────────────────────────────────────────────────────────

const form           = document.getElementById("loginForm");
const msg            = document.getElementById("loginMsg");
const emailInput     = document.getElementById("email");
const passwordInput  = document.getElementById("password");
const rememberMe     = document.getElementById("rememberMe");
const biometricBtn   = document.getElementById("biometricLoginBtn");
const googleLoginBtn = document.getElementById("googleLoginBtn");

const REDIRECT_URL          = "menu.html";
const SESSION_KEY           = "lsts_admin_session";
const REMEMBER_EMAIL_KEY    = "rememberedEmail";

// legado
const BIOMETRIC_KEY         = "lsts_biometric_uid";
const BIOMETRIC_CRED_KEY    = "lsts_biometric_credId";
const BIOMETRIC_SESSION_KEY = "lsts_biometric_session";

// novo formato multiusuário
const BIOMETRIC_STORE_KEY   = "lsts_biometric_store";

// ─── Verificação de ambiente ──────────────────────────────────────────────────

const IS_FILE   = location.protocol === "file:";
const IS_HTTPS  = location.protocol === "https:";
const IS_LOCAL  = location.hostname === "localhost" ||
                  location.hostname === "127.0.0.1";
const IS_SECURE = window.isSecureContext;

const CAN_USE_FIREBASE  = !IS_FILE;
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

function markBiometricSession() {
  localStorage.setItem(BIOMETRIC_SESSION_KEY, "1");
}

function clearBiometricSessionFlags() {
  localStorage.removeItem(BIOMETRIC_SESSION_KEY);
}

// legado
function saveLegacyBiometricData(uid, credIdB64) {
  if (uid) localStorage.setItem(BIOMETRIC_KEY, uid);
  if (credIdB64) localStorage.setItem(BIOMETRIC_CRED_KEY, credIdB64);
}

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function bytesToB64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

function b64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64Url(bytes) {
  const base64 = bytesToB64(bytes);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(input) {
  let base64 = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return b64ToBytes(base64);
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

function getBiometricStore() {
  try {
    const raw = localStorage.getItem(BIOMETRIC_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function saveBiometricStore(store) {
  localStorage.setItem(BIOMETRIC_STORE_KEY, JSON.stringify(store || {}));
}

function saveBiometricRecord({ uid, email, credIdB64, credentialId = "" }) {
  if (!uid || !credIdB64) return;

  const store = getBiometricStore();
  store[uid] = {
    uid,
    email: normalizeEmail(email || ""),
    credIdB64,
    credentialId,
    updatedAt: Date.now()
  };
  saveBiometricStore(store);

  // compatibilidade com o modelo antigo
  saveLegacyBiometricData(uid, credIdB64);
}

function getBiometricRecordByUid(uid) {
  const store = getBiometricStore();
  return store[uid] || null;
}

function getAllBiometricRecords() {
  const store = getBiometricStore();
  return Object.values(store);
}

function getBiometricRecordByEmail(email) {
  const normalized = normalizeEmail(email);
  const records = getAllBiometricRecords();
  return records.find((r) => normalizeEmail(r.email) === normalized) || null;
}

// ─── Aviso de ambiente inseguro ───────────────────────────────────────────────

function applyUnsafeEnvironmentUI() {
  if (googleLoginBtn) {
    googleLoginBtn.disabled = true;
    googleLoginBtn.style.opacity = "0.4";
    googleLoginBtn.style.cursor = "not-allowed";
    googleLoginBtn.style.pointerEvents = "none";
    googleLoginBtn.innerHTML =
      `<span>⚠️ Google indisponível — abra via https://localhost:8443</span>`;
  }

  if (biometricBtn) biometricBtn.style.display = "none";

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
    "auth/network-request-failed":  "Falha de conexão. Verifique sua internet.",
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
// true => bloqueado
// false => liberado
// null => não foi possível verificar

async function checkUserBlocked(uid) {
  try {
    const db = getDb();
    if (!db) {
      console.warn("Firestore não inicializado.");
      return null;
    }

    const doc = await db.collection("users").doc(uid).get();

    if (!doc.exists) {
      console.warn("Documento do usuário não encontrado:", uid);
      return null;
    }

    const data = doc.data() || {};
    return data.blocked === true;
  } catch (err) {
    console.error("Erro ao verificar bloqueio:", err);
    return null;
  }
}

async function ensureUserDoc(user) {
  try {
    const db = getDb();
    if (!db || !user) return;

    const docRef = db.collection("users").doc(user.uid);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      await docRef.set({
        uid:         user.uid,
        ownerId:     user.uid,
        displayName: user.displayName || "",
        email:       normalizeEmail(user.email || ""),
        role:        "user",
        blocked:     false,
        createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } else {
      const data = docSnap.data() || {};
      if (typeof data.blocked === "undefined") {
        await docRef.set({
          blocked: false,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
  } catch (err) {
    console.error("Erro ao garantir documento do usuário:", err);
  }
}

async function forceLogout() {
  try {
    clearSession();
    clearBiometricSessionFlags();
    const auth = getAuth();
    if (auth) await auth.signOut();
  } catch (_) {}
}

async function findUserByEmail(email) {
  try {
    const db = getDb();
    if (!db || !email) return null;

    const normalized = normalizeEmail(email);

    let snap = await db.collection("users")
      .where("email", "==", normalized)
      .limit(1)
      .get();

    if (!snap.empty) {
      const doc = snap.docs[0];
      return { uid: doc.id, ...(doc.data() || {}) };
    }

    snap = await db.collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!snap.empty) {
      const doc = snap.docs[0];
      return { uid: doc.id, ...(doc.data() || {}) };
    }

    return null;
  } catch (err) {
    console.warn("Não foi possível localizar usuário por e-mail:", err);
    return null;
  }
}

// ─── Registro biométrico automático ──────────────────────────────────────────

async function createBiometricCredentialForUser(user) {
  if (!user) throw new Error("Usuário inválido.");
  if (!window.PublicKeyCredential || !navigator.credentials?.create) {
    throw new Error("Este navegador não suporta cadastro biométrico.");
  }

  const db = getDb();

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const userIdBytes = new TextEncoder().encode(String(user.uid));

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: "Live Scores Tennis"
      },
      user: {
        id: userIdBytes.slice(0, 64),
        name: normalizeEmail(user.email || ""),
        displayName: user.displayName || user.email || "Usuário"
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },    // ES256
        { type: "public-key", alg: -257 }   // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred"
      },
      timeout: 60000,
      attestation: "none"
    }
  });

  if (!credential) {
    throw new Error("Não foi possível criar a credencial biométrica.");
  }

  const credIdB64 = bytesToBase64Url(new Uint8Array(credential.rawId));

  saveBiometricRecord({
    uid: user.uid,
    email: user.email || "",
    credIdB64,
    credentialId: credIdB64
  });

  if (db) {
    await db.collection("biometrics").doc(user.uid).set({
      uid: user.uid,
      email: normalizeEmail(user.email || ""),
      credIdB64,
      credentialId: credIdB64,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  return credIdB64;
}

async function ensureBiometricEnrollment(user) {
  if (!user) return;

  const existingLocal = getBiometricRecordByUid(user.uid);
  if (existingLocal?.credIdB64) return;

  const db = getDb();

  // tenta recuperar do Firestore
  try {
    if (db) {
      const snap = await db.collection("biometrics").doc(user.uid).get();
      if (snap.exists) {
        const data = snap.data() || {};
        if (data.credIdB64) {
          saveBiometricRecord({
            uid: user.uid,
            email: data.email || user.email || "",
            credIdB64: data.credIdB64,
            credentialId: data.credentialId || data.credIdB64
          });
          return;
        }
      }
    }
  } catch (err) {
    console.warn("Não foi possível carregar biometria do Firestore:", err);
  }

  // se não existe, cria automaticamente no primeiro login
  try {
    await createBiometricCredentialForUser(user);
    console.log("Biometria cadastrada automaticamente para:", user.uid);
  } catch (err) {
    console.warn("Cadastro automático de biometria não realizado:", err.message || err);
  }
}

function resolveBiometricRecordFromLoginEmail(email) {
  const normalized = normalizeEmail(email);

  // 1) procura no localStorage multiusuário pelo email
  const byEmail = getBiometricRecordByEmail(normalized);
  if (byEmail) return byEmail;

  // 2) tenta localizar usuário no Firestore e usar o UID
  return null;
}

// ─── Inicializa Firebase Auth ────────────────────────────────────────────────

function initFirebaseAuth() {
  if (!CAN_USE_FIREBASE) {
    applyUnsafeEnvironmentUI();
    return;
  }

  const auth = getAuth();
  if (!auth) {
    setMsg("Firebase Auth não carregado corretamente.", "error");
    return;
  }

  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
      auth.onAuthStateChanged(async (user) => {
        if (!user) return;

        const isBlocked = await checkUserBlocked(user.uid);

        if (isBlocked === true) {
          await forceLogout();
          setMsg(
            "⛔ Sua conta está bloqueada. Entre em contato com o administrador.",
            "error"
          );
          return;
        }

        if (isBlocked === null) {
          console.warn("Não foi possível verificar bloqueio na restauração da sessão.");
        }

        await ensureUserDoc(user);

        // auto-registro biométrico no primeiro login
        await ensureBiometricEnrollment(user);

        saveSession();
        clearBiometricSessionFlags();
        goHome();
      });
    })
    .catch((err) => {
      console.error("Erro ao configurar persistência:", err);
      setMsg("Erro ao configurar login.", "error");
    });

  handleGoogleRedirectResult();
  initBiometricLogin();
  initGoogleLogin();
}

// ─── Login com e-mail e senha ─────────────────────────────────────────────────

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!CAN_USE_FIREBASE) {
    setMsg(
      "⚠️ Abra o sistema via https://localhost:8443 para fazer login.",
      "error"
    );
    return;
  }

  setMsg("Entrando...", "info");

  const email    = emailInput?.value.trim() || "";
  const password = passwordInput?.value || "";

  if (!email)    return setMsg("Informe o e-mail.", "error");
  if (!password) return setMsg("Informe a senha.", "error");

  try {
    const auth = getAuth();
    const credential = await auth.signInWithEmailAndPassword(email, password);
    const user = credential.user;

    if (!user) {
      setMsg("Não foi possível obter os dados do usuário.", "error");
      return;
    }

    const isBlocked = await checkUserBlocked(user.uid);

    if (isBlocked === true) {
      await forceLogout();
      setMsg(
        "⛔ Sua conta está bloqueada. Entre em contato com o administrador.",
        "error"
      );
      return;
    }

    if (isBlocked === null) {
      await forceLogout();
      setMsg(
        "⚠️ Não foi possível validar sua conta agora. Tente novamente.",
        "error"
      );
      return;
    }

    await ensureUserDoc(user);

    // auto-registro biométrico no primeiro login
    await ensureBiometricEnrollment(user);

    if (rememberMe?.checked) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    saveLegacyBiometricData(user.uid, localStorage.getItem(BIOMETRIC_CRED_KEY));
    saveSession();
    clearBiometricSessionFlags();
    goHome();

  } catch (err) {
    console.error(err);
    setMsg(getAuthErrorMsg(err.code), "error");
  }
});

// ─── Google: finaliza login ───────────────────────────────────────────────────

async function finishGoogleLogin(user) {
  const isBlocked = await checkUserBlocked(user.uid);

  if (isBlocked === true) {
    await forceLogout();
    setMsg(
      "⛔ Sua conta está bloqueada. Entre em contato com o administrador.",
      "error"
    );
    return;
  }

  if (isBlocked === null) {
    await forceLogout();
    setMsg(
      "⚠️ Não foi possível validar sua conta agora. Tente novamente.",
      "error"
    );
    return;
  }

  await ensureUserDoc(user);

  // auto-registro biométrico no primeiro login
  await ensureBiometricEnrollment(user);

  saveLegacyBiometricData(user.uid, localStorage.getItem(BIOMETRIC_CRED_KEY));
  saveSession();
  clearBiometricSessionFlags();
  setMsg("✅ Login com Google realizado!", "success");
  setTimeout(goHome, 800);
}

// ─── Trata retorno do redirect do Google ─────────────────────────────────────

async function handleGoogleRedirectResult() {
  if (!CAN_USE_GOOGLE) return;

  try {
    const auth = getAuth();
    const result = await auth.getRedirectResult();
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

    const auth = getAuth();
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      let result;

      try {
        result = await auth.signInWithPopup(provider);
      } catch (popupErr) {
        if (
          popupErr.code === "auth/operation-not-supported-in-this-environment" ||
          popupErr.code === "auth/popup-blocked" ||
          popupErr.code === "auth/popup-closed-by-user"
        ) {
          setMsg("Redirecionando para o Google...", "info");
          await auth.signInWithRedirect(provider);
          return;
        }
        throw popupErr;
      }

      if (result?.user) {
        await finishGoogleLogin(result.user);
      } else {
        setMsg("Não foi possível concluir o login com Google.", "error");
      }

    } catch (err) {
      console.error("Erro no login com Google:", err);
      setMsg(getAuthErrorMsg(err.code), "error");
    }
  });
}

// ─── Biometria ────────────────────────────────────────────────────────────────

function initBiometricLogin() {
  if (!CAN_USE_BIOMETRIC || !window.PublicKeyCredential) {
    if (biometricBtn) biometricBtn.style.display = "none";
    return;
  }

  if (biometricBtn) {
    biometricBtn.style.display = "flex";
    biometricBtn.disabled = false;
    biometricBtn.title = "Entrar com biometria";
    biometricBtn.style.opacity = "1";
    biometricBtn.style.cursor = "pointer";
  }

  biometricBtn?.addEventListener("click", async () => {
    try {
      const email = normalizeEmail(emailInput?.value || "");

      let biometricRecord = null;
      let targetUser = null;

      if (email) {
        targetUser = await findUserByEmail(email);

        // 1) tenta achar biometria pelo email
        biometricRecord = getBiometricRecordByEmail(email);

        // 2) se existe usuário, tenta biometria por uid
        if (!biometricRecord && targetUser?.uid) {
          biometricRecord = getBiometricRecordByUid(targetUser.uid);
        }
      }

      // fallback: se só tiver 1 usuário cadastrado no aparelho, usa ele
      if (!biometricRecord) {
        const records = getAllBiometricRecords();
        if (records.length === 1) {
          biometricRecord = records[0];
          targetUser = targetUser || await findUserByEmail(biometricRecord.email || "");
        }
      }

      // fallback legado
      if (!biometricRecord) {
        const legacyUid = localStorage.getItem(BIOMETRIC_KEY);
        const legacyCred = localStorage.getItem(BIOMETRIC_CRED_KEY);
        if (legacyUid && legacyCred) {
          biometricRecord = {
            uid: legacyUid,
            email: "",
            credIdB64: legacyCred
          };
        }
      }

      if (!biometricRecord?.credIdB64) {
        setMsg(
          email
            ? "Biometria não cadastrada para este e-mail neste aparelho."
            : "Digite seu e-mail para localizar a biometria cadastrada.",
          "error"
        );
        return;
      }

      const uid = biometricRecord.uid || targetUser?.uid;
      if (!uid) {
        setMsg("Não foi possível identificar o usuário biométrico.", "error");
        return;
      }

      setMsg("Aguardando biometria...", "info");

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credIdBytes = base64UrlToBytes(biometricRecord.credIdB64);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            type: "public-key",
            id: credIdBytes,
            transports: ["internal"]
          }],
          userVerification: "required",
          timeout: 60000
        }
      });

      if (!assertion) {
        setMsg("Biometria não reconhecida. Tente novamente.", "error");
        return;
      }

      const isBlocked = await checkUserBlocked(uid);

      if (isBlocked === true) {
        setMsg(
          "⛔ Sua conta está bloqueada. Entre em contato com o administrador.",
          "error"
        );
        return;
      }

      if (isBlocked === null) {
        console.warn("Não foi possível validar a conta no Firestore. Liberando pela biometria.");
        setMsg(
          "✅ Biometria validada. Validação da conta indisponível no momento.",
          "success"
        );
      }

      saveSession();
      markBiometricSession();
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
      } else {
        setMsg("Não foi possível autenticar pela biometria.", "error");
      }
    }
  });
}

// ─── Inicialização ────────────────────────────────────────────────────────────

initFirebaseAuth();
