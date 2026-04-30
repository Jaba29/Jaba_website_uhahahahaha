/**
 * chat.js — полная логика чата
 * Firebase Realtime DB для сообщений
 * Firebase Storage для файлов/медиа
 */

// ─── Firebase SDK (загружается из CDN в HTML) ───────────────────────────────
// Добавь в chat.html перед <script src="chat.js">:
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js"></script>

// ─── PROFILE ─────────────────────────────────────────────────────────────────
const Profile = (() => {
  let currentUser = null;
  let db = null;

  function init(user) {
    currentUser = user;
    db = firebase.database();
    load();
  }

  function load() {
    if (!currentUser) return;
    db.ref(`profiles/${currentUser.id}`).on("value", snap => {
      const data = snap.val() || {};
      const name = data.name || currentUser.name;
      const bio = data.bio || "";
      const avatarUrl = data.avatarUrl || "";
      const accent = data.color || currentUser.color;

      document.getElementById("sidebar-name").textContent = name;
      document.getElementById("sidebar-bio").textContent = bio || "Нет статуса";
      document.getElementById("sidebar-avatar-text").textContent = name[0]?.toUpperCase() || "?";
      document.getElementById("topbar-name").textContent = "Cipher Chat";

      if (avatarUrl) {
        const img = document.getElementById("sidebar-avatar-img");
        img.src = avatarUrl;
        img.classList.remove("hidden");
        document.getElementById("sidebar-avatar-text").classList.add("hidden");
      }

      document.documentElement.style.setProperty("--accent", accent);
      document.documentElement.style.setProperty("--accent2", accent + "66");
    });

    // Partner status
    const partnerId = Object.values(CIPHER_CONFIG.users).find(u => u.id !== currentUser.id)?.id;
    if (partnerId) {
      db.ref(`online/${partnerId}`).on("value", snap => {
        const online = snap.val();
        const el = document.getElementById("partner-status");
        if (online) {
          el.textContent = "● Онлайн";
          el.style.color = "#4ade80";
        } else {
          el.textContent = "● Не в сети";
          el.style.color = "#6b7280";
        }
      });

      db.ref(`profiles/${partnerId}`).on("value", snap => {
        const data = snap.val() || {};
        const name = data.name || partnerId;
        const av = document.getElementById("topbar-avatar");
        av.textContent = name[0]?.toUpperCase() || "?";
      });
    }

    // Set online
    const onlineRef = db.ref(`online/${currentUser.id}`);
    onlineRef.set(true);
    onlineRef.onDisconnect().set(false);
  }

  function openEditor() {
    if (!currentUser) return;
    db.ref(`profiles/${currentUser.id}`).once("value", snap => {
      const data = snap.val() || {};
      document.getElementById("profile-name-input").value = data.name || currentUser.name;
      document.getElementById("profile-bio-input").value = data.bio || "";
      document.getElementById("accent-color").value = data.color || currentUser.color;
      document.getElementById("color-preview-text").textContent = data.color || currentUser.color;

      if (data.avatarUrl) {
        document.getElementById("modal-avatar-img").src = data.avatarUrl;
        document.getElementById("modal-avatar-img").classList.remove("hidden");
        document.getElementById("modal-avatar-text").classList.add("hidden");
      } else {
        document.getElementById("modal-avatar-img").classList.add("hidden");
        document.getElementById("modal-avatar-text").classList.remove("hidden");
        document.getElementById("modal-avatar-text").textContent = (data.name || currentUser.name)[0]?.toUpperCase();
      }
    });
    document.getElementById("profile-modal").classList.remove("hidden");
  }

  function changeAvatar(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { UI.toast("Только изображения"); return; }
    if (file.size > 5 * 1024 * 1024) { UI.toast("Аватар до 5MB"); return; }

    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById("modal-avatar-img").src = e.target.result;
      document.getElementById("modal-avatar-img").classList.remove("hidden");
      document.getElementById("modal-avatar-text").classList.add("hidden");
    };
    reader.readAsDataURL(file);
  }

  function previewAccent(val) {
    document.getElementById("color-preview-text").textContent = val;
    document.documentElement.style.setProperty("--accent", val);
  }

  async function save() {
    if (!currentUser) return;
    const name = document.getElementById("profile-name-input").value.trim();
    const bio = document.getElementById("profile-bio-input").value.trim();
    const color = document.getElementById("accent-color").value;

    const updates = { name: name || currentUser.name, bio, color };

    // Upload avatar if changed
    const avatarImg = document.getElementById("modal-avatar-img");
    const avatarFile = document.getElementById("avatar-file").files[0];
    if (avatarFile) {
      try {
        UI.toast("Загружаю аватар...");
        const ref = firebase.storage().ref(`avatars/${currentUser.id}`);
        await ref.put(avatarFile);
        updates.avatarUrl = await ref.getDownloadURL();
      } catch (e) {
        UI.toast("Ошибка загрузки аватара");
        console.error(e);
      }
    }

    await db.ref(`profiles/${currentUser.id}`).update(updates);
    UI.closeProfileEditor();
    UI.toast("Профиль сохранён ✓");
  }

  return { init, load, openEditor, changeAvatar, previewAccent, save };
})();

