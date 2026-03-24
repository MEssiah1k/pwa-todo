const DEFAULT_BGM_SRC = new URL('../assets/bgm/pinknoise.m4a', import.meta.url).href;

let audio = null;
let objectUrl = null;
let userInteracted = false;
let retryOnNextInteraction = false;
let volume = 0.6;
let reloadBeforeNextPlay = false;
let shouldBePlaying = false;
let recoveryTimer = null;
let unlockBound = false;
let waitingForCanPlay = false;
let playbackState = 'stopped';
const stateListeners = new Set();

function emitState() {
  stateListeners.forEach(listener => {
    try {
      listener(playbackState);
    } catch (err) {
      // Ignore listener errors so audio state updates stay resilient.
    }
  });
}

function setPlaybackState(nextState) {
  if (playbackState === nextState) return;
  playbackState = nextState;
  emitState();
}

function clearRecoveryTimer() {
  if (!recoveryTimer) return;
  clearTimeout(recoveryTimer);
  recoveryTimer = null;
}

function clearWaitingForCanPlay() {
  waitingForCanPlay = false;
}

function scheduleRecovery() {
  if (!audio || !shouldBePlaying || recoveryTimer) return;
  recoveryTimer = setTimeout(() => {
    recoveryTimer = null;
    if (!audio || !shouldBePlaying) return;
    reloadBeforeNextPlay = true;
    play();
  }, 200);
}

function ensureAudio() {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = volume;
    audio.addEventListener('play', () => {
      clearWaitingForCanPlay();
      setPlaybackState('playing');
    });
    audio.addEventListener('playing', () => {
      clearWaitingForCanPlay();
      setPlaybackState('playing');
    });
    audio.addEventListener('canplay', clearWaitingForCanPlay);
    audio.addEventListener('loadeddata', clearWaitingForCanPlay);
    audio.addEventListener('ended', () => {
      if (!shouldBePlaying) return;
      setPlaybackState('loading');
      scheduleRecovery();
    });
    audio.addEventListener('pause', () => {
      if (!shouldBePlaying) {
        setPlaybackState('paused');
        return;
      }
      setPlaybackState('loading');
      scheduleRecovery();
    });
    audio.addEventListener('stalled', () => {
      setPlaybackState('loading');
      scheduleRecovery();
    });
    audio.addEventListener('waiting', () => {
      if (!shouldBePlaying) return;
      setPlaybackState('loading');
    });
    audio.addEventListener('error', () => {
      clearWaitingForCanPlay();
      setPlaybackState('loading');
      scheduleRecovery();
    });
    audio.addEventListener('emptied', () => {
      clearWaitingForCanPlay();
      setPlaybackState('loading');
      scheduleRecovery();
    });
    audio.addEventListener('abort', clearWaitingForCanPlay);
  }
}

function safePlay() {
  if (!audio) return;
  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {
      retryOnNextInteraction = true;
      if (!userInteracted) {
        // 刷新恢复后的自动播放常被浏览器拦截，此时不要长期停留在“准备中”。
        setPlaybackState('paused');
        return;
      }
      if (shouldBePlaying && userInteracted) {
        reloadBeforeNextPlay = true;
        scheduleRecovery();
      }
    });
  }
}

function schedulePlayWhenReady() {
  if (!audio || waitingForCanPlay) return;
  waitingForCanPlay = true;
  const playWhenReady = () => {
    waitingForCanPlay = false;
    if (!audio || !shouldBePlaying) return;
    safePlay();
  };
  audio.addEventListener('canplay', playWhenReady, { once: true });
  audio.addEventListener('loadeddata', playWhenReady, { once: true });
}

function unlockPlayback() {
  userInteracted = true;
  if (retryOnNextInteraction && shouldBePlaying) {
    retryOnNextInteraction = false;
    play();
  }
}

export function init() {
  ensureAudio();
  if (!audio.src) {
    audio.src = DEFAULT_BGM_SRC;
  }
  emitState();
  audio.load();
  if (unlockBound) return;
  unlockBound = true;
  window.addEventListener('pointerdown', unlockPlayback, { passive: true });
  window.addEventListener('touchend', unlockPlayback, { passive: true });
  window.addEventListener('click', unlockPlayback, { passive: true });
  window.addEventListener('keydown', unlockPlayback);
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
  reloadBeforeNextPlay = true;
}

export function setVolume(value) {
  const next = Math.max(0, Math.min(1, value));
  volume = next;
  if (audio) audio.volume = volume;
}

export function getVolume() {
  return volume;
}

export function play() {
  ensureAudio();
  if (!audio.src) {
    audio.src = DEFAULT_BGM_SRC;
  }
  shouldBePlaying = true;
  retryOnNextInteraction = true;

  const alreadyPlaying = (
    !audio.paused &&
    !audio.ended &&
    !audio.error &&
    audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
  );
  if (alreadyPlaying) {
    clearRecoveryTimer();
    reloadBeforeNextPlay = false;
    retryOnNextInteraction = false;
    setPlaybackState('playing');
    return;
  }

  setPlaybackState('loading');
  const needsReload = (
    reloadBeforeNextPlay ||
    audio.ended ||
    Boolean(audio.error) ||
    audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE ||
    audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
  );
  if (needsReload) {
    // Rebuild media state after stop/end/background suspension.
    waitingForCanPlay = false;
    audio.load();
    reloadBeforeNextPlay = false;
    if (audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      schedulePlayWhenReady();
      scheduleRecovery();
    }
  }
  clearRecoveryTimer();
  if (!userInteracted) {
    // Some mobile/PWA environments do not fire pointerdown as expected,
    // but a direct play attempt inside the click handler can still succeed.
    safePlay();
    return;
  }
  retryOnNextInteraction = false;
  safePlay();
}

export function pause() {
  shouldBePlaying = false;
  clearRecoveryTimer();
  setPlaybackState('paused');
  if (audio) audio.pause();
}

export function stop() {
  if (!audio) return;
  shouldBePlaying = false;
  clearRecoveryTimer();
  waitingForCanPlay = false;
  setPlaybackState('stopped');
  audio.pause();
  try {
    audio.currentTime = 0;
  } catch (err) {
    // Some browsers can reject seeking before metadata is ready.
  }
}

export function getPlaybackState() {
  return playbackState;
}

export function subscribePlaybackState(listener) {
  stateListeners.add(listener);
  listener(playbackState);
  return () => {
    stateListeners.delete(listener);
  };
}
