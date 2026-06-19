"use strict";

// ─── Referências ──────────────────────────────────────────────────────────────

const form                 = document.getElementById("registerForm");
const msg                  = document.getElementById("registerMsg");
const displayNameInput     = document.getElementById("displayName");
const emailInput           = document.getElementById("email");
const passwordInput        = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const strengthBar          = document.getElementById("strengthBar");
const strengthLabel        = document.getElementById("strengthLabel");
const googleRegisterBtn    = document.getElementById("googleRegisterBtn");
const biometricRegisterBtn = document.getElementById("biometricRegisterBtn");

const SESSION_KEY          = "lsts_admin_session";
const BIOMETRIC_KEY        = "lsts_biometric_uid";
const BIOMETRIC_CRED_KEY   = "lsts_biometric_credId";
const GOOGLE_PENDING_KEY   = "lsts_google_register_pending";

// ─── Firebase helpers ─────────────────────────────────────────────────────────

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

// ─── Mensagem ─────────────────────────────────────────────────────────────────

function setMsg(text, type = "info") {
  if (!msg) return;
  msg.textContent = text || "";
  msg.style.color =
    type === "success" ? "#86efac" :
    type === "error"   ? "#fca5a5" :
                         "rgba(232,238,252,0.9)";
}

function goLogin() {
  window.location.replace("login.html");
}

// ─── Erros Firebase ───────────────────────────────────────────────────────────

function getFirebaseErrorMsg(code) {
  const errors = {
    "auth/email-already-in-use":
      "Este e-mail já está cadastrado. Faça login ou use outro e-mail.",
    "auth/invalid-email":
      "O endereço de e-mail é inválido.",
    "auth/weak-password":
      "A senha é muito fraca. Use no mínimo 8 caracteres.",
    "auth/network-request-failed":
      "Falha de conexão. Verifique sua internet.",
    "auth/too-many-requests":
      "Muitas tentativas. Tente novamente mais tarde.",
    "auth/popup-closed-by-user":
      "Login com Google cancelado. Tente novamente.",
    "auth/cancelled-popup-request":
      "Requisição cancelada. Tente novamente.",
    "auth/operation-not-supported-in-this-environment":
      "Abra o sistema em http:// ou https:// para usar o Google.",
    "auth/account-exists-with-different-credential":
      "Este e-mail já está vinculado a outro método de login.",
    "permission-denied":
      "Sem permissão para salvar os dados. Contate o suporte.",
  };
  return errors[code] || "Ocorreu um erro inesperado. Tente novamente.";
}

// ─── Força da senha ───────────────────────────────────────────────────────────

const PASSWORD_RULES = [
  { re: /.{8,}/,        label: "mínimo 8 caracteres"      },
  { re: /[A-Z]/,        label: "letra maiúscula"          },
  { re: /[a-z]/,        label: "letra minúscula"          },
  { re: /[0-9]/,        label: "número"                   },
  { re: /[^A-Za-z0-9]/, label: "caractere especial (!@#…)" }
];

function getPasswordStrength(password) {
  return PASSWORD_RULES.filter(r => r.re.test(password)).length;
}

function getMissingRules(password) {
  return PASSWORD_RULES
    .filter(r => !r.re.test(password))
    .map(r => r.label);
}

function updateStrengthUI(password) {
  if (!strengthBar || !strengthLabel) return;

  const strength = getPasswordStrength(password);
  const level    = Math.min(4, Math.floor(strength * 4 / 5));
  const colors   = ["transparent", "#e74c3c", "#f39c12", "#2ecc71", "#27ae60"];

  strengthBar.className   = `password-strength-bar strength-${level}`;
  strengthBar.style.width  = `${level * 25}%`;
  strengthBar.style.background = colors[level];

  if (!password) {
    strengthLabel.textContent = "";
    strengthLabel.style.color = "";
    return;
  }

  const missing = getMissingRules(password);
  if (missing.length) {
    strengthLabel.textContent = `Faltam: ${missing.join(", ")}`;
    strengthLabel.style.color = colors[level];
  } else {
    strengthLabel.textContent = "✅ Senha forte!";
    strengthLabel.style.color = "#27ae60";
  }
}