// ─── VOICE / VIDEO CIRCLES ────────────────────────────────────────────────────
const Voice = (() => {
  let mediaRecorder = null;
  let chunks = [];
  let timerInterval = null;
  let startTime = 0;
  let recordType = null; // 'audio' | 'circle'

  function startTimer(label) {
    startTime = Date.now();
    document.getElementById("rec-label").textContent = label;
    document.getElementById("recording-indicator").classList.remove("hidden");
    timerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      document.getElementById("rec-timer").textContent = `${m}:${s.toString().padStart(2, "0")}`;
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    document.getElementById("recording-indicator").classList.add("hidden");
  }

  async function startAudio(e) {
    e?.preventDefault();
    if (mediaRecorder) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      recordType = "audio";
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = () => uploadVoice("audio");
      mediaRecorder.start();
      startTimer("Голосовое...");
    } catch { UI.toast("Нет доступа к микрофону"); }
  }

  function stopAudio() {
    if (mediaRecorder && recordType === "audio") {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      mediaRecorder = null;
      stopTimer();
    }
  }

  async function startCircle(e) {
    e?.preventDefault();
    if (mediaRecorder) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      chunks = [];
      recordType = "circle";
      mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = () => uploadVoice("circle");
      mediaRecorder.start();
      startTimer("Видеокружок...");
    } catch {
      UI.toast("Нет доступа к камере/микрофону");
    }
  }

  function stopCircle() {
    if (mediaRecorder && recordType === "circle") {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      mediaRecorder = null;
      stopTimer();
    }
  }

  async function uploadVoice(type) {
    if (!chunks.length) return;
    const user = Auth.getCurrentUser();
    if (!user) return;

    const ext = type === "circle" ? "webm" : "webm";
    const mime = type === "circle" ? "video/webm" : "audio/webm";
    const blob = new Blob(chunks, { type: mime });
    chunks = [];

    if (blob.size > CIPHER_CONFIG.maxFileSize) { UI.toast("Файл слишком большой"); return; }

    UI.toast("Отправляю...");
    try {
      const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const ref = firebase.storage().ref(`media/${id}.${ext}`);
      await ref.put(blob);
      const url = await ref.getDownloadURL();

      await Chat.sendMessage({
        type,
        url,
        from: user.id,
        ts: Date.now(),
        duration: Math.round((Date.now() - startTime) / 1000) || 1
      });
    } catch (e) {
      UI.toast("Ошибка отправки");
      console.error(e);
    }
  }

  return { startAudio, stopAudio, startCircle, stopCircle };
})();

