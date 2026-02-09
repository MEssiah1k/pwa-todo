const DEFAULT_BGM_SRC = 'assets/bgm/default.mp3';

let audio = null;
let objectUrl = null;
let userInteracted = false;
let volume = 0.6;

function ensureAudio() {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.preload = 'none';
    audio.volume = volume;
  }
}

function safePlay() {
  if (!audio) return;
  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }
}

export function init() {
  ensureAudio();
  if (!audio.src) {
    audio.src = DEFAULT_BGM_SRC;
  }
  window.addEventListener('pointerdown', () => {
    userInteracted = true;
  }, { once: true });
}

export function setSource(source) {
  ensureAudio();
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  if (source instanceof File) {
    objectUrl = URL.createObjectURL(source);
    audio.src = objectUrl;
  } else if (typeof source === 'string') {
    audio.src = source;
  }
}

export function setVolume(value) {
  const next = Math.max(0, Math.min(1, value));
  volume = next;
  if (audio) audio.volume = volume;
}

export function play() {
  ensureAudio();
  if (!userInteracted) return;
  safePlay();
}

export function pause() {
  if (audio) audio.pause();
}

export function stop() {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}
