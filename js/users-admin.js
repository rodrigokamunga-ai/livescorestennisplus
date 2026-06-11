(() => {
  "use strict";

  const UsersAdmin = (() => {
    const ADMIN_EMAIL = "rodrigokamunga@hotmail.com";
    const PAGE_SIZE = 10;
    const MOBILE_BREAKPOINT = 768;

    const state = {
      currentUser: null,
      users: [],
      filtered: [],
      unsubscribe: null,
      page: 1
    };

    const el = {
      logoutBtn: document.getElementById("logoutBtn"),
      adminMsg: document.getElementById("adminMsg"),
      usersTable: document.getElementById("usersTable"),
      filterName: document.getElementById("filterName"),
      filterEmail: document.getElementById("filterEmail"),
      filterStatus: document.getElementById("filterStatus"),
      paginationBar: document.getElementById("paginationBar")
    };

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

    function getDb() {
      if (window.__db) return window.__db;
      if (typeof firebase !== "undefined" && firebase.firestore) return firebase.firestore();
      return null;
    }

    function getAuth() {
      if (window.__auth) return window.__auth;
      if (typeof firebase !== "undefined" && firebase.auth) return firebase.auth();
      return null;
    }

    function setMsg(text) {
      if (el.adminMsg) el.adminMsg.textContent = text || "";
    }

    function goLogin() {
      window.location.replace("login.html");
    }

    function isMobile() {
      return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function renderEmpty(message) {
      if (!el.usersTable) return;
      if (isMobile()) {
        el.usersTable.innerHTML = ` <tr> <td colspan="4" class="empty-card">${U.escapeHtml(message)}</td> </tr> `;
      } else {
        el.usersTable.innerHTML = ` <tr> <td colspan="4" class="empty-card">${U.escapeHtml(message)}</td> </tr> `;
      }
    }

    function getStatusLabel(user) {
      if (user.role === "admin") return "Admin";
      if (user.blocked) return "Bloqueado";
      return "Ativo";
    }

    function getStatusClass(user) {
      if (user.role === "admin") return "status-live";
      if (user.blocked) return "status-finished";
      return "status-scheduled";
    }

    function applyFilters() {
      const name = U.normalizeText(el.filterName?.value || "");
      const email = U.normalizeText(el.filterEmail?.value || "");
      const status = U.normalizeText(el.filterStatus?.value || "");

      state.filtered = state.users.filter(u => {
        const userName = U.normalizeText(u.displayName || "");
        const userEmail = U.normalizeText(u.email || "");
        const userStatus = u.role === "admin"
          ? "admin"
          : (u.blocked ? "blocked" : "active");

        return (
          (!name || userName.includes(name)) &&
          (!email || userEmail.includes(email)) &&
          (!status || userStatus === status)
        );
      });

      state.page = 1;
      renderTable();
      renderPagination();
    }

    function getPagedUsers() {
      const start = (state.page - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      return state.filtered.slice(start, end);
    }

    function renderDesktopRow(user) {
      const name = U.escapeHtml(user.displayName || "-");
      const email = U.escapeHtml(user.email || "-");
      const statusLabel = U.escapeHtml(getStatusLabel(user));
      const statusClass = getStatusClass(user);

      const isAdminUser = user.role === "admin";
      const canBlock = !isAdminUser && !user.blocked;
      const canUnblock = !isAdminUser && user.blocked;
      const canDelete = !isAdminUser;

      return ` <tr class="desktop-user-row"> <td><strong>${name}</strong></td> <td>${email}</td> <td> <span class="status-tag ${statusClass}">${statusLabel}</span> </td> <td> <div class="action-icons"> ${canBlock ? ` <button type="button" class="icon-btn" data-action="block" data-id="${user.id}" data-name="${name}" title="Bloquear usuário">⛔</button> ` : ""} ${canUnblock ? ` <button type="button" class="icon-btn" data-action="unblock" data-id="${user.id}" data-name="${name}" title="Desbloquear usuário">✅</button> ` : ""} ${canDelete ? ` <button type="button" class="icon-btn danger" data-action="delete" data-id="${user.id}" data-name="${name}" title="Excluir usuário e dados">🗑️</button> ` : ""} </div> </td> </tr> `;
    }

    function renderMobileRow(user) {
      const name = U.escapeHtml(user.displayName || "-");
      const email = U.escapeHtml(user.email || "-");
      const statusLabel = U.escapeHtml(getStatusLabel(user));
      const statusClass = getStatusClass(user);

      const isAdminUser = user.role === "admin";
      const canBlock = !isAdminUser && !user.blocked;
      const canUnblock = !isAdminUser && user.blocked;
      const canDelete = !isAdminUser;

      return ` <tr class="mobile-user-row"> <td colspan="4"> <div class="mobile-user-card"> <div class="mobile-user-top"> <div class="mobile-user-name">${name}</div> <div class="mobile-user-email">${email}</div> <span class="mobile-user-status status-tag ${statusClass}">${statusLabel}</span> </div> <div class="mobile-user-meta"> <div><strong>Nome:</strong> ${name}</div> <div><strong>E-mail:</strong> ${email}</div> <div><strong>Status:</strong> ${statusLabel}</div> </div> <div class="mobile-user-actions"> ${canBlock ? ` <button type="button" class="icon-btn" data-action="block" data-id="${user.id}" data-name="${name}" title="Bloquear usuário">⛔</button> ` : ""} ${canUnblock ? ` <button type="button" class="icon-btn" data-action="unblock" data-id="${user.id}" data-name="${name}" title="Desbloquear usuário">✅</button> ` : ""} ${canDelete ? ` <button type="button" class="icon-btn danger" data-action="delete" data-id="${user.id}" data-name="${name}" title="Excluir usuário e dados">🗑️</button> ` : ""} </div> </div> </td> </tr> `;
    }

    function renderTable() {
      if (!el.usersTable) return;

      if (!state.filtered.length) {
        renderEmpty("Nenhum usuário encontrado.");
        return;
      }

      const pagedUsers = getPagedUsers();

      if (!pagedUsers.length) {
        renderEmpty("Nenhum usuário nesta página.");
        return;
      }

      const mobile = isMobile();

      el.usersTable.innerHTML = pagedUsers.map(user => {
        return mobile ? renderMobileRow(user) : renderDesktopRow(user);
      }).join("");
    }

    function renderPagination() {
      if (!el.paginationBar) return;

      const total = state.filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

      if (total <= PAGE_SIZE) {
        el.paginationBar.innerHTML = "";
        return;
      }

      state.page = Math.min(state.page, totalPages);

      const prevDisabled = state.page === 1 ? "disabled" : "";
      const nextDisabled = state.page === totalPages ? "disabled" : "";

      el.paginationBar.innerHTML = ` <div class="admin-pagination"> <button type="button" class="admin-page-btn" data-page="prev" ${prevDisabled}>← Anterior</button> <span class="admin-page-info">Página ${state.page} de ${totalPages}</span> <button type="button" class="admin-page-btn" data-page="next" ${nextDisabled}>Próxima →</button> </div> `;
    }

    async function loadUsers() {
      const db = getDb();
      if (!db) {
        setMsg("Firebase não carregado corretamente.");
        renderEmpty("Firebase indisponível.");
        return;
      }

      if (state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = null;
      }

      state.unsubscribe = db.collection("users").onSnapshot(
        (snapshot) => {
          state.users = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          console.log("[users-admin] usuários carregados:", state.users.length);

          applyFilters();
          setMsg(`Usuários carregados: ${state.users.length}`);
        },
        (err) => {
          console.error("Erro ao carregar usuários:", err);

          if (err.code === "permission-denied") {
            setMsg("❌ Sem permissão para listar usuários. Verifique as regras do Firestore.");
          } else {
            setMsg(err.message || "Erro ao carregar usuários.");
          }

          renderEmpty("Erro ao carregar usuários.");
        }
      );
    }

    async function setBlocked(userId, blocked, userName = "") {
      try {
        const db = getDb();
        if (!db) {
          setMsg("Firebase indisponível.");
          return;
        }

        const label = userName ? `"${userName}"` : "Usuário";
        const confirmMsg = blocked
          ? `Deseja bloquear ${label}? Ele não poderá mais fazer login.`
          : `Deseja desbloquear ${label}?`;

        if (!confirm(confirmMsg)) return;

        await db.collection("users").doc(userId).update({
          blocked,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        setMsg(blocked
          ? `✅ ${label} bloqueado com sucesso.`
          : `✅ ${label} desbloqueado com sucesso.`
        );

        console.log("[users-admin] status alterado:", { userId, blocked });
      } catch (err) {
        console.error("Erro ao alterar bloqueio:", err);

        if (err.code === "permission-denied") {
          setMsg("❌ Sem permissão para alterar este usuário.");
        } else {
          setMsg("Erro ao alterar status: " + (err.message || "desconhecido"));
        }
      }
    }

    async function deleteAllUserData(userId, userName = "") {
      const db = getDb();
      if (!db) {
        setMsg("Firebase indisponível.");
        return;
      }

      const label = userName ? `"${userName}"` : "este usuário";

      const confirmText =
        `⚠️ Deseja excluir COMPLETAMENTE a conta de ${label}?\n\n` +
        `Isso irá remover:\n` +
        `• Cadastro (users)\n` +
        `• Perfil (profiles)\n` +
        `• Todas as partidas (matches)\n\n` +
        `Esta ação não pode ser desfeita.`;

      if (!confirm(confirmText)) return;

      try {
        setMsg("Excluindo dados...");

        await db.collection("users").doc(userId).delete();
        setMsg("Removendo cadastro...");

        const profileRef = db.collection("profiles").doc(userId);
        const profileSnap = await profileRef.get();
        if (profileSnap.exists) {
          await profileRef.delete();
        }
        setMsg("Removendo perfil...");

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

          if (count > 0) {
            await batch.commit();
          }
        }

        setMsg("Removendo partidas...");

        if (typeof firebase.app === "function") {
          try {
            const functions = firebase.app().functions("us-central1");
            const deleteUserAccount = functions.httpsCallable("deleteUserAccount");
            await deleteUserAccount({ uid: userId });
          } catch (fnErr) {
            console.warn("Cloud Function não disponível:", fnErr.message);
          }
        }

        setMsg(`✅ Conta de ${label} excluída completamente.`);
        console.log("[users-admin] usuário excluído:", userId);

      } catch (err) {
        console.error("Erro ao excluir dados:", err);

        if (err.code === "permission-denied") {
          setMsg("❌ Sem permissão para excluir este usuário.");
        } else {
          setMsg("Erro ao excluir: " + (err.message || "desconhecido"));
        }
      }
    }

    function bindEvents() {
      el.logoutBtn?.addEventListener("click", async () => {
        try {
          localStorage.removeItem("lsts_admin_session");

          const auth = getAuth();
          if (auth) await auth.signOut();

          goLogin();
        } catch (err) {
          console.error(err);
          setMsg(err.message || "Erro ao sair.");
        }
      });

      el.filterName?.addEventListener("input", applyFilters);
      el.filterEmail?.addEventListener("input", applyFilters);
      el.filterStatus?.addEventListener("change", applyFilters);

      el.paginationBar?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-page]");
        if (!btn) return;

        const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));

        if (btn.dataset.page === "prev" && state.page > 1) {
          state.page--;
        } else if (btn.dataset.page === "next" && state.page < totalPages) {
          state.page++;
        }

        renderTable();
        renderPagination();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      el.usersTable?.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;

        const { action, id, name } = btn.dataset;

        switch (action) {
          case "block":
            await setBlocked(id, true, name);
            break;
          case "unblock":
            await setBlocked(id, false, name);
            break;
          case "delete":
            await deleteAllUserData(id, name);
            break;
        }
      });

      window.addEventListener("resize", () => {
        renderTable();
      });
    }

    function init() {
      bindEvents();

      const auth = getAuth();
      const db = getDb();

      if (!auth || !db) {
        setMsg("Firebase não carregado corretamente.");
        return;
      }

      auth.onAuthStateChanged(async (user) => {
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