// ─── CHAT ─────────────────────────────────────────────────────────────────────
const Chat = (() => {
  let db = null;
  let storage = null;
  let currentUser = null;
  let messagesRef = null;

  function init(user) {
    currentUser = user;

    // Init Firebase
    if (!firebase.apps.length) {
      firebase.initializeApp(CIPHER_CONFIG.firebase);
    }
    db = firebase.database();
    storage = firebase.storage();

    Profile.init(user);

    messagesRef = db.ref("messages");
    messagesRef
      .orderByChild("ts")
      .limitToLast(CIPHER_CONFIG.maxMessages)
      .on("value", snap => {
        const msgs = [];
        snap.forEach(child => msgs.push({ key: child.key, ...child.val() }));
        renderMessages(msgs);
        updateGalleries(msgs);
      });
  }

  async function sendText() {
    const input = document.getElementById("msg-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    UI.autoResize(input);

    await sendMessage({ type: "text", text, from: currentUser.id, ts: Date.now() });
  }

  async function sendMessage(msg) {
    if (!db) return;
    await db.ref("messages").push(msg);
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  }

  async function handleFile(input) {
    const files = Array.from(input.files);
    for (const file of files) {
      if (file.size > CIPHER_CONFIG.maxFileSize) {
        UI.toast(`${file.name} — слишком большой (макс. ${Math.round(CIPHER_CONFIG.maxFileSize / 1024 / 1024)}MB)`);
        continue;
      }
      await uploadFile(file);
    }
    input.value = "";
  }

  async function uploadFile(file) {
    UI.toast(`Загружаю ${file.name}...`);
    try {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const ref = firebase.storage().ref(`files/${id}_${file.name}`);
      await ref.put(file);
      const url = await ref.getDownloadURL();

      const isAudio = /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(file.name);
      const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file.name);
      const isVideo = /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);

      let type = "file";
      if (isAudio) type = "audio";
      else if (isImage) type = "image";
      else if (isVideo) type = "video";

      await sendMessage({
        type,
        url,
        fileName: file.name,
        fileSize: file.size,
        from: currentUser.id,
        ts: Date.now()
      });
      UI.toast("Отправлено ✓");
    } catch (e) {
      UI.toast("Ошибка загрузки");
      console.error(e);
    }
  }

  function renderMessages(msgs) {
    const container = document.getElementById("messages-inner");
    if (!container) return;
    const wasAtBottom = isAtBottom();

    container.innerHTML = "";
    let lastDate = null;

    for (const msg of msgs) {
      const d = new Date(msg.ts);
      const dateStr = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
      if (dateStr !== lastDate) {
        const sep = document.createElement("div");
        sep.className = "date-sep";
        sep.textContent = dateStr;
        container.appendChild(sep);
        lastDate = dateStr;
      }
      container.appendChild(buildMessage(msg));
    }

    if (wasAtBottom || msgs.length <= 1) scrollBottom();
  }

  function buildMessage(msg) {
    const isMine = msg.from === currentUser.id;
    const wrap = document.createElement("div");
    wrap.className = `msg-wrap ${isMine ? "mine" : "theirs"}`;

    const bubble = document.createElement("div");
    bubble.className = `msg-bubble ${isMine ? "bubble-mine" : "bubble-theirs"} type-${msg.type}`;

    const time = new Date(msg.ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

    switch (msg.type) {
      case "text":
        bubble.innerHTML = `<div class="msg-text">${escapeHtml(msg.text)}</div><div class="msg-time">${time}</div>`;
        break;

      case "image":
        bubble.innerHTML = `
          <img class="msg-img" src="${msg.url}" alt="${escapeHtml(msg.fileName || "фото")}"
            onclick="UI.openLightbox('image','${msg.url}')" loading="lazy" />
          <div class="msg-time">${time}</div>`;
        break;

      case "video":
        bubble.innerHTML = `
          <video class="msg-video" src="${msg.url}" controls preload="metadata"></video>
          <div class="msg-time">${time}</div>`;
        break;

      case "audio":
        bubble.innerHTML = `
          <div class="audio-player">
            <button class="play-btn" onclick="UI.toggleAudio(this, '${msg.url}')">▶</button>
            <div class="audio-bar">
              <div class="audio-progress" id="ap-${msg.key}"></div>
            </div>
            <span class="audio-dur" id="aud-${msg.key}">${msg.duration ? formatDur(msg.duration) : "—"}</span>
          </div>
          <div class="msg-filename">${escapeHtml(msg.fileName || "Аудио")}</div>
          <div class="msg-time">${time}</div>`;
        break;

      case "circle":
        bubble.className += " bubble-circle";
        bubble.innerHTML = `
          <div class="circle-wrap">
            <video class="circle-video" src="${msg.url}" controls loop preload="metadata" playsinline></video>
          </div>
          <div class="msg-time msg-time-center">${time}</div>`;
        break;

      case "voice":
      case "file":
      default:
        const sizeFmt = msg.fileSize ? formatSize(msg.fileSize) : "";
        bubble.innerHTML = `
          <div class="file-bubble">
            <div class="file-icon">📄</div>
            <div class="file-info">
              <div class="file-name">${escapeHtml(msg.fileName || "Файл")}</div>
              <div class="file-size">${sizeFmt}</div>
            </div>
            <a class="file-dl" href="${msg.url}" download="${escapeHtml(msg.fileName || "file")}" target="_blank">↓</a>
          </div>
          <div class="msg-time">${time}</div>`;
    }

    wrap.appendChild(bubble);
    return wrap;
  }

  function updateGalleries(msgs) {
    const images = msgs.filter(m => m.type === "image" || m.type === "video");
    const audio = msgs.filter(m => m.type === "audio");
    const files = msgs.filter(m => m.type === "file");

    // Media grid
    const mg = document.getElementById("media-grid");
    if (mg) {
      mg.innerHTML = images.length
        ? images.map(m => m.type === "image"
            ? `<div class="media-thumb" onclick="UI.openLightbox('image','${m.url}')"><img src="${m.url}" loading="lazy"/></div>`
            : `<div class="media-thumb" onclick="UI.openLightbox('video','${m.url}')"><video src="${m.url}" preload="none"/><div class="play-overlay">▶</div></div>`
          ).join("")
        : `<div class="empty-state">Нет медиафайлов</div>`;
    }

    // Music list
    const ml = document.getElementById("music-list");
    if (ml) {
      ml.innerHTML = audio.length
        ? audio.map(m => `
          <div class="music-item">
            <div class="music-icon">🎵</div>
            <div class="music-info">
              <div class="music-name">${escapeHtml(m.fileName || "Аудио")}</div>
              <div class="music-date">${new Date(m.ts).toLocaleDateString("ru-RU")}</div>
            </div>
            <audio class="music-audio" src="${m.url}" controls preload="none"></audio>
          </div>`).join("")
        : `<div class="empty-state">Нет аудиофайлов</div>`;
    }

    // Files list
    const fl = document.getElementById("files-list");
    if (fl) {
      fl.innerHTML = files.length
        ? files.map(m => `
          <div class="file-item">
            <div class="file-icon-lg">📄</div>
            <div class="file-info">
              <div class="file-name">${escapeHtml(m.fileName || "Файл")}</div>
              <div class="file-size">${formatSize(m.fileSize || 0)} · ${new Date(m.ts).toLocaleDateString("ru-RU")}</div>
            </div>
            <a href="${m.url}" download="${escapeHtml(m.fileName || "file")}" target="_blank" class="file-dl-btn">↓</a>
          </div>`).join("")
        : `<div class="empty-state">Нет файлов</div>`;
    }
  }

  function isAtBottom() {
    const area = document.getElementById("messages-area");
    if (!area) return true;
    return area.scrollHeight - area.scrollTop - area.clientHeight < 60;
  }

  function scrollBottom() {
    const area = document.getElementById("messages-area");
    if (area) area.scrollTop = area.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function formatDur(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return { init, sendText, sendMessage, onKey, handleFile };
})();

// ─── UI ───────────────────────────────────────────────────────────────────────
const UI = (() => {
  let currentTab = "chat";
  let sidebarOpen = false;
  let currentAudio = null;
  let currentAudioBtn = null;

  function toggleSidebar() {
    const sb = document.getElementById("sidebar");
    sidebarOpen = !sidebarOpen;
    sb.classList.toggle("open", sidebarOpen);
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(el => el.classList.remove("active"));
    document.getElementById(`tab-${tab}`)?.classList.add("active");
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add("active");
    if (window.innerWidth < 768) toggleSidebar();
  }

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function openAttach() {
    document.getElementById("file-input").click();
  }

  function openProfileEditor() {
    Profile.openEditor();
  }

  function closeProfileEditor() {
    document.getElementById("profile-modal").classList.add("hidden");
  }

  function openLightbox(type, url) {
    const lb = document.getElementById("lightbox");
    const img = document.getElementById("lightbox-img");
    const vid = document.getElementById("lightbox-video");
    if (type === "image") {
      img.src = url;
      img.classList.remove("hidden");
      vid.classList.add("hidden");
      vid.pause();
    } else {
      vid.src = url;
      vid.classList.remove("hidden");
      img.classList.add("hidden");
    }
    lb.classList.remove("hidden");
  }

  function closeLightbox() {
    document.getElementById("lightbox").classList.add("hidden");
    document.getElementById("lightbox-video").pause();
  }

  function toggleAudio(btn, url) {
    if (currentAudio && currentAudio.src !== url) {
      currentAudio.pause();
      if (currentAudioBtn) currentAudioBtn.textContent = "▶";
    }
    if (!currentAudio || currentAudio.src !== url) {
      currentAudio = new Audio(url);
      currentAudioBtn = btn;
      currentAudio.play();
      btn.textContent = "⏸";
      currentAudio.onended = () => { btn.textContent = "▶"; };
    } else {
      if (currentAudio.paused) { currentAudio.play(); btn.textContent = "⏸"; }
      else { currentAudio.pause(); btn.textContent = "▶"; }
    }
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    el.classList.add("show");
    setTimeout(() => { el.classList.remove("show"); el.classList.add("hidden"); }, 3000);
  }

  return { toggleSidebar, switchTab, autoResize, openAttach, openProfileEditor, closeProfileEditor, openLightbox, closeLightbox, toggleAudio, toast };
})();