passwordInput?.addEventListener("input", () => {
  updateStrengthUI(passwordInput.value);
});

// ─── Mostrar/ocultar senha ────────────────────────────────────────────────────

document.querySelectorAll(".toggle-pw").forEach(btn => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;

    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    btn.textContent = hidden ? "🙈" : "👁️";
  });
});

// ─── Player ID personalizado ──────────────────────────────────────────────────

function normalizePlayerName(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function generatePlayerIdFallback(displayName, uid) {
  const base = normalizePlayerName(displayName) || "player";
  const shortUid = (uid || "anon").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toLowerCase();
  return `${base}_${shortUid}_id`;
}

async function generateUniquePlayerId(displayName, uid) {
  const safeUid = (uid || "").trim();
  const safeDisplayName = (displayName || "").trim();

  const fallbackId = generatePlayerIdFallback(safeDisplayName, safeUid);

  console.log("[register] generateUniquePlayerId()");
  console.log("displayName:", safeDisplayName);
  console.log("uid:", safeUid);
  console.log("playerId gerado:", fallbackId);

  return fallbackId;
}

// ─── Salvar perfil no Firestore ───────────────────────────────────────────────

async function saveUserProfile(user, displayName, email) {
  const db = getDb();
  if (!db || !user?.uid) {
    console.error("[register] Firestore ou user.uid não disponível.");
    return null;
  }

  const safeDisplayName = (displayName || user.displayName || "").trim();
  const safeEmail = (email || user.email || "").trim();

  const playerId = await generateUniquePlayerId(safeDisplayName, user.uid);

  const data = {
    uid:         user.uid,
    ownerId:     user.uid,
    playerId:    playerId,
    displayName: safeDisplayName,
    email:       safeEmail,
    role:        "user",
    blocked:     false,
    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
  };

  console.log("[register] salvando no Firestore users/{uid} ->", user.uid);
  console.log("[register] dados:", data);

  await db.collection("users").doc(user.uid).set(data, { merge: true });

  console.log("[register] usuário salvo com sucesso.");
  return playerId;
}

/* // ─── Biometria ──────────────────────────────────────────────────────────────── function offerBiometricRegistration(uid) { if (!window.PublicKeyCredential) return; if (!biometricRegisterBtn) return; biometricRegisterBtn.style.display = "flex"; biometricRegisterBtn.onclick = () => registerBiometric(uid); } async function registerBiometric(uid) { if (!window.PublicKeyCredential) { setMsg("Seu dispositivo não suporta biometria.", "error"); return; } try { setMsg("Aguardando biometria...", "info"); const challenge = new Uint8Array(32); crypto.getRandomValues(challenge); const credential = await navigator.credentials.create({ publicKey: { challenge, rp: { name: "Live Scores Tennis", id: location.hostname || "localhost" }, user: { id: new TextEncoder().encode(uid), name: emailInput?.value || uid, displayName: displayNameInput?.value || uid }, pubKeyCredParams: [ { type: "public-key", alg: -7 }, { type: "public-key", alg: -257 } ], authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" }, timeout: 60000, attestation: "none" } }); if (credential) { localStorage.setItem(BIOMETRIC_KEY, uid); localStorage.setItem( BIOMETRIC_CRED_KEY, btoa(String.fromCharCode(...new Uint8Array(credential.rawId))) ); setMsg("✅ Biometria registrada! Você pode usá-la no login.", "success"); if (biometricRegisterBtn) biometricRegisterBtn.style.display = "none"; setTimeout(goLogin, 1500); } } catch (err) { console.warn("Biometria cancelada ou não disponível:", err); if (err.name === "NotAllowedError") { setMsg("Biometria cancelada pelo usuário.", "error"); } else { setMsg("Não foi possível registrar a biometria.", "error"); } } } */

// ─── Google: finaliza cadastro após redirect ou popup ────────────────────────

async function finishGoogleRegister(user) {
  const displayName = user.displayName || "";
  const email = user.email || "";

  console.log("[register] finishGoogleRegister()", { displayName, email, uid: user.uid });

  const playerId = await saveUserProfile(user, displayName, email);

  localStorage.setItem(SESSION_KEY, "1");
  localStorage.removeItem(GOOGLE_PENDING_KEY);

  setMsg(`✅ Conta Google vinculada com sucesso! Seu ID: @${playerId}`, "success");

  setTimeout(goLogin, 1500);
}

// ─── Trata retorno do signInWithRedirect (Google) ────────────────────────────

async function handleGoogleRedirectResult() {
  try {
    const auth = getAuth();
    if (!auth) return;

    const result = await auth.getRedirectResult();
    if (!result || !result.user) return;

    setMsg("Finalizando cadastro com Google...", "info");
    await finishGoogleRegister(result.user);

  } catch (err) {
    if (err.code && err.code !== "auth/no-auth-event") {
      console.error("[register] Erro no redirect Google:", err);
      setMsg(getFirebaseErrorMsg(err.code), "error");
    }
  }
}

handleGoogleRedirectResult();

// ─── Cadastro com Google ─────────────────────────────────────────────────────

googleRegisterBtn?.addEventListener("click", async () => {
  setMsg("Abrindo Google...", "info");

  const auth = getAuth();
  if (!auth) {
    setMsg("Firebase Auth não disponível.", "error");
    return;
  }

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
        localStorage.setItem(GOOGLE_PENDING_KEY, "1");
        await auth.signInWithRedirect(provider);
        return;
      }

      throw popupErr;
    }

    await finishGoogleRegister(result.user);

  } catch (err) {
    console.error("[register] Erro no cadastro com Google:", err);
    setMsg(getFirebaseErrorMsg(err.code), "error");
  }
});

