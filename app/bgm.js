const DEFAULT_BGM_SRC = new URL('../assets/bgm/pinknoise.m4a', import.meta.url).href;
const DEBUG_LOG_LIMIT = 40;

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
const debugListeners = new Set();
const debugLogs = [];

function summarizeError(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string' && error.message) return error.message;
  return String(error);
}

function getMediaErrorInfo() {
  if (!audio || !audio.error) return null;
  return {
    code: audio.error.code,
    message: audio.error.message || ''
  };
}

function getDebugSnapshot() {
  return {
    playbackState,
    userInteracted,
    retryOnNextInteraction,
    shouldBePlaying,
    waitingForCanPlay,
    reloadBeforeNextPlay,
    volume,
    audio: audio
      ? {
          src: audio.src || '',
          currentSrc: audio.currentSrc || '',
          paused: audio.paused,
          ended: audio.ended,
          muted: audio.muted,
          loop: audio.loop,
          currentTime: Number.isFinite(audio.currentTime) ? Number(audio.currentTime.toFixed(3)) : 0,
          readyState: audio.readyState,
          networkState: audio.networkState,
          error: getMediaErrorInfo()
        }
      : null,
    logs: [...debugLogs]
  };
}

function emitDebug() {
  const snapshot = getDebugSnapshot();
  debugListeners.forEach(listener => {
    try {
      listener(snapshot);
    } catch (err) {
      // 忽略调试面板渲染错误
    }
  });
}

function pushDebugLog(event, detail = '') {
  const time = new Date();
  const line = `[${time.toLocaleTimeString('zh-CN', { hour12: false })}] ${event}${detail ? ` | ${detail}` : ''}`;
  debugLogs.push(line);
  if (debugLogs.length > DEBUG_LOG_LIMIT) {
    debugLogs.splice(0, debugLogs.length - DEBUG_LOG_LIMIT);
  }
  emitDebug();
}

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
  pushDebugLog('state', nextState);
  emitState();
}

function clearRecoveryTimer() {
  if (!recoveryTimer) return;
  clearTimeout(recoveryTimer);
  recoveryTimer = null;
}

function clearWaitingForCanPlay() {
  waitingForCanPlay = false;
  emitDebug();
}

function scheduleRecovery() {
  if (!audio || !shouldBePlaying || recoveryTimer) return;
  pushDebugLog('recovery.schedule');
  recoveryTimer = setTimeout(() => {
    recoveryTimer = null;
    if (!audio || !shouldBePlaying) return;
    reloadBeforeNextPlay = true;
    pushDebugLog('recovery.run');
    play();
  }, 1000);
}

function ensureAudio() {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = volume;
    pushDebugLog('audio.create', DEFAULT_BGM_SRC);
    const mediaEvents = ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'play', 'playing', 'pause', 'waiting', 'stalled', 'suspend', 'abort', 'emptied', 'ended', 'error'];
    mediaEvents.forEach(eventName => {
      audio.addEventListener(eventName, () => {
        const errorInfo = getMediaErrorInfo();
        const detail = [
          `ready=${audio.readyState}`,
          `network=${audio.networkState}`,
          `paused=${audio.paused}`,
          `ended=${audio.ended}`,
          errorInfo ? `error=${errorInfo.code}:${errorInfo.message || 'unknown'}` : ''
        ].filter(Boolean).join(' ');
        pushDebugLog(`event.${eventName}`, detail);
      });
    });
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
      setPlaybackState('paused');
    });
    audio.addEventListener('pause', () => {
      if (!shouldBePlaying) {
        setPlaybackState('paused');
        return;
      }
      pushDebugLog('pause.ignored-while-should-play');
    });
    audio.addEventListener('stalled', () => {
      if (!shouldBePlaying) return;
      setPlaybackState('loading');
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
      if (!shouldBePlaying) {
        setPlaybackState('paused');
        return;
      }
      pushDebugLog('emptied.ignored-while-should-play');
    });
    audio.addEventListener('abort', clearWaitingForCanPlay);
    emitDebug();
  }
}

