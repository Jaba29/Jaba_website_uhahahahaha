# 🔐 CIPHER CHAT — Инструкция по настройке

Приватный чат для двух людей. Авторизация по кодам (SHA-256), Firebase для хранения.

---

## 📁 Файлы проекта

```
chat.html   — интерфейс (не содержит кодов)
chat.css    — стили
chat.js     — логика чата, голосовых, кружков, галерей
auth.js     — авторизация по хэшу
config.js   — коды (хэшированные) + Firebase конфиг
```

---

## 🔥 ШАГ 1: Настройка Firebase (бесплатно)

1. Перейди на [firebase.google.com](https://firebase.google.com) → **Создать проект**
2. Назови проект (например `cipher-chat`)
3. Перейди в **Realtime Database** → Создать базу → Выбери регион (europe-west1)
4. Правила базы данных — вставь:
```json
{
  "rules": {
    ".read": "auth == null",
    ".write": "auth == null"
  }
}
```
> Это позволяет писать без Firebase Auth (достаточно для приватного чата двух людей с кодами)

5. Перейди в **Storage** → Начать → Правила:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

6. Перейди в **Настройки проекта** → вкладка **Общие** → **Твои приложения** → Добавить веб-приложение → скопируй конфиг

---

## ⚙️ ШАГ 2: Вставь Firebase конфиг в config.js

Открой `config.js` и замени блок `firebase`:

```js
firebase: {
  apiKey: "AIzaSy...",
  authDomain: "твой-проект.firebaseapp.com",
  databaseURL: "https://твой-проект-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "твой-проект",
  storageBucket: "твой-проект.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
}
```

---

## 🔑 ШАГ 3: Установи свои коды доступа

### Придумай коды (минимум 12 символов):
Пример: `xK9#mPqL2@vR` и `zN7$wBjY4&tC`

### Получи SHA-256 хэши:
Перейди на https://emn178.github.io/online-tools/sha256.html

Введи каждый код → скопируй хэш (64 символа)

### Вставь хэши в config.js:

```js
users: {
  "твой_хэш_64_символа_здесь": {
    id: "owner",
    name: "Jaba",
    color: "#a855f7"
  },
  "второй_хэш_64_символа_здесь": {
    id: "friend",
    name: "Подруга",
    color: "#ec4899"
  }
}
```

> ⚠️ НИКОГДА не храни оригинальные коды в файлах! Только хэши.

---

## 📦 ШАГ 4: Добавь Firebase SDK в chat.html

Найди в `chat.html` строку `<script src="config.js">` и добавь ДО неё:

```html
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js"></script>
```

---

## 🚀 ШАГ 5: Деплой на Vercel

1. Закинь все 5 файлов в папку на GitHub
2. В Vercel → New Project → выбери репозиторий
3. Framework: **Other** (без фреймворка)
4. Output directory: оставь пустым или `.`
5. Деплой!

На твоём сайте jaba-webs.fun добавь ссылку на `chat.html`

---

## 💾 Лимиты Firebase (бесплатный план Spark)

| Ресурс | Лимит |
|--------|-------|
| Realtime Database | 1 GB хранение, 10 GB/мес трафик |
| Storage | 5 GB хранение, 1 GB/день скачивание |
| Одновременных подключений | 100 |

Для чата двух людей — более чем достаточно.

Лимит файлов в config.js установлен на **50MB** — разумно для Storage.

---

## 🎨 Возможности чата

- ✅ Авторизация по SHA-256 хэшу кода
- ✅ Защита от перебора (5 попыток → блокировка 60с)
- ✅ Голосовые сообщения (удержи 🎤)
- ✅ Видеокружки (удержи ⬤)
- ✅ Отправка файлов (фото, видео, аудио, документы)
- ✅ Прослушивание MP3/WAV прямо в чате
- ✅ Вкладки: Медиа / Музыка / Файлы
- ✅ Лайтбокс для фото и видео
- ✅ Кастомизация профиля (имя, статус, аватар, цвет)
- ✅ Индикатор онлайн партнёра
- ✅ Тёмная тема (серо-фиолетовая палитра)
- ✅ Адаптивный дизайн (мобильный + десктоп)
- ✅ Сессия 24 часа (не нужно вводить код каждый раз)
