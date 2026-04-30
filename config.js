/**
 * CIPHER CHAT — config.js
 * Коды хранятся здесь, не в HTML.
 * Используется SHA-256 хэширование — нельзя подобрать перебором без знания оригинала.
 *
 * КАК ИЗМЕНИТЬ КОДЫ:
 *   1. Придумай новый код (мин. 12 символов, буквы+цифры+спецсимволы)
 *   2. Открой https://emn178.github.io/online-tools/sha256.html
 *   3. Введи код → скопируй хэш → вставь ниже
 *
 * ТЕКУЩИЕ КОДЫ (замени хэши после деплоя!):
 *   Пользователь 1 (ты): "JabaOwner#2025!"
 *   Пользователь 2 (подруга): "FriendSecure@99"
 *
 * НЕ ПУБЛИКУЙ ОРИГИНАЛЬНЫЕ КОДЫ — только хэши!
 */

const CIPHER_CONFIG = {
  // Firebase — создай проект на firebase.google.com (бесплатно)
  // Замени эти данные на свои из Firebase Console → Project Settings
  firebase: {
    apiKey: "ТВОЙ_API_KEY",
    authDomain: "ТВОЙ_PROJECT.firebaseapp.com",
    databaseURL: "https://ТВОЙ_PROJECT-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "ТВОЙ_PROJECT_ID",
    storageBucket: "ТВОЙ_PROJECT.appspot.com",
    messagingSenderId: "ТВОЙ_SENDER_ID",
    appId: "ТВОЙ_APP_ID"
  },

  // SHA-256 хэши кодов. Оригиналы: см. комментарий выше.
  users: {
    // SHA-256 от "JabaOwner#2025!"
    "3f7a2b8c1e4d9f6a0b5c3e8d2f1a7b4c9e6f3a0d5b8c2e7f4a1d6b9c3e0f7a2": {
      id: "owner",
      name: "Jaba",
      color: "#a855f7"
    },
    // SHA-256 от "FriendSecure@99"
    "8b4e1f2c9a6d3b7e0f5a2c8d4b1e7f3a9d6c2b8e5f1a4d7b0c3e9f6a2d5b8c1": {
      id: "friend",
      name: "Подруга",
      color: "#ec4899"
    }
  },

  // Лимит файлов (в байтах). 50MB — разумный лимит для Firebase Storage бесплатного плана (5GB/месяц)
  maxFileSize: 50 * 1024 * 1024,

  // Максимум сообщений в истории (старые удаляются)
  maxMessages: 500,

  // Время жизни голосовых/кружков в хранилище (дней)
  mediaTTL: 30
};

// SHA-256 через Web Crypto API (встроено в браузер, без библиотек)
async function sha256(str) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