function safePlay() {
  if (!audio) return;
  pushDebugLog('play.attempt', `ready=${audio.readyState} network=${audio.networkState} interacted=${userInteracted}`);
  const playPromise = audio.play();
  emitDebug();
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise.then(() => {
      pushDebugLog('play.resolved');
    });
  }
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(error => {
      pushDebugLog('play.rejected', summarizeError(error));
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
  pushDebugLog('play.wait', `ready=${audio.readyState} network=${audio.networkState}`);
  const playWhenReady = () => {
    waitingForCanPlay = false;
    pushDebugLog('play.wait.resolved');
    if (!audio || !shouldBePlaying) return;
    safePlay();
  };
  audio.addEventListener('canplay', playWhenReady, { once: true });
  audio.addEventListener('loadeddata', playWhenReady, { once: true });
  emitDebug();
}

function unlockPlayback() {
  userInteracted = true;
  pushDebugLog('user.interaction');
  if (retryOnNextInteraction && shouldBePlaying) {
    retryOnNextInteraction = false;
    play();
  }
}

export function init() {
  ensureAudio();
  if (!audio.src) {
    audio.src = DEFAULT_BGM_SRC;
    pushDebugLog('audio.src.default', audio.src);
  }
  emitState();
  audio.load();
  pushDebugLog('audio.load.init');
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
    pushDebugLog('audio.src.file', source.name || 'local-file');
  } else if (typeof source === 'string') {
    audio.src = source;
    pushDebugLog('audio.src.string', source);
  }
  reloadBeforeNextPlay = true;
  emitDebug();
}

export function setVolume(value) {
  const next = Math.max(0, Math.min(1, value));
  volume = next;
  if (audio) audio.volume = volume;
  pushDebugLog('audio.volume', String(next));
}

export function getVolume() {
  return volume;
}

export function play() {
  ensureAudio();
  if (!audio.src) {
    audio.src = DEFAULT_BGM_SRC;
    pushDebugLog('audio.src.restore', audio.src);
  }
  shouldBePlaying = true;
  retryOnNextInteraction = true;
  pushDebugLog('play.call', `ready=${audio.readyState} network=${audio.networkState} paused=${audio.paused}`);

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
    pushDebugLog('play.skip.already-playing');
    setPlaybackState('playing');
    return;
  }

  setPlaybackState('loading');
  const needsReload = (
    reloadBeforeNextPlay ||
    audio.ended ||
    Boolean(audio.error) ||
    audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE ||
    !audio.currentSrc
  );
  if (needsReload) {
    // 只在明确需要时重建媒体请求，避免移动端反复 abort 当前加载。
    waitingForCanPlay = false;
    pushDebugLog('audio.load.play');
    audio.load();
    reloadBeforeNextPlay = false;
    if (audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      schedulePlayWhenReady();
    }
  }
  clearRecoveryTimer();
  if (!userInteracted) {
    // Some mobile/PWA environments do not fire pointerdown as expected,
    // but a direct play attempt inside the click handler can still succeed.
    pushDebugLog('play.direct.without-interaction-flag');
    safePlay();
    return;
  }
  retryOnNextInteraction = false;
  safePlay();
}

export function pause() {
  shouldBePlaying = false;
  clearRecoveryTimer();
  pushDebugLog('pause.call');
  setPlaybackState('paused');
  if (audio) audio.pause();
}

export function stop() {
  if (!audio) return;
  shouldBePlaying = false;
  clearRecoveryTimer();
  waitingForCanPlay = false;
  pushDebugLog('stop.call');
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

export function subscribeDebug(listener) {
  debugListeners.add(listener);
  listener(getDebugSnapshot());
  return () => {
    debugListeners.delete(listener);
  };
}