// ─── Cadastro com e-mail e senha ─────────────────────────────────────────────

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("Criando cadastro...", "info");

  const displayName     = displayNameInput?.value.trim() || "";
  const email           = emailInput?.value.trim() || "";
  const password        = passwordInput?.value || "";
  const confirmPassword = confirmPasswordInput?.value || "";

  if (!displayName) return setMsg("Informe o nome.", "error");
  if (!email) return setMsg("Informe o e-mail.", "error");
  if (password.length < 8) return setMsg("A senha deve ter no mínimo 8 caracteres.", "error");
  if (password !== confirmPassword) return setMsg("As senhas não conferem.", "error");

  if (getPasswordStrength(password) < 4) {
    return setMsg(
      `Senha fraca. Adicione: ${getMissingRules(password).join(", ")}.`,
      "error"
    );
  }

  try {
    const auth = getAuth();
    if (!auth) {
      setMsg("Firebase Auth não disponível.", "error");
      return;
    }

    const credential = await auth.createUserWithEmailAndPassword(email, password);
    const user = credential.user;

    if (!user) return setMsg("Não foi possível criar a conta.", "error");

    await user.updateProfile({ displayName });

    console.log("[register] usuário Auth criado:", {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email
    });

    const playerId = await saveUserProfile(user, displayName, email);

    localStorage.setItem(SESSION_KEY, "1");

    console.log("[register] cadastro concluído com playerId:", playerId);
    setMsg(`✅ Cadastro criado com sucesso! Seu ID: @${playerId}`, "success");

    setTimeout(goLogin, 1200);

  } catch (err) {
    console.error("[register] Erro no cadastro:", err);
    setMsg(getFirebaseErrorMsg(err.code || ""), "error");

    if (err.code !== "auth/email-already-in-use") {
      const auth = getAuth();
      if (auth?.currentUser) {
        try {
          await auth.currentUser.delete();
        } catch (deleteErr) {
          console.warn("[register] Não foi possível remover usuário órfão:", deleteErr);
        }
      }
    }
  }
});
