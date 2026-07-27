import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  get,
  getDatabase,
  ref,
  remove,
  set
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCON5xSihUugt8fy7ZVPzXGAa-_rFGIZoQ",
  authDomain: "awis-sleep-audios.firebaseapp.com",
  projectId: "awis-sleep-audios",
  storageBucket: "awis-sleep-audios.firebasestorage.app",
  messagingSenderId: "753766828709",
  appId: "1:753766828709:web:a1cc2c1eb0eacdd9fd1b4c",
  measurementId: "G-1B1W13TKSL"
};

const ADMIN_PIN = "1234";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app, "https://awis-sleep-audios-default-rtdb.firebaseio.com/");
const storiesRef = collection(db, "stories");
const MAX_AUDIO_BYTES = 11 * 1024 * 1024;
const CHUNK_SIZE = 384 * 1024;

const dom = {
  adminToggle: document.querySelector("#adminToggle"),
  adminPanel: document.querySelector("#adminPanel"),
  pinModal: document.querySelector("#pinModal"),
  closePinModal: document.querySelector("#closePinModal"),
  pinForm: document.querySelector("#pinForm"),
  pinInput: document.querySelector("#pinInput"),
  lockAdmin: document.querySelector("#lockAdmin"),
  storyForm: document.querySelector("#storyForm"),
  audioFileInput: document.querySelector("#audioFileInput"),
  filePickerTitle: document.querySelector("#filePickerTitle"),
  filePickerMeta: document.querySelector("#filePickerMeta"),
  titleInput: document.querySelector("#titleInput"),
  uploadHint: document.querySelector("#uploadHint"),
  submitStory: document.querySelector("#submitStory"),
  cancelEdit: document.querySelector("#cancelEdit"),
  storyList: document.querySelector("#storyList"),
  storyCount: document.querySelector("#storyCount"),
  listEyebrow: document.querySelector("#listEyebrow"),
  listTitle: document.querySelector("#listTitle"),
  allTab: document.querySelector("#allTab"),
  favoritesTab: document.querySelector("#favoritesTab"),
  audioPlayer: document.querySelector("#audioPlayer"),
  currentTitle: document.querySelector("#currentTitle"),
  playPause: document.querySelector("#playPause"),
  back10: document.querySelector("#back10"),
  forward10: document.querySelector("#forward10"),
  progressBar: document.querySelector("#progressBar"),
  currentTime: document.querySelector("#currentTime"),
  duration: document.querySelector("#duration"),
  timerSelect: document.querySelector("#timerSelect"),
  timerCountdown: document.querySelector("#timerCountdown"),
  toast: document.querySelector("#toast")
};

const icons = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.35-9.25-9.3C.95 7.75 3.25 4 7.1 4c2.05 0 3.55 1.15 4.9 2.95C13.35 5.15 14.85 4 16.9 4c3.85 0 6.15 3.75 4.35 7.7C19 16.65 12 21 12 21Z"/></svg>',
  heartOutline: '<svg viewBox="0 0 24 24"><path d="M12.1 20.55 12 20.65l-.11-.1C5.14 14.45 2 11.62 2 8.16 2 5.33 4.22 3.1 7.05 3.1c1.6 0 3.14.75 4.15 1.94A5.5 5.5 0 0 1 15.35 3.1C18.18 3.1 20.4 5.33 20.4 8.16c0 3.46-3.14 6.29-8.3 12.39Z"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
  emptyHeart: '<svg viewBox="0 0 24 24"><path d="M12.1 20.55 12 20.65l-.11-.1C5.14 14.45 2 11.62 2 8.16 2 5.33 4.22 3.1 7.05 3.1c1.6 0 3.14.75 4.15 1.94A5.5 5.5 0 0 1 15.35 3.1C18.18 3.1 20.4 5.33 20.4 8.16c0 3.46-3.14 6.29-8.3 12.39Z"/></svg>'
};

let stories = [];
let currentStoryId = null;
let activeFilter = "all";
let editingStoryId = null;
let timerInterval = null;
let adminUnlocked = false;
let selectedAudioFile = null;
let playbackUrls = new Map();
let isScrubbing = false;

const storiesQuery = query(storiesRef, orderBy("sortOrder", "asc"));

onSnapshot(
  storiesQuery,
  (snapshot) => {
    stories = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderStories();
  },
  (error) => {
    handleFirebaseError(error, "Error al conectar con Firestore");
  }
);

dom.adminToggle.addEventListener("click", () => {
  if (adminUnlocked) {
    dom.adminPanel.classList.toggle("hidden");
    return;
  }
  openPinModal();
});

dom.closePinModal.addEventListener("click", closePinModal);

dom.pinModal.addEventListener("click", (event) => {
  if (event.target === dom.pinModal) closePinModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !dom.pinModal.classList.contains("hidden")) {
    closePinModal();
  }
});

dom.pinForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (dom.pinInput.value.trim() !== ADMIN_PIN) {
    showToast("PIN incorrecto.");
    return;
  }

  adminUnlocked = true;
  closePinModal();
  dom.adminPanel.classList.remove("hidden");
  renderStories();
  showToast("Modo administrador desbloqueado.");
});

dom.lockAdmin.addEventListener("click", () => {
  adminUnlocked = false;
  cancelEditing();
  dom.adminPanel.classList.add("hidden");
  renderStories();
  showToast("Modo administrador bloqueado.");
});

dom.audioFileInput.addEventListener("change", () => {
  const file = dom.audioFileInput.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("audio/")) {
    dom.audioFileInput.value = "";
    showToast("Elige un archivo de audio.");
    return;
  }

  if (file.size > MAX_AUDIO_BYTES) {
    dom.audioFileInput.value = "";
    showToast("Ese audio es muy grande. Usa uno menor a 11 MB.");
    return;
  }

  selectedAudioFile = file;
  dom.filePickerTitle.textContent = file.name;
  dom.filePickerMeta.textContent = `${formatFileSize(file.size)} listo para agregar`;
  dom.uploadHint.textContent = "Listo. Al guardar, el audio se subirá a Firebase.";

  if (!dom.titleInput.value.trim()) {
    dom.titleInput.value = titleFromFileName(file.name);
  }
});

dom.storyForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = dom.titleInput.value.trim();

  if (!title) {
    showToast("Agrega un título.");
    return;
  }

  if (!editingStoryId && !selectedAudioFile) {
    showToast("Elige un archivo de audio para subir.");
    return;
  }

  try {
    dom.submitStory.disabled = true;
    setUploadProgress(4, "Preparando audio...");

    if (editingStoryId) {
      const existingStory = stories.find((story) => story.id === editingStoryId);
      const replacementAudio = selectedAudioFile
        ? await uploadAudioToRealtimeDatabase(selectedAudioFile)
        : null;

      if (replacementAudio && existingStory?.rtdbPath) {
        await remove(ref(rtdb, existingStory.rtdbPath));
        revokePlaybackUrl(editingStoryId);
      }

      await updateDoc(doc(db, "stories", editingStoryId), {
        title,
        ...(replacementAudio || {}),
        updatedAt: serverTimestamp()
      });
      showToast("Cuento actualizado.");
    } else {
      const uploadedAudio = await uploadAudioToRealtimeDatabase(selectedAudioFile);

      await addDoc(storiesRef, {
        title,
        ...uploadedAudio,
        favorite: false,
        sortOrder: stories.length + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showToast("Cuento agregado con éxito.");
    }

    cancelEditing();
  } catch (error) {
    handleFirebaseError(error, "No se pudo guardar el cuento");
  } finally {
    dom.submitStory.disabled = false;
    setUploadProgress(0);
  }
});

dom.cancelEdit.addEventListener("click", cancelEditing);

dom.allTab.addEventListener("click", () => setFilter("all"));
dom.favoritesTab.addEventListener("click", () => setFilter("favorites"));

dom.playPause.addEventListener("click", async () => {
  if (!dom.audioPlayer.src) {
    showToast("Primero elige un cuento.");
    return;
  }

  if (dom.audioPlayer.paused) {
    await playAudio();
  } else {
    dom.audioPlayer.pause();
  }
});

dom.back10.addEventListener("click", () => {
  if (!dom.audioPlayer.src) return;
  dom.audioPlayer.currentTime = Math.max(0, dom.audioPlayer.currentTime - 10);
});

dom.forward10.addEventListener("click", () => {
  if (!dom.audioPlayer.src) return;
  const duration = Number.isFinite(dom.audioPlayer.duration) ? dom.audioPlayer.duration : 0;
  dom.audioPlayer.currentTime = Math.min(duration, dom.audioPlayer.currentTime + 10);
});

// Desplazamiento fluido en la barra de progreso
dom.progressBar.addEventListener("mousedown", () => { isScrubbing = true; });
dom.progressBar.addEventListener("touchstart", () => { isScrubbing = true; });

dom.progressBar.addEventListener("input", () => {
  const duration = Number.isFinite(dom.audioPlayer.duration) ? dom.audioPlayer.duration : 0;
  dom.currentTime.textContent = formatTime((Number(dom.progressBar.value) / 100) * duration);
});

