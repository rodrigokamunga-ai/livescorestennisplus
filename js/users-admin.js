(() => {
    "use strict";
  
    const UsersAdmin = (() => {
      const ADMIN_EMAIL = "rodrigokamunga@hotmail.com";
      const db = firebase.firestore();
  
      const state = {
        currentUser: null,
        users: [],
        filtered: [],
        unsubscribe: null
      };
  
      const el = {
        logoutBtn: document.getElementById("logoutBtn"),
        adminMsg: document.getElementById("adminMsg"),
        usersTable: document.getElementById("usersTable"),
        filterName: document.getElementById("filterName"),
        filterEmail: document.getElementById("filterEmail"),
        filterStatus: document.getElementById("filterStatus")
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
          return U.normalizeText(user?.email) === ADMIN_EMAIL;
        }
      };
  
      function setMsg(text) {
        if (el.adminMsg) el.adminMsg.textContent = text || "";
      }
  
      function goLogin() {
        window.location.replace("login.html");
      }
  
      function renderEmpty(message) {
        if (!el.usersTable) return;
        el.usersTable.innerHTML = `<tr><td colspan="4" class="empty-card">${U.escapeHtml(message)}</td></tr>`;
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
  
          return (!name || userName.includes(name)) &&
                 (!email || userEmail.includes(email)) &&
                 (!status || userStatus === status);
        });
  
        renderTable();
      }
  
      function renderTable() {
        if (!el.usersTable) return;
  
        if (!state.filtered.length) {
          renderEmpty("Nenhum usuário encontrado.");
          return;
        }
  
        el.usersTable.innerHTML = state.filtered.map(user => {
          const name = U.escapeHtml(user.displayName || "-");
          const email = U.escapeHtml(user.email || "-");
          const statusLabel = U.escapeHtml(getStatusLabel(user));
          const statusClass = getStatusClass(user);
  
          const canBlock = user.role !== "admin" && !user.blocked;
          const canUnblock = user.role !== "admin" && user.blocked;
          const canDelete = user.role !== "admin";
  
          return ` <tr> <td><strong>${name}</strong></td> <td>${email}</td> <td><span class="status-tag ${statusClass}">${statusLabel}</span></td> <td> <div class="action-icons"> ${canBlock ? `<button type="button" class="icon-btn" data-action="block" data-id="${user.id}" title="Bloquear">⛔</button>` : ""} ${canUnblock ? `<button type="button" class="icon-btn" data-action="unblock" data-id="${user.id}" title="Desbloquear">✅</button>` : ""} ${canDelete ? `<button type="button" class="icon-btn danger" data-action="delete" data-id="${user.id}" title="Excluir">🗑️</button>` : ""} </div> </td> </tr> `;
        }).join("");
      }
  
      async function loadUsers() {
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
  
            applyFilters();
            setMsg(`Usuários carregados: ${state.users.length}`);
          },
          (err) => {
            console.error(err);
            setMsg(err.message || "Erro ao carregar usuários.");
            renderEmpty("Erro ao carregar usuários.");
          }
        );
      }
  
      async function setBlocked(userId, blocked) {
        try {
          await db.collection("users").doc(userId).set({
            blocked,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
  
          setMsg(blocked ? "Usuário bloqueado." : "Usuário desbloqueado.");
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      }
  
      async function deleteUserDoc(userId) {
        try {
          if (!confirm("Deseja excluir este cadastro?")) return;
  
          await db.collection("users").doc(userId).delete();
          setMsg("Usuário excluído da coleção users.");
        } catch (err) {
          console.error(err);
          setMsg(err.message);
        }
      }
  
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
  
        el.filterName?.addEventListener("input", applyFilters);
        el.filterEmail?.addEventListener("input", applyFilters);
        el.filterStatus?.addEventListener("change", applyFilters);
  
        el.usersTable?.addEventListener("click", async (e) => {
          const btn = e.target.closest("button[data-action]");
          if (!btn) return;
  
          const { action, id } = btn.dataset;
  
          if (action === "block") {
            await setBlocked(id, true);
            return;
          }
  
          if (action === "unblock") {
            await setBlocked(id, false);
            return;
          }
  
          if (action === "delete") {
            await deleteUserDoc(id);
          }
        });
      }
  
      function init() {
        bindEvents();
  
        if (typeof __auth === "undefined" || typeof __db === "undefined") {
          setMsg("Firebase não carregado corretamente.");
          return;
        }
  
        __auth.onAuthStateChanged((user) => {
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
          loadUsers();
        });
      }
  
      return { init };
    })();
  
    document.addEventListener("DOMContentLoaded", () => UsersAdmin.init());
  })();