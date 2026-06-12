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

  strengthBar.className        = `password-strength-bar strength-${level}`;
  strengthBar.style.width      = `${level * 25}%`;
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
    const hidden    = input.type === "password";
    input.type      = hidden ? "text" : "password";
    btn.textContent = hidden ? "🙈" : "👁️";
  });
});

// ─── Salvar perfil no Firestore ───────────────────────────────────────────────

async function saveUserProfile(user, displayName, email) {
  if (!window.__db || !user?.uid) return;

  const docRef = __db.collection("users").doc(user.uid);
  await docRef.set({
    uid:         user.uid,
    ownerId:     user.uid,
    displayName: displayName || user.displayName || "",
    email:       email       || user.email       || "",
    role:        "user",
    blocked:     false,
    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

/* // ─── Biometria ──────────────────────────────────────────────────────────────── function offerBiometricRegistration(uid) { if (!window.PublicKeyCredential) return; if (!biometricRegisterBtn) return; biometricRegisterBtn.style.display = "flex"; biometricRegisterBtn.onclick = () => registerBiometric(uid); } async function registerBiometric(uid) { if (!window.PublicKeyCredential) { setMsg("Seu dispositivo não suporta biometria.", "error"); return; } try { setMsg("Aguardando biometria...", "info"); const challenge = new Uint8Array(32); crypto.getRandomValues(challenge); const credential = await navigator.credentials.create({ publicKey: { challenge, rp: { name: "Live Scores Tennis", id: location.hostname || "localhost" }, user: { id: new TextEncoder().encode(uid), name: emailInput?.value || uid, displayName: displayNameInput?.value || uid }, pubKeyCredParams: [ { type: "public-key", alg: -7 }, { type: "public-key", alg: -257 } ], authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" }, timeout: 60000, attestation: "none" } }); if (credential) { localStorage.setItem(BIOMETRIC_KEY, uid); localStorage.setItem( BIOMETRIC_CRED_KEY, btoa(String.fromCharCode(...new Uint8Array(credential.rawId))) ); setMsg("✅ Biometria registrada! Você pode usá-la no login.", "success"); if (biometricRegisterBtn) biometricRegisterBtn.style.display = "none"; setTimeout(goLogin, 1500); } } catch (err) { console.warn("Biometria cancelada ou não disponível:", err); if (err.name === "NotAllowedError") { setMsg("Biometria cancelada pelo usuário.", "error"); } else { setMsg("Não foi possível registrar a biometria.", "error"); } } } */

// ─── Google: finaliza cadastro após redirect ou popup ────────────────────────

async function finishGoogleRegister(user) {
  const displayName = user.displayName || "";
  const email       = user.email       || "";

  await saveUserProfile(user, displayName, email);

  localStorage.setItem(SESSION_KEY, "1");
  localStorage.removeItem(GOOGLE_PENDING_KEY);

  setMsg("✅ Conta Google vinculada com sucesso!", "success");

  /* offerBiometricRegistration(user.uid); if (!window.PublicKeyCredential) { setTimeout(goLogin, 1500); return; } // Se biometria disponível, aguarda clique no botão setTimeout(() => { if (!biometricRegisterBtn || biometricRegisterBtn.style.display === "none") { goLogin(); } }, 8000); // redireciona em 8s se não registrar biometria */

  setTimeout(goLogin, 1500);
}

// ─── ✅ Trata retorno do signInWithRedirect (Google) ──────────────────────────

async function handleGoogleRedirectResult() {
  try {
    const result = await __auth.getRedirectResult();
    if (!result || !result.user) return;

    setMsg("Finalizando cadastro com Google...", "info");
    await finishGoogleRegister(result.user);

  } catch (err) {
    // auth/no-auth-event é esperado quando não há redirect pendente
    if (err.code && err.code !== "auth/no-auth-event") {
      console.error("Erro no redirect Google:", err);
      setMsg(getFirebaseErrorMsg(err.code), "error");
    }
  }
}

// Executa ao carregar a página para capturar retorno do redirect
handleGoogleRedirectResult();

// ─── Cadastro com Google ──────────────────────────────────────────────────────

googleRegisterBtn?.addEventListener("click", async () => {
  setMsg("Abrindo Google...", "info");

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    // 1️⃣ Tenta popup primeiro (funciona em http/https)
    let result;

    try {
      result = await __auth.signInWithPopup(provider);
    } catch (popupErr) {

      // 2️⃣ Fallback: usa redirect se popup não for suportado ou bloqueado
      if (
        popupErr.code === "auth/operation-not-supported-in-this-environment" ||
        popupErr.code === "auth/popup-blocked" ||
        popupErr.code === "auth/popup-closed-by-user"
      ) {
        setMsg("Redirecionando para o Google...", "info");
        localStorage.setItem(GOOGLE_PENDING_KEY, "1");
        await __auth.signInWithRedirect(provider);
        return; // página recarrega após o redirect
      }

      throw popupErr;
    }

    // Popup funcionou — finaliza direto
    await finishGoogleRegister(result.user);

  } catch (err) {
    console.error("Erro no cadastro com Google:", err);
    setMsg(getFirebaseErrorMsg(err.code), "error");
  }
});

// ─── Cadastro com e-mail e senha ──────────────────────────────────────────────

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("Criando cadastro...", "info");

  const displayName     = displayNameInput?.value.trim() || "";
  const email           = emailInput?.value.trim()       || "";
  const password        = passwordInput?.value           || "";
  const confirmPassword = confirmPasswordInput?.value    || "";

  if (!displayName)                 return setMsg("Informe o nome.", "error");
  if (!email)                       return setMsg("Informe o e-mail.", "error");
  if (password.length < 8)          return setMsg("A senha deve ter no mínimo 8 caracteres.", "error");
  if (password !== confirmPassword) return setMsg("As senhas não conferem.", "error");

  // Valida força (mínimo 4 de 5 critérios)
  if (getPasswordStrength(password) < 4) {
    return setMsg(
      `Senha fraca. Adicione: ${getMissingRules(password).join(", ")}.`,
      "error"
    );
  }

  try {
    // 1️⃣ Cria conta no Firebase Auth
    const credential = await __auth.createUserWithEmailAndPassword(email, password);
    const user       = credential.user;

    if (!user) return setMsg("Não foi possível criar a conta.", "error");

    // 2️⃣ Atualiza displayName
    await user.updateProfile({ displayName });

    // 3️⃣ Salva no Firestore
    await saveUserProfile(user, displayName, email);

    localStorage.setItem(SESSION_KEY, "1");
    setMsg("✅ Cadastro criado com sucesso!", "success");

    /* // 4️⃣ Oferece biometria offerBiometricRegistration(user.uid); if (!window.PublicKeyCredential) { setTimeout(goLogin, 1200); } */

    setTimeout(goLogin, 1200);

  } catch (err) {
    console.error("Erro no cadastro:", err);
    setMsg(getFirebaseErrorMsg(err.code || ""), "error");

    // Remove conta órfã se Firestore falhou
    if (err.code !== "auth/email-already-in-use" && __auth.currentUser) {
      try {
        await __auth.currentUser.delete();
      } catch (deleteErr) {
        console.warn("Não foi possível remover usuário órfão:", deleteErr);
      }
    }
  }
});
