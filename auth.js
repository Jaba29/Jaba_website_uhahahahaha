/**
 * auth.js — авторизация по коду (SHA-256 хэш)
 */

const Auth = (() => {
  const SESSION_KEY = "cipher_session";

  async function login() {
    const raw = document.getElementById("code-input").value.trim();
    const errorEl = document.getElementById("auth-error");
    errorEl.textContent = "";

    if (!raw) {
      errorEl.textContent = "Введи код";
      return;
    }

    // Защита от перебора: задержка + лимит попыток
    const attempts = parseInt(sessionStorage.getItem("login_attempts") || "0");
    if (attempts >= 5) {
      const lockUntil = parseInt(sessionStorage.getItem("lock_until") || "0");
      if (Date.now() < lockUntil) {
        const sec = Math.ceil((lockUntil - Date.now()) / 1000);
        errorEl.textContent = `Слишком много попыток. Подожди ${sec}с`;
        return;
      } else {
        sessionStorage.removeItem("login_attempts");
        sessionStorage.removeItem("lock_until");
      }
    }

    // Искусственная задержка против brute-force
    await new Promise(r => setTimeout(r, 800));

    const hash = await sha256(raw);
    const user = CIPHER_CONFIG.users[hash];

    if (!user) {
      const newAttempts = attempts + 1;
      sessionStorage.setItem("login_attempts", newAttempts);
      if (newAttempts >= 5) {
        sessionStorage.setItem("lock_until", Date.now() + 60000);
        errorEl.textContent = "Слишком много попыток. Заблокировано на 60с";
      } else {
        errorEl.textContent = `Неверный код (${5 - newAttempts} попытки)`;
      }
      document.getElementById("code-input").value = "";
      return;
    }

    // Сохраняем сессию
    sessionStorage.removeItem("login_attempts");
    const session = { userId: user.id, hash, ts: Date.now() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    enterApp(user);
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  }

  function getSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (!s) return null;
      // Сессия живёт 24 часа
      if (Date.now() - s.ts > 86400000) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch { return null; }
  }

  function getCurrentUser() {
    const s = getSession();
    if (!s) return null;
    return CIPHER_CONFIG.users[s.hash] || null;
  }

  function enterApp(user) {
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    // Инициализируем чат
    if (typeof Chat !== "undefined") Chat.init(user);
    if (typeof Profile !== "undefined") Profile.init(user);
  }

  // Автовход при наличии сессии
  function checkAutoLogin() {
    const s = getSession();
    if (s) {
      const user = CIPHER_CONFIG.users[s.hash];
      if (user) {
        enterApp(user);
        return true;
      }
    }
    return false;
  }

  // Enter key
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("code-input")?.addEventListener("keydown", e => {
      if (e.key === "Enter") login();
    });
    checkAutoLogin();
  });

  return { login, logout, getCurrentUser, checkAutoLogin };
})();
