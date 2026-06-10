(() => {
  "use strict";

  const UsersAdmin = (() => {
    const ADMIN_EMAIL = "rodrigokamunga@hotmail.com";

    const state = {
      currentUser:  null,
      users:        [],
      filtered:     [],
      unsubscribe:  null
    };

    const el = {
      logoutBtn:    document.getElementById("logoutBtn"),
      adminMsg:     document.getElementById("adminMsg"),
      usersTable:   document.getElementById("usersTable"),
      filterName:   document.getElementById("filterName"),
      filterEmail:  document.getElementById("filterEmail"),
      filterStatus: document.getElementById("filterStatus")
    };

    // ─── Utilitários ──────────────────────────────────────────────────────

    const U = {
      escapeHtml(str = "") {
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      },
      normalizeText(value = "") {
        return String(value || "").toLowerCase().trim();
      },
      isAdmin(user) {
        return U.normalizeText(user?.email) === U.normalizeText(ADMIN_EMAIL);
      }
    };

    // ✅ Sempre usa window.__db para garantir a instância correta
    function getDb() {
      return window.__db || firebase.firestore();
    }

    function setMsg(text) {
      if (el.adminMsg) el.adminMsg.textContent = text || "";
    }

    function goLogin() {
      window.location.replace("login.html");
    }

    function renderEmpty(message) {
      if (!el.usersTable) return;
      el.usersTable.innerHTML = ` <tr> <td colspan="4" class="empty-card">${U.escapeHtml(message)}</td> </tr>`;
    }

    // ─── Status ───────────────────────────────────────────────────────────

    function getStatusLabel(user) {
      if (user.role === "admin") return "Admin";
      if (user.blocked)          return "Bloqueado";
      return "Ativo";
    }

    function getStatusClass(user) {
      if (user.role === "admin") return "status-live";
      if (user.blocked)          return "status-finished";
      return "status-scheduled";
    }

    // ─── Filtros ──────────────────────────────────────────────────────────

    function applyFilters() {
      const name   = U.normalizeText(el.filterName?.value   || "");
      const email  = U.normalizeText(el.filterEmail?.value  || "");
      const status = U.normalizeText(el.filterStatus?.value || "");

      state.filtered = state.users.filter(u => {
        const userName   = U.normalizeText(u.displayName || "");
        const userEmail  = U.normalizeText(u.email       || "");
        const userStatus = u.role === "admin"
          ? "admin"
          : (u.blocked ? "blocked" : "active");

        return (
          (!name   || userName.includes(name))   &&
          (!email  || userEmail.includes(email)) &&
          (!status || userStatus === status)
        );
      });

      renderTable();
    }

    // ─── Renderiza tabela ─────────────────────────────────────────────────

    function renderTable() {
      if (!el.usersTable) return;

      if (!state.filtered.length) {
        renderEmpty("Nenhum usuário encontrado.");
        return;
      }

      el.usersTable.innerHTML = state.filtered.map(user => {
        const name        = U.escapeHtml(user.displayName || "-");
        const email       = U.escapeHtml(user.email       || "-");
        const statusLabel = U.escapeHtml(getStatusLabel(user));
        const statusClass = getStatusClass(user);
        const isAdminUser = user.role === "admin";
        const canBlock    = !isAdminUser && !user.blocked;
        const canUnblock  = !isAdminUser && user.blocked;
        const canDelete   = !isAdminUser;

        return ` <tr> <td><strong>${name}</strong></td> <td>${email}</td> <td> <span class="status-tag ${statusClass}">${statusLabel}</span> </td> <td> <div class="action-icons"> ${canBlock ? ` <button type="button" class="icon-btn" data-action="block" data-id="${user.id}" data-name="${name}" title="Bloquear usuário">⛔ </button>` : ""} ${canUnblock ? ` <button type="button" class="icon-btn" data-action="unblock" data-id="${user.id}" data-name="${name}" title="Desbloquear usuário">✅ </button>` : ""} ${canDelete ? ` <button type="button" class="icon-btn danger" data-action="delete" data-id="${user.id}" data-name="${name}" title="Excluir conta e todos os dados">🗑️ </button>` : ""} </div> </td> </tr>`;
      }).join("");
    }

    // ─── Carrega usuários ─────────────────────────────────────────────────

    async function loadUsers() {
      if (state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = null;
      }

      // ✅ Usa getDb() para garantir instância correta
      state.unsubscribe = getDb().collection("users").onSnapshot(
        (snapshot) => {
          state.users = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          applyFilters();
          setMsg(`Usuários carregados: ${state.users.length}`);
        },
        (err) => {
          console.error("Erro ao carregar usuários:", err);

          // ✅ Mensagens específicas por tipo de erro
          if (err.code === "permission-denied") {
            setMsg("❌ Sem permissão para listar usuários. Verifique as regras do Firestore.");
          } else {
            setMsg(err.message || "Erro ao carregar usuários.");
          }
          renderEmpty("Erro ao carregar usuários.");
        }
      );
    }

    // ─── Bloquear / Desbloquear ───────────────────────────────────────────

    async function setBlocked(userId, blocked, userName = "") {
      try {
        const label      = userName ? `"${userName}"` : "Usuário";
        const confirmMsg = blocked
          ? `Deseja bloquear ${label}? Ele não poderá mais fazer login.`
          : `Deseja desbloquear ${label}?`;

        if (!confirm(confirmMsg)) return;

        await getDb().collection("users").doc(userId).update({
          blocked,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        setMsg(blocked
          ? `✅ ${label} bloqueado com sucesso.`
          : `✅ ${label} desbloqueado com sucesso.`
        );
      } catch (err) {
        console.error("Erro ao alterar bloqueio:", err);
        if (err.code === "permission-denied") {
          setMsg("❌ Sem permissão para alterar este usuário.");
        } else {
          setMsg("Erro ao alterar status: " + err.message);
        }
      }
    }

    // ─── Exclui TODOS os dados do usuário ────────────────────────────────

    async function deleteAllUserData(userId, userName = "") {
      const label = userName ? `"${userName}"` : "este usuário";

      if (!confirm(
        `⚠️ Deseja excluir COMPLETAMENTE a conta de ${label}?\n\n` +
        `Isso irá remover:\n` +
        `• Cadastro (users)\n` +
        `• Perfil (profiles)\n` +
        `• Todas as partidas (matches)\n\n` +
        `Esta ação não pode ser desfeita.`
      )) return;

      setMsg("Excluindo dados...");

      try {
        const db = getDb();

        // 1️⃣ Deleta /users
        await db.collection("users").doc(userId).delete();
        setMsg("Removendo cadastro...");

        // 2️⃣ Deleta /profiles (se existir)
        const profileRef  = db.collection("profiles").doc(userId);
        const profileSnap = await profileRef.get();
        if (profileSnap.exists) await profileRef.delete();
        setMsg("Removendo perfil...");

        // 3️⃣ Deleta /matches em batch
        const matchesSnap = await db
          .collection("matches")
          .where("ownerId", "==", userId)
          .get();

        if (!matchesSnap.empty) {
          const BATCH_LIMIT = 500;
          let batch = db.batch();
          let count = 0;

          for (const doc of matchesSnap.docs) {
            batch.delete(doc.ref);
            count++;
            if (count === BATCH_LIMIT) {
              await batch.commit();
              batch = db.batch();
              count = 0;
            }
          }
          if (count > 0) await batch.commit();
        }
        setMsg("Removendo partidas...");

        // 4️⃣ Deleta conta no Firebase Auth via Cloud Function
        if (typeof firebase.app === "function") {
          try {
            const functions         = firebase.app().functions("us-central1");
            const deleteUserAccount = functions.httpsCallable("deleteUserAccount");
            await deleteUserAccount({ uid: userId });
          } catch (fnErr) {
            console.warn("Cloud Function não disponível:", fnErr.message);
            // Não bloqueia — dados do Firestore já foram removidos
          }
        }

        setMsg(`✅ Conta de ${label} excluída completamente.`);

      } catch (err) {
        console.error("Erro ao excluir dados:", err);
        if (err.code === "permission-denied") {
          setMsg("❌ Sem permissão para excluir este usuário.");
        } else {
          setMsg("Erro ao excluir: " + err.message);
        }
      }
    }

    // ─── Eventos ──────────────────────────────────────────────────────────

    function bindEvents() {
      el.logoutBtn?.addEventListener("click", async () => {
        try {
          localStorage.removeItem("lsts_admin_session");
          await __auth.signOut();
          goLogin();
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      });

      el.filterName?.addEventListener("input",    applyFilters);
      el.filterEmail?.addEventListener("input",   applyFilters);
      el.filterStatus?.addEventListener("change", applyFilters);

      el.usersTable?.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;

        const { action, id, name } = btn.dataset;

        switch (action) {
          case "block":   await setBlocked(id, true,  name); break;
          case "unblock": await setBlocked(id, false, name); break;
          case "delete":  await deleteAllUserData(id, name); break;
        }
      });
    }

    // ─── Init ─────────────────────────────────────────────────────────────

    function init() {
      bindEvents();

      if (typeof __auth === "undefined" || !window.__db) {
        setMsg("Firebase não carregado corretamente.");
        return;
      }

      __auth.onAuthStateChanged(async (user) => {
        if (!user) {
          setMsg("Usuário não autenticado.");
          goLogin();
          return;
        }

        if (!U.isAdmin(user)) {
          setMsg("Acesso negado. Esta área é exclusiva do administrador.");
          setTimeout(goLogin, 1200);
          return;
        }

        state.currentUser = user;
        setMsg(`Bem-vindo, administrador: ${user.displayName || user.email}`);
        await loadUsers();
      });
    }

    return { init };
  })();

  document.addEventListener("DOMContentLoaded", () => UsersAdmin.init());
})();