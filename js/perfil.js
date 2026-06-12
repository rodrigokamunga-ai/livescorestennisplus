(() => {
  "use strict";

  const ProfileApp = (() => {

    const getDb   = () => (typeof __db   !== "undefined" ? __db   : firebase.firestore());
    const getAuth = () => (typeof __auth !== "undefined" ? __auth : firebase.auth());

    // Sessões
    const ADMIN_KEY = "lsts_admin_session";
    const BIOMETRIC_SESSION_KEY = "lsts_biometric_session";
    const BIOMETRIC_UID_KEY = "lsts_biometric_uid";

    // Imagem padrão do avatar
    const DEFAULT_AVATAR = "img/perfil-padrao.png";

    // Configuração de resize/compressão da imagem
    const IMAGE_MAX_WIDTH = 512;
    const IMAGE_MAX_HEIGHT = 512;
    const IMAGE_MIME_TYPE = "image/jpeg";
    const IMAGE_QUALITY_LIST = [0.75, 0.65, 0.55, 0.45, 0.35];
    const MAX_BASE64_LENGTH = 900000;

    // ─── Estados e cidades ────────────────────────────────────────────────

    const BR_STATES = [
      { uf: "AC", name: "Acre" },       { uf: "AL", name: "Alagoas" },
      { uf: "AP", name: "Amapá" },      { uf: "AM", name: "Amazonas" },
      { uf: "BA", name: "Bahia" },      { uf: "CE", name: "Ceará" },
      { uf: "DF", name: "Distrito Federal" }, { uf: "ES", name: "Espírito Santo" },
      { uf: "GO", name: "Goiás" },      { uf: "MA", name: "Maranhão" },
      { uf: "MT", name: "Mato Grosso" }, { uf: "MS", name: "Mato Grosso do Sul" },
      { uf: "MG", name: "Minas Gerais" }, { uf: "PA", name: "Pará" },
      { uf: "PB", name: "Paraíba" },    { uf: "PR", name: "Paraná" },
      { uf: "PE", name: "Pernambuco" }, { uf: "PI", name: "Piauí" },
      { uf: "RJ", name: "Rio de Janeiro" }, { uf: "RN", name: "Rio Grande do Norte" },
      { uf: "RS", name: "Rio Grande do Sul" }, { uf: "RO", name: "Rondônia" },
      { uf: "RR", name: "Roraima" },    { uf: "SC", name: "Santa Catarina" },
      { uf: "SP", name: "São Paulo" },  { uf: "SE", name: "Sergipe" },
      { uf: "TO", name: "Tocantins" }
    ];

    const BR_CITIES = {
      AC: ["Rio Branco","Cruzeiro do Sul","Sena Madureira","Tarauacá","Feijó"],
      AL: ["Maceió","Arapiraca","Rio Largo","Palmeira dos Índios","União dos Palmares"],
      AP: ["Macapá","Santana","Laranjal do Jari","Oiapoque","Mazagão"],
      AM: ["Manaus","Parintins","Itacoatiara","Manacapuru","Coari"],
      BA: ["Salvador","Feira de Santana","Vitória da Conquista","Camaçari","Juazeiro","Ilhéus","Itabuna"],
      CE: ["Fortaleza","Caucaia","Juazeiro do Norte","Maracanaú","Sobral","Crato"],
      DF: ["Brasília","Ceilândia","Taguatinga","Samambaia","Plano Piloto"],
      ES: ["Vitória","Serra","Vila Velha","Cariacica","Cachoeiro de Itapemirim"],
      GO: ["Goiânia","Aparecida de Goiânia","Anápolis","Rio Verde","Luziânia"],
      MA: ["São Luís","Imperatriz","São José de Ribamar","Timon","Caxias"],
      MT: ["Cuiabá","Várzea Grande","Rondonópolis","Sinop","Tangará da Serra"],
      MS: ["Campo Grande","Dourados","Três Lagoas","Corumbá"],
      MG: ["Belo Horizonte","Uberlândia","Contagem","Juiz de Fora","Betim","Montes Claros","Uberaba"],
      PA: ["Belém","Ananindeua","Santarém","Marabá","Castanhal"],
      PB: ["João Pessoa","Campina Grande","Santa Rita","Patos","Bayeux"],
      PR: ["Curitiba","Londrina","Maringá","Ponta Grossa","Cascavel","São José dos Pinhais","Foz do Iguaçu"],
      PE: ["Recife","Caruaru","Olinda","Jaboatão dos Guararapes","Petrolina","Paulista"],
      PI: ["Teresina","Parnaíba","Picos","Piripiri","Floriano"],
      RJ: ["Rio de Janeiro","Niterói","Duque de Caxias","Nova Iguaçu","São Gonçalo","Campos dos Goytacazes","Petrópolis"],
      RN: ["Natal","Mossoró","Parnamirim","São Gonçalo do Amarante","Macaíba"],
      RS: ["Porto Alegre","Caxias do Sul","Pelotas","Canoas","Santa Maria","Gravataí","Novo Hamburgo"],
      RO: ["Porto Velho","Ji-Paraná","Ariquemes","Vilhena","Cacoal"],
      RR: ["Boa Vista","Rorainópolis","Caracaraí","Alto Alegre","Mucajaí"],
      SC: ["Florianópolis","Joinville","Blumenau","São José","Chapecó","Itajaí","Criciúma"],
      SP: ["São Paulo","Campinas","Santos","Ribeirão Preto","São José dos Campos","Sorocaba","Osasco","Santo André","São Bernardo do Campo","Guarulhos"],
      SE: ["Aracaju","Nossa Senhora do Socorro","Lagarto","Itabaiana","São Cristóvão"],
      TO: ["Palmas","Araguaína","Gurupi","Porto Nacional","Paraíso do Tocantins"]
    };

    // ─── Referências ──────────────────────────────────────────────────────

    const el = {
      form:                document.getElementById("profileForm"),
      displayName:         document.getElementById("displayName"),
      email:               document.getElementById("email"),
      phone:               document.getElementById("phone"),
      country:             document.getElementById("country"),
      stateLabel:          document.getElementById("stateLabel"),
      cityLabel:           document.getElementById("cityLabel"),
      state:               document.getElementById("state"),
      city:                document.getElementById("city"),
      gender:              document.getElementById("gender"),
      birthDate:           document.getElementById("birthDate"),
      height:              document.getElementById("height"),
      weight:              document.getElementById("weight"),
      photoFile:           document.getElementById("photoFile"),
      avatarPreview:       document.getElementById("avatarPreview"),
      photoFileName:       document.getElementById("photoFileName"),
      removePhotoBtn:      document.getElementById("removePhotoBtn"),
      msg:                 document.getElementById("profileMsg"),
      clearBtn:            document.getElementById("clearProfileBtn"),
      // Senha
      currentPassword:     document.getElementById("currentPassword"),
      newPassword:         document.getElementById("newPassword"),
      confirmPassword:     document.getElementById("confirmPassword"),
      changePasswordBtn:   document.getElementById("changePasswordBtn"),
      generatePasswordBtn: document.getElementById("generatePasswordBtn"),
      passwordMsg:         document.getElementById("passwordMsg"),
      // Deletar conta
      deleteAccountBtn:    document.getElementById("deleteAccountBtn"),
      deleteModalOverlay:  document.getElementById("deleteModalOverlay"),
      deleteConfirmInput:  document.getElementById("deleteConfirmInput"),
      confirmDeleteBtn:    document.getElementById("confirmDeleteBtn"),
      cancelDeleteBtn:     document.getElementById("cancelDeleteBtn"),
      deleteMsg:           document.getElementById("deleteMsg")
    };

    let currentUser = null;
    let savedPhotoBase64 = "";
    let previousDisplayName = "";
    let removePhotoRequested = false;

    // ─── Mensagens ────────────────────────────────────────────────────────

    function setMsg(text, type = "info") {
      if (!el.msg) return;
      el.msg.textContent = text || "";
      el.msg.style.color =
        type === "success" ? "#86efac" :
        type === "error"   ? "#fca5a5" :
                             "rgba(232,238,252,0.9)";
    }

    function setPasswordMsg(text, type = "info") {
      if (!el.passwordMsg) return;
      el.passwordMsg.textContent = text || "";
      el.passwordMsg.style.color =
        type === "success" ? "#86efac" :
        type === "error"   ? "#fca5a5" :
                             "rgba(232,238,252,0.9)";
    }

    function setDeleteMsg(text, type = "error") {
      if (!el.deleteMsg) return;
      el.deleteMsg.textContent = text || "";
      el.deleteMsg.style.color = type === "success" ? "#86efac" : "#fca5a5";
    }

    // ─── Helpers ──────────────────────────────────────────────────────────

    function hasAdminSession() {
      return localStorage.getItem(ADMIN_KEY) === "1";
    }

    function hasBiometricSession() {
      return localStorage.getItem(BIOMETRIC_SESSION_KEY) === "1";
    }

    function getBiometricUid() {
      return localStorage.getItem(BIOMETRIC_UID_KEY) || "";
    }

    function getRadioValue(name) {
      const checked = document.querySelector(`input[name="${name}"]:checked`);
      return checked ? checked.value : "";
    }

    function setRadioValue(name, value) {
      const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
      if (radio) radio.checked = true;
    }

    function populateStates(selectedUf = "") {
      if (!el.state) return;
      el.state.innerHTML = `<option value="">Selecione o estado</option>`;
      BR_STATES.forEach(({ uf, name }) => {
        const opt = document.createElement("option");
        opt.value = uf;
        opt.textContent = `${uf} — ${name}`;
        if (uf === selectedUf) opt.selected = true;
        el.state.appendChild(opt);
      });
    }

    function populateCities(uf, selectedCity = "") {
      if (!el.city) return;
      el.city.innerHTML = `<option value="">Selecione a cidade</option>`;
      const cities = BR_CITIES[uf] || [];
      cities.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        if (c === selectedCity) opt.selected = true;
        el.city.appendChild(opt);
      });
    }

    function toggleLocationFields(country, uf = "", city = "") {
      const isBR = country === "BR";
      if (el.stateLabel) el.stateLabel.style.display = isBR ? "" : "none";
      if (el.cityLabel)  el.cityLabel.style.display  = isBR ? "" : "none";
      if (isBR) {
        populateStates(uf);
        if (uf) populateCities(uf, city);
      }
    }

    function isStrongPassword(password) {
      const hasMinLength = password.length >= 8;
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasNumber    = /\d/.test(password);
      const hasSpecial   = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
      return hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
    }

    // ─── Imagem ───────────────────────────────────────────────────────────

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
          const img = new Image();

          img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > IMAGE_MAX_WIDTH) {
                height = Math.round((height * IMAGE_MAX_WIDTH) / width);
                width = IMAGE_MAX_WIDTH;
              }
            } else {
              if (height > IMAGE_MAX_HEIGHT) {
                width = Math.round((width * IMAGE_MAX_HEIGHT) / height);
                height = IMAGE_MAX_HEIGHT;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            for (const quality of IMAGE_QUALITY_LIST) {
              const dataUrl = canvas.toDataURL(IMAGE_MIME_TYPE, quality);
              if (dataUrl.length <= MAX_BASE64_LENGTH) {
                resolve(dataUrl);
                return;
              }
            }

            reject(new Error("A imagem continua muito grande após a compressão."));
          };

          img.onerror = reject;
          img.src = event.target.result;
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    function setDefaultAvatar() {
      if (el.avatarPreview) el.avatarPreview.src = DEFAULT_AVATAR;
    }

    function removePhoto() {
      removePhotoRequested = true;
      savedPhotoBase64 = "";

      if (el.photoFile) el.photoFile.value = "";
      if (el.photoFileName) el.photoFileName.textContent = "Nenhum arquivo selecionado";
      setDefaultAvatar();

      setMsg("Foto removida. Clique em salvar para confirmar a alteração.", "info");
    }

    // ─── Preenche formulário ──────────────────────────────────────────────

    function fillForm(data) {
      if (el.displayName) el.displayName.value = data.displayName || "";
      if (el.phone)       el.phone.value       = data.phone       || "";
      if (el.gender)      el.gender.value      = data.gender      || "";
      if (el.birthDate)   el.birthDate.value   = data.birthDate   || "";
      if (el.height)      el.height.value      = data.height      || "";
      if (el.weight)      el.weight.value      = data.weight      || "";
      if (data.forehand)  setRadioValue("forehand", data.forehand);
      if (data.backhand)  setRadioValue("backhand", data.backhand);

      if (el.country && data.country) {
        el.country.value = data.country;
        toggleLocationFields(data.country, data.state || "", data.city || "");
      }

      if (data.photoBase64) {
        savedPhotoBase64 = data.photoBase64;
        removePhotoRequested = false;
        if (el.avatarPreview) el.avatarPreview.src = data.photoBase64;
      } else {
        savedPhotoBase64 = "";
        setDefaultAvatar();
      }
    }

    // ─── Carrega perfil ───────────────────────────────────────────────────

    async function buildBiometricFallbackUser(user) {
      const uid = user?.uid || getBiometricUid();
      if (!uid) return null;

      const fallbackUser = {
        uid,
        email: "",
        displayName: ""
      };

      try {
        if (typeof __db === "undefined") return fallbackUser;

        const profileSnap = await __db.collection("profiles").doc(uid).get();
        const profileData = profileSnap.exists ? (profileSnap.data() || {}) : {};

        const userSnap = await __db.collection("users").doc(uid).get();
        const userData = userSnap.exists ? (userSnap.data() || {}) : {};

        fallbackUser.email = user?.email || userData.email || profileData.email || "";
        fallbackUser.displayName = profileData.displayName || userData.displayName || user?.displayName || "";
      } catch (err) {
        console.warn("Firestore indisponível para biometria, usando fallback mínimo.", err);
      }

      return fallbackUser;
    }

    async function loadProfile(user) {
      try {
        if (el.email)       el.email.value       = user.email       || "";
        if (el.displayName) el.displayName.value = user.displayName || "";

        previousDisplayName = user.displayName || "";

        const doc = await getDb().collection("profiles").doc(user.uid).get();
        if (doc.exists) {
          fillForm(doc.data());
        } else {
          savedPhotoBase64 = "";
          removePhotoRequested = false;
          setDefaultAvatar();
        }
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
        setMsg("Erro ao carregar perfil.", "error");
        setDefaultAvatar();
      }
    }

    // ─── Salva perfil ─────────────────────────────────────────────────────

    async function saveProfile(e) {
      e.preventDefault();
      if (!currentUser) return setMsg("Usuário não autenticado.", "error");
      setMsg("Salvando...", "info");

      try {
        let photoBase64 = savedPhotoBase64;
        const file = el.photoFile?.files?.[0];

        if (removePhotoRequested) {
          photoBase64 = "";
        } else if (file) {
          if (!file.type.startsWith("image/")) {
            return setMsg("Selecione uma imagem válida.", "error");
          }

          if (file.size > 10 * 1024 * 1024) {
            return setMsg("A imagem original está muito grande. Escolha uma menor.", "error");
          }

          photoBase64 = await fileToBase64(file);

          if (photoBase64.length > MAX_BASE64_LENGTH) {
            return setMsg("A foto ainda está muito grande. Escolha uma imagem menor.", "error");
          }
        }

        const newDisplayName = el.displayName?.value.trim() || "";

        const data = {
          displayName: newDisplayName,
          email:       currentUser.email || "",
          phone:       el.phone?.value.trim()  || "",
          country:     el.country?.value       || "",
          state:       el.state?.value         || "",
          city:        el.city?.value          || "",
          gender:      el.gender?.value        || "",
          birthDate:   el.birthDate?.value     || "",
          height:      el.height?.value        || "",
          weight:      el.weight?.value        || "",
          forehand:    getRadioValue("forehand"),
          backhand:    getRadioValue("backhand"),
          photoBase64,
          updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
        };

        await getDb().collection("profiles").doc(currentUser.uid).set(data, { merge: true });

        if (newDisplayName && newDisplayName !== currentUser.displayName) {
          await currentUser.updateProfile({ displayName: newDisplayName });
          previousDisplayName = newDisplayName;
        }

        if (photoBase64 && el.avatarPreview) {
          el.avatarPreview.src = photoBase64;
          savedPhotoBase64 = photoBase64;
        } else {
          savedPhotoBase64 = "";
          setDefaultAvatar();
        }

        removePhotoRequested = false;
        setMsg("✅ Perfil salvo com sucesso!", "success");
      } catch (err) {
        console.error("Erro ao salvar perfil:", err);
        setMsg(err.message || "Erro ao salvar perfil.", "error");
      }
    }

    // ─── Gerar senha forte ────────────────────────────────────────────────

    function generatePassword() {
      const upper   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const lower   = "abcdefghijklmnopqrstuvwxyz";
      const numbers = "0123456789";
      const symbols = "!@#$%^&*()_+-=[]{}|:,.<>?";
      const all     = upper + lower + numbers + symbols;

      const pwd = [
        upper  [Math.floor(Math.random() * upper.length)],
        lower  [Math.floor(Math.random() * lower.length)],
        numbers[Math.floor(Math.random() * numbers.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        ...Array.from({ length: 10 }, () => all[Math.floor(Math.random() * all.length)])
      ];

      for (let i = pwd.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
      }

      const generated = pwd.join("");

      if (el.newPassword)     el.newPassword.value     = generated;
      if (el.confirmPassword) el.confirmPassword.value = generated;

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(generated)
          .then(() => setPasswordMsg(`✅ Senha gerada e copiada: ${generated}`, "success"))
          .catch(() => setPasswordMsg(`✅ Senha gerada: ${generated}`, "success"));
      } else {
        setPasswordMsg(`✅ Senha gerada: ${generated}`, "success");
      }

      if (el.newPassword) {
        el.newPassword.type = "text";
        setTimeout(() => {
          if (el.newPassword) el.newPassword.type = "password";
        }, 3000);
      }
    }

    // ─── Alterar senha ────────────────────────────────────────────────────

    async function changePassword() {
      const current = el.currentPassword?.value || "";
      const next    = el.newPassword?.value     || "";
      const confirm = el.confirmPassword?.value || "";

      if (!current)         return setPasswordMsg("Informe a senha atual.", "error");
      if (!next)            return setPasswordMsg("Informe a nova senha.", "error");
      if (next !== confirm) return setPasswordMsg("As senhas não coincidem.", "error");

      if (!isStrongPassword(next)) {
        return setPasswordMsg(
          "A nova senha deve ter no mínimo 8 caracteres, com letras maiúsculas, minúsculas, número e caractere especial.",
          "error"
        );
      }

      setPasswordMsg("Alterando senha...", "info");

      try {
        const credential = firebase.auth.EmailAuthProvider.credential(
          currentUser.email,
          current
        );

        await currentUser.reauthenticateWithCredential(credential);
        await currentUser.updatePassword(next);

        if (el.currentPassword) el.currentPassword.value = "";
        if (el.newPassword)     el.newPassword.value     = "";
        if (el.confirmPassword) el.confirmPassword.value = "";

        setPasswordMsg("✅ Senha alterada com sucesso!", "success");
      } catch (err) {
        console.error("Erro ao alterar senha:", err);

        const msg =
          err.code === "auth/wrong-password"       ? "Senha atual incorreta." :
          err.code === "auth/weak-password"        ? "A nova senha é muito fraca." :
          err.code === "auth/requires-recent-login" ? "Faça login novamente para alterar a senha." :
          err.message || "Erro ao alterar senha.";

        setPasswordMsg(msg, "error");
      }
    }

    // ─── Deletar conta ────────────────────────────────────────────────────

    function openDeleteModal() {
      if (el.deleteModalOverlay) {
        el.deleteModalOverlay.classList.add("show");
        el.deleteModalOverlay.setAttribute("aria-hidden", "false");
      }
      if (el.deleteConfirmInput) el.deleteConfirmInput.value = "";
      if (el.confirmDeleteBtn)   el.confirmDeleteBtn.disabled = true;
      setDeleteMsg("");
    }

    function closeDeleteModal() {
      if (el.deleteModalOverlay) {
        el.deleteModalOverlay.classList.remove("show");
        el.deleteModalOverlay.setAttribute("aria-hidden", "true");
      }
    }

    async function deleteAccount() {
      if (!currentUser) return;

      setDeleteMsg("Excluindo conta...", "error");
      if (el.confirmDeleteBtn) el.confirmDeleteBtn.disabled = true;

      try {
        const db  = getDb();
        const uid = currentUser.uid;

        const password = prompt(
          "Por segurança, confirme sua senha atual para excluir a conta:"
        );
        if (!password) {
          setDeleteMsg("Operação cancelada.", "error");
          if (el.confirmDeleteBtn) el.confirmDeleteBtn.disabled = false;
          return;
        }

        const credential = firebase.auth.EmailAuthProvider.credential(
          currentUser.email,
          password
        );
        await currentUser.reauthenticateWithCredential(credential);

        await db.collection("profiles").doc(uid).delete();
        await db.collection("users").doc(uid).delete();

        const matchesSnap = await db
          .collection("matches")
          .where("ownerId", "==", uid)
          .get();

        if (!matchesSnap.empty) {
          const batch = db.batch();
          matchesSnap.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }

        await currentUser.delete();

        localStorage.clear();
        sessionStorage.clear();
        window.location.replace("login.html");
      } catch (err) {
        console.error("Erro ao deletar conta:", err);

        const errMsg =
          err.code === "auth/requires-recent-login"
            ? "Sessão expirada. Faça login novamente antes de deletar a conta." :
          err.code === "auth/wrong-password"
            ? "Senha incorreta. Não foi possível confirmar sua identidade." :
          err.code === "permission-denied"
            ? "Sem permissão. Verifique as regras do Firestore." :
            err.message || "Erro ao deletar a conta.";

        setDeleteMsg(errMsg, "error");
        if (el.confirmDeleteBtn) el.confirmDeleteBtn.disabled = false;
      }
    }

    // ─── Limpa formulário ──────────────────────────────────────────────────

    function clearForm() {
      if (!confirm("Deseja limpar os dados do formulário?")) return;

      if (el.phone)      el.phone.value      = "";
      if (el.gender)     el.gender.value     = "";
      if (el.birthDate)  el.birthDate.value  = "";
      if (el.height)     el.height.value     = "";
      if (el.weight)     el.weight.value     = "";
      if (el.country)    el.country.value    = "";

      if (el.stateLabel) el.stateLabel.style.display = "none";
      if (el.cityLabel)  el.cityLabel.style.display  = "none";
      if (el.state) el.state.innerHTML = `<option value="">Selecione o estado</option>`;
      if (el.city)  el.city.innerHTML  = `<option value="">Selecione a cidade</option>`;

      document.querySelectorAll('input[name="forehand"], input[name="backhand"]')
        .forEach((r) => r.checked = false);

      if (el.photoFile)     el.photoFile.value = "";
      if (el.photoFileName) el.photoFileName.textContent = "Nenhum arquivo selecionado";

      savedPhotoBase64 = "";
      removePhotoRequested = false;
      setDefaultAvatar();
      setMsg("Formulário limpo.", "info");
    }

    // ─── Eventos ───────────────────────────────────────────────────────────

    function bindEvents() {
      el.form?.addEventListener("submit", saveProfile);
      el.clearBtn?.addEventListener("click", clearForm);
      el.removePhotoBtn?.addEventListener("click", removePhoto);

      el.country?.addEventListener("change", function () {
        toggleLocationFields(this.value);
      });

      el.state?.addEventListener("change", function () {
        populateCities(this.value);
      });

      el.photoFile?.addEventListener("change", async function () {
        const file = this.files?.[0];

        if (!file) {
          if (el.photoFileName) el.photoFileName.textContent = "Nenhum arquivo selecionado";
          setDefaultAvatar();
          return;
        }

        if (!file.type.startsWith("image/")) {
          setMsg("Selecione uma imagem válida.", "error");
          this.value = "";
          if (el.photoFileName) el.photoFileName.textContent = "Nenhum arquivo selecionado";
          setDefaultAvatar();
          return;
        }

        if (el.photoFileName) el.photoFileName.textContent = file.name;
        removePhotoRequested = false;

        try {
          const resizedBase64 = await fileToBase64(file);
          if (el.avatarPreview) el.avatarPreview.src = resizedBase64;
        } catch (err) {
          console.error("Erro ao processar imagem:", err);
          setMsg("Erro ao processar a imagem.", "error");
          setDefaultAvatar();
        }
      });

      el.generatePasswordBtn?.addEventListener("click", generatePassword);
      el.changePasswordBtn?.addEventListener("click", changePassword);

      el.deleteAccountBtn?.addEventListener("click", openDeleteModal);
      el.cancelDeleteBtn?.addEventListener("click", closeDeleteModal);

      el.deleteModalOverlay?.addEventListener("click", (e) => {
        if (e.target === el.deleteModalOverlay) closeDeleteModal();
      });

      el.deleteConfirmInput?.addEventListener("input", function () {
        if (el.confirmDeleteBtn) {
          el.confirmDeleteBtn.disabled = this.value.trim() !== "DELETAR";
        }
      });

      el.confirmDeleteBtn?.addEventListener("click", deleteAccount);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDeleteModal();
      });

      document.getElementById("logoutBtnBottom")?.addEventListener("click", async () => {
        try {
          await getAuth().signOut();
          localStorage.removeItem(ADMIN_KEY);
          localStorage.removeItem(BIOMETRIC_SESSION_KEY);
          localStorage.clear();
          sessionStorage.clear();
          window.location.replace("login.html");
        } catch (err) {
          console.error("Erro ao sair:", err);
          setMsg("Erro ao sair.", "error");
        }
      });
    }

    // ─── Init ──────────────────────────────────────────────────────────────

    async function buildFallbackUser(user) {
      const uid = user?.uid || getBiometricUid();
      if (!uid) return null;

      const fallbackUser = {
        uid,
        email: user?.email || "",
        displayName: user?.displayName || ""
      };

      try {
        if (typeof __db === "undefined") return fallbackUser;

        const profileSnap = await __db.collection("profiles").doc(uid).get();
        const profileData = profileSnap.exists ? (profileSnap.data() || {}) : {};

        const userSnap = await __db.collection("users").doc(uid).get();
        const userData = userSnap.exists ? (userSnap.data() || {}) : {};

        fallbackUser.email = user?.email || userData.email || profileData.email || "";
        fallbackUser.displayName = profileData.displayName || userData.displayName || user?.displayName || "";
      } catch (err) {
        console.warn("Firestore indisponível para carregar perfil, usando fallback mínimo.", err);
      }

      return fallbackUser;
    }

    async function initUser(user) {
      if (user) {
        currentUser = user;
        const fullUser = await buildFallbackUser(user);
        currentUser = fullUser || user;
        if (el.email)       el.email.value       = currentUser.email || "";
        if (el.displayName) el.displayName.value = currentUser.displayName || "";
        previousDisplayName = currentUser.displayName || "";
        await loadProfile(currentUser);
        return;
      }

      if (hasAdminSession() || hasBiometricSession()) {
        const fallbackUser = await buildFallbackUser(null);
        if (!fallbackUser) {
          setMsg("Usuário não autenticado. Faça login para editar o perfil.", "error");
          setDefaultAvatar();
          return;
        }

        currentUser = fallbackUser;
        if (el.email)       el.email.value       = currentUser.email || "";
        if (el.displayName) el.displayName.value = currentUser.displayName || "";
        previousDisplayName = currentUser.displayName || "";
        await loadProfile(currentUser);
        return;
      }

      setMsg("Usuário não autenticado. Faça login para editar o perfil.", "error");
      setDefaultAvatar();
    }

    function init() {
      if (el.stateLabel) el.stateLabel.style.display = "none";
      if (el.cityLabel)  el.cityLabel.style.display  = "none";

      if (el.photoFile) {
        el.photoFile.setAttribute("accept", "image/*");
        el.photoFile.setAttribute("capture", "environment");
      }

      if (el.avatarPreview) {
        el.avatarPreview.src = DEFAULT_AVATAR;
      }

      bindEvents();

      getAuth().onAuthStateChanged(async (user) => {
        await initUser(user);
      });
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => ProfileApp.init());
})();