dom.progressBar.addEventListener("change", () => {
  const duration = Number.isFinite(dom.audioPlayer.duration) ? dom.audioPlayer.duration : 0;
  dom.audioPlayer.currentTime = (Number(dom.progressBar.value) / 100) * duration;
  isScrubbing = false;
});

dom.audioPlayer.addEventListener("play", () => {
  dom.playPause.innerHTML = icons.pause;
  dom.playPause.title = "Pausar";
  renderStories();
});

dom.audioPlayer.addEventListener("pause", () => {
  dom.playPause.innerHTML = icons.play;
  dom.playPause.title = "Reproducir";
  renderStories();
});

dom.audioPlayer.addEventListener("timeupdate", updateProgress);
dom.audioPlayer.addEventListener("loadedmetadata", updateProgress);

dom.audioPlayer.addEventListener("ended", () => {
  playNextStory();
});

dom.audioPlayer.addEventListener("error", () => {
  showToast("Ocurrió un error al cargar el reproductor de audio.");
  resetPlayer();
});

// Lógica de temporizador de apagado con cuenta regresiva
dom.timerSelect.addEventListener("change", () => {
  clearSleepTimer();

  const minutes = Number(dom.timerSelect.value);
  if (!minutes) {
    showToast("Timer apagado.");
    return;
  }

  let remainingSeconds = minutes * 60;

  function updateTimerDisplay() {
    if (remainingSeconds <= 0) {
      clearSleepTimer();
      dom.audioPlayer.pause();
      dom.timerSelect.value = "0";
      showToast("Timer terminado. ¡Que duermas bonito!");
      return;
    }

    const mins = Math.floor(remainingSeconds / 60);
    const secs = Math.floor(remainingSeconds % 60).toString().padStart(2, "0");
    if (dom.timerCountdown) {
      dom.timerCountdown.textContent = `${mins}:${secs}`;
      dom.timerCountdown.classList.remove("hidden");
    }
    remainingSeconds -= 1;
  }

  updateTimerDisplay();
  timerInterval = window.setInterval(updateTimerDisplay, 1000);

  showToast(`Timer activado por ${minutes} minutos.`);
});

function playNextStory() {
  const visibleStories = activeFilter === "favorites"
    ? stories.filter((story) => story.favorite)
    : stories;

  if (!visibleStories.length) {
    resetPlayer();
    return;
  }

  const currentIndex = visibleStories.findIndex((story) => story.id === currentStoryId);

  if (currentIndex !== -1 && currentIndex + 1 < visibleStories.length) {
    const nextStory = visibleStories[currentIndex + 1];
    selectStory(nextStory);
  } else {
    resetPlayer();
    showToast("Has llegado al final de la lista. ¡Buenas noches!");
  }
}

function renderStories() {
  const visibleStories = activeFilter === "favorites"
    ? stories.filter((story) => story.favorite)
    : stories;

  dom.storyCount.textContent = `${stories.length} ${stories.length === 1 ? "cuento" : "cuentos"}`;
  dom.listEyebrow.textContent = activeFilter === "favorites" ? "Favoritos" : "Biblioteca";
  dom.listTitle.textContent = activeFilter === "favorites" ? "Cuentos favoritos" : "Todos los cuentos";

  if (!visibleStories.length) {
    dom.storyList.innerHTML = `
      <div class="empty-state">
        ${icons.emptyHeart}
        <div>
          <h3>${activeFilter === "favorites" ? "Aún no hay favoritos" : "Todavía no hay cuentos"}</h3>
          <p>${activeFilter === "favorites" ? "Marca un corazón para guardarlo aquí." : "Entra a Admin para agregar tu primer cuento de audio."}</p>
        </div>
      </div>
    `;
    return;
  }

  dom.storyList.innerHTML = visibleStories.map((story) => storyTemplate(story)).join("");

  dom.storyList.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleStoryAction(button.dataset.action, button.dataset.id));
  });
}

function storyTemplate(story) {
  const isActive = story.id === currentStoryId;
  const isPlaying = isActive && !dom.audioPlayer.paused;
  const isFav = Boolean(story.favorite);
  const favoriteIcon = isFav ? icons.heart : icons.heartOutline;
  const adminActions = adminUnlocked
    ? `
        <button class="story-action" type="button" data-action="up" data-id="${story.id}" aria-label="Subir en orden" title="Subir">${icons.up}</button>
        <button class="story-action" type="button" data-action="down" data-id="${story.id}" aria-label="Bajar en orden" title="Bajar">${icons.down}</button>
        <button class="story-action" type="button" data-action="edit" data-id="${story.id}" aria-label="Editar" title="Editar">${icons.edit}</button>
        <button class="story-action danger" type="button" data-action="delete" data-id="${story.id}" aria-label="Borrar" title="Borrar">${icons.trash}</button>
      `
    : "";

  return `
    <article class="story-card ${isActive ? "active" : ""}">
      <button class="story-play" type="button" data-action="play" data-id="${story.id}" aria-label="Reproducir ${escapeHtml(story.title)}" title="Reproducir">
        ${isPlaying ? icons.pause : icons.play}
      </button>
      <div class="story-main">
        <p class="story-title">${escapeHtml(story.title)}</p>
        <p class="story-path">${escapeHtml(story.fileName || "Audio guardado en Firebase")}</p>
      </div>
      <div class="story-actions">
        <button class="story-action favorite ${isFav ? "is-active" : ""}" type="button" data-action="favorite" data-id="${story.id}" aria-label="Cambiar favorito" title="Favorito">${favoriteIcon}</button>
        ${adminActions}
      </div>
    </article>
  `;
}

async function handleStoryAction(action, id) {
  const story = stories.find((item) => item.id === id);
  if (!story) return;

  if (action === "play") {
    if (currentStoryId === story.id && !dom.audioPlayer.paused) {
      dom.audioPlayer.pause();
      return;
    }

    selectStory(story);
    return;
  }

  if (action === "favorite") {
    try {
      await updateDoc(doc(db, "stories", id), {
        favorite: !story.favorite,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirebaseError(error, "No se pudo actualizar el favorito");
    }
    return;
  }

  if (action === "edit") {
    startEditing(story);
    return;
  }

  if (action === "delete") {
    const confirmed = window.confirm("Esto borrará el cuento y su audio guardado en Firebase.");
    if (confirmed) {
      try {
        if (story.rtdbPath) {
          await remove(ref(rtdb, story.rtdbPath));
          revokePlaybackUrl(story.id);
        }
        await deleteDoc(doc(db, "stories", id));
        if (currentStoryId === id) resetPlayer();
        showToast("Cuento borrado de la biblioteca.");
      } catch (error) {
        handleFirebaseError(error, "No se pudo borrar el cuento");
      }
    }
    return;
  }

  if (action === "up" || action === "down") {
    await moveStory(id, action === "up" ? -1 : 1);
  }
}

async function moveStory(id, direction) {
  const ordered = [...stories].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const index = ordered.findIndex((story) => story.id === id);
  const swapIndex = index + direction;

  if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;

  const current = ordered[index];
  const swap = ordered[swapIndex];
  const batch = writeBatch(db);

  batch.update(doc(db, "stories", current.id), {
    sortOrder: swap.sortOrder,
    updatedAt: serverTimestamp()
  });
  batch.update(doc(db, "stories", swap.id), {
    sortOrder: current.sortOrder,
    updatedAt: serverTimestamp()
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirebaseError(error, "No se pudo reordenar los cuentos");
  }
}

async function selectStory(story) {
  currentStoryId = story.id;
  dom.currentTitle.textContent = story.title;
  renderStories();

  try {
    dom.audioPlayer.src = await getPlayableUrl(story);
    dom.audioPlayer.load();
    await playAudio();
  } catch (error) {
    handleFirebaseError(error, "No se pudo cargar el audio");
  }
}

async function playAudio() {
  try {
    await dom.audioPlayer.play();
  } catch (error) {
    showToast(`No se pudo reproducir el audio: ${error.message}`);
  }
}

function startEditing(story) {
  editingStoryId = story.id;
  resetFilePicker();
  dom.titleInput.value = story.title;
  dom.submitStory.innerHTML = `${icons.edit} Guardar cambios`;
  dom.uploadHint.textContent = "Puedes cambiar solo el título o elegir otro audio para reemplazarlo.";
  dom.cancelEdit.classList.remove("hidden");
  adminUnlocked = true;
  dom.adminPanel.classList.remove("hidden");
  dom.titleInput.focus();
}

function cancelEditing() {
  editingStoryId = null;
  dom.submitStory.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> Agregar cuento';
  dom.cancelEdit.classList.add("hidden");
  dom.storyForm.reset();
  resetFilePicker();
}

function setFilter(filter) {
  activeFilter = filter;
  dom.allTab.classList.toggle("active", filter === "all");
  dom.favoritesTab.classList.toggle("active", filter === "favorites");
  renderStories();
}

function updateProgress() {
  if (isScrubbing) return;

  const current = dom.audioPlayer.currentTime || 0;
  const duration = Number.isFinite(dom.audioPlayer.duration) ? dom.audioPlayer.duration : 0;

  dom.currentTime.textContent = formatTime(current);
  dom.duration.textContent = formatTime(duration);
  dom.progressBar.value = duration ? String((current / duration) * 100) : "0";
}

function resetPlayer() {
  currentStoryId = null;
  dom.audioPlayer.removeAttribute("src");
  dom.audioPlayer.load();
  dom.currentTitle.textContent = "Elige un cuento";
  dom.playPause.innerHTML = icons.play;
  if (dom.timerSelect) dom.timerSelect.value = "0";
  clearSleepTimer();
  updateProgress();
  renderStories();
}

function openPinModal() {
  dom.pinModal.classList.remove("hidden");
  dom.pinModal.setAttribute("aria-hidden", "false");
  window.setTimeout(() => dom.pinInput.focus(), 0);
}

function closePinModal() {
  dom.pinModal.classList.add("hidden");
  dom.pinModal.setAttribute("aria-hidden", "true");
  dom.pinInput.value = "";
}

function clearSleepTimer() {
  if (timerInterval) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
  if (dom.timerCountdown) {
    dom.timerCountdown.classList.add("hidden");
    dom.timerCountdown.textContent = "";
  }
}

function resetFilePicker() {
  selectedAudioFile = null;
  dom.filePickerTitle.textContent = "Elegir archivo";
  dom.filePickerMeta.textContent = "Selecciona un audio de tu computadora";
  dom.uploadHint.textContent = "El audio se guardará en Firebase Realtime Database al agregar el cuento.";
}

async function getPlayableUrl(story) {
  if (playbackUrls.has(story.id)) {
    return playbackUrls.get(story.id);
  }

  if (story.audioUrl) {
    return story.audioUrl;
  }

  if (!story.rtdbPath || !story.chunkCount) {
    throw new Error("El cuento no tiene datos de audio guardados.");
  }

  showToast("Cargando audio desde Firebase...");
  const chunksSnapshot = await get(ref(rtdb, `${story.rtdbPath}/chunks`));
  const chunks = chunksSnapshot.val();

  if (!chunks) {
    throw new Error("No se encontraron los datos del audio.");
  }

  const base64 = Array.from({ length: story.chunkCount }, (_, index) => chunks[index]).join("");
  const blob = base64ToBlob(base64, story.mimeType || "audio/mpeg");
  const url = URL.createObjectURL(blob);
  playbackUrls.set(story.id, url);
  return url;
}

async function uploadAudioToRealtimeDatabase(file) {
  const base64 = await fileToBase64(file);
  const chunks = splitString(base64, CHUNK_SIZE);
  const audioId = crypto.randomUUID();
  const audioPath = `audioFiles/${audioId}`;

  await set(ref(rtdb, `${audioPath}/meta`), {
    fileName: file.name,
    mimeType: file.type || "audio/mpeg",
    size: file.size,
    chunkCount: chunks.length,
    createdAt: Date.now()
  });

  for (let index = 0; index < chunks.length; index += 1) {
    await set(ref(rtdb, `${audioPath}/chunks/${index}`), chunks[index]);
    setUploadProgress(Math.round(((index + 1) / chunks.length) * 92) + 4, "Subiendo audio a Firebase...");
  }

  return {
    storageType: "rtdb",
    rtdbPath: audioPath,
    fileName: file.name,
    mimeType: file.type || "audio/mpeg",
    fileSize: file.size,
    chunkCount: chunks.length
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(String(reader.result).split(",")[1] || "");
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function splitString(value, size) {
  const chunks = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }
  return chunks;
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function revokePlaybackUrl(storyId) {
  const url = playbackUrls.get(storyId);
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
  playbackUrls.delete(storyId);
}

function setUploadProgress(percent, text) {
  let progress = dom.storyForm.querySelector(".upload-progress");

  if (!percent) {
    progress?.remove();
    return;
  }

  if (!progress) {
    progress = document.createElement("div");
    progress.className = "upload-progress";
    progress.innerHTML = "<span></span>";
    dom.storyForm.insertBefore(progress, dom.storyForm.querySelector(".form-actions"));
  }

  progress.querySelector("span").style.width = `${percent}%`;
  if (text) dom.uploadHint.textContent = text;
}

function titleFromFileName(fileName) {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = Math.floor(safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function handleFirebaseError(error, contextMessage) {
  const msg = String(error.message || error).toLowerCase();
  if (msg.includes("permission_denied") || msg.includes("permission denied") || msg.includes("insufficient permissions")) {
    showToast("PERMISSION DENIED: Revisa las Reglas en la consola de Firebase.");
  } else {
    showToast(`${contextMessage}: ${error.message || error}`);
  }
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    dom.toast.classList.add("hidden");
  }, 4500);
}
