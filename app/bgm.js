const DEFAULT_BGM_SRC = new URL('../assets/bgm/pinknoise.m4a', import.meta.url).href;
const DEBUG_LOG_LIMIT = 50;
const DECODE_TIMEOUT_MS = 8000;

let audioContext = null;
let currentSourceNode = null;
let currentGainNode = null;
let userInteracted = false;
let shouldBePlaying = false;
let volume = 0.6;
let playbackState = 'stopped';
let sourceConfig = { type: 'url', value: DEFAULT_BGM_SRC, label: 'default' };
let activePlaybackToken = 0;

const stateListeners = new Set();
const debugListeners = new Set();
const debugLogs = [];
const decodedBufferCache = new Map();

function summarizeError(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string' && error.message) return error.message;
  return String(error);
}

function emitState() {
  stateListeners.forEach(listener => {
    try {
      listener(playbackState);
    } catch (err) {
      // ignore
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

function setPlaybackState(nextState) {
  if (playbackState === nextState) return;
  playbackState = nextState;
  pushDebugLog('state', nextState);
  emitState();
}

function getDebugSnapshot() {
  return {
    playbackState,
    shouldBePlaying,
    userInteracted,
    volume,
    source: {
      type: sourceConfig.type,
      label: sourceConfig.label,
      value: sourceConfig.type === 'url' ? sourceConfig.value : sourceConfig.value?.name || ''
    },
    audio: audioContext
      ? {
          contextState: audioContext.state,
          sampleRate: audioContext.sampleRate,
          hasSourceNode: Boolean(currentSourceNode),
          hasGainNode: Boolean(currentGainNode)
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
      // ignore
    }
  });
}

function ensureAudioContext() {
  if (audioContext) return audioContext;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) {
    throw new Error('当前浏览器不支持 AudioContext');
  }
  audioContext = new Context();
  pushDebugLog('context.create', `state=${audioContext.state} sampleRate=${audioContext.sampleRate}`);
  emitDebug();
  return audioContext;
}

async function resumeAudioContext() {
  const context = ensureAudioContext();
  if (context.state === 'running') return context;
  pushDebugLog('context.resume.start', context.state);
  await context.resume();
  pushDebugLog('context.resume.done', context.state);
  emitDebug();
  return context;
}

function getSourceCacheKey() {
  if (sourceConfig.type === 'file') {
    const file = sourceConfig.value;
    if (!file) return 'file:unknown';
    return `file:${file.name}:${file.size}:${file.lastModified}`;
  }
  return `url:${sourceConfig.value}`;
}

async function readSourceArrayBuffer() {
  if (sourceConfig.type === 'file') {
    const file = sourceConfig.value;
    if (!file) throw new Error('未选择本地音频文件');
    pushDebugLog('source.file.read', `${file.name} ${file.size} bytes`);
    return file.arrayBuffer();
  }
  pushDebugLog('source.fetch.start', sourceConfig.value);
  const response = await fetch(sourceConfig.value, { cache: 'no-store' });
  pushDebugLog('source.fetch.done', `ok=${response.ok} status=${response.status}`);
  if (!response.ok) {
    throw new Error(`音频请求失败: ${response.status}`);
  }
  return response.arrayBuffer();
}

async function decodeCurrentSource(context) {
  const cacheKey = getSourceCacheKey();
  if (decodedBufferCache.has(cacheKey)) {
    pushDebugLog('decode.cache.hit', cacheKey);
    return decodedBufferCache.get(cacheKey);
  }

  pushDebugLog('decode.start', cacheKey);
  const arrayBuffer = await readSourceArrayBuffer();
  const audioBuffer = await decodeArrayBuffer(context, arrayBuffer);
  decodedBufferCache.set(cacheKey, audioBuffer);
  pushDebugLog('decode.done', `duration=${audioBuffer.duration.toFixed(2)}s channels=${audioBuffer.numberOfChannels}`);
  return audioBuffer;
}

function decodeArrayBuffer(context, arrayBuffer) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      pushDebugLog('decode.timeout', `${DECODE_TIMEOUT_MS}ms`);
      reject(new Error(`音频解码超时（${DECODE_TIMEOUT_MS}ms）`));
    }, DECODE_TIMEOUT_MS);

    const finishResolve = audioBuffer => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(audioBuffer);
    };

    const finishReject = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(error);
    };

    try {
      // 回调式 decodeAudioData 在部分移动浏览器上比 Promise 版稳定。
      const maybePromise = context.decodeAudioData(
        arrayBuffer.slice(0),
        audioBuffer => {
          pushDebugLog('decode.callback.resolve');
          finishResolve(audioBuffer);
        },
        error => {
          pushDebugLog('decode.callback.reject', summarizeError(error));
          finishReject(error || new Error('音频解码失败'));
        }
      );

      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(audioBuffer => {
          pushDebugLog('decode.promise.resolve');
          finishResolve(audioBuffer);
        }).catch(error => {
          pushDebugLog('decode.promise.reject', summarizeError(error));
          finishReject(error);
        });
      }
    } catch (error) {
      pushDebugLog('decode.throw', summarizeError(error));
      finishReject(error);
    }
  });
}

function stopCurrentPlayback() {
  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
    } catch (err) {
      // ignore repeated stop
    }
    currentSourceNode.disconnect();
    currentSourceNode = null;
  }
  if (currentGainNode) {
    currentGainNode.disconnect();
    currentGainNode = null;
  }
  emitDebug();
}

function unlockPlayback() {
  userInteracted = true;
  pushDebugLog('user.interaction');
  if (shouldBePlaying && playbackState !== 'playing') {
    void play();
  }
}

export function init() {
  pushDebugLog('init', DEFAULT_BGM_SRC);
  emitState();
  if (window.__pwaTodoBgmInitBound) return;
  window.__pwaTodoBgmInitBound = true;
  window.addEventListener('pointerdown', unlockPlayback, { passive: true });
  window.addEventListener('touchend', unlockPlayback, { passive: true });
  window.addEventListener('click', unlockPlayback, { passive: true });
  window.addEventListener('keydown', unlockPlayback);
}

export function setSource(source) {
  if (source instanceof File) {
    sourceConfig = {
      type: 'file',
      value: source,
      label: source.name || 'local-file'
    };
    pushDebugLog('source.set.file', sourceConfig.label);
  } else if (typeof source === 'string' && source) {
    sourceConfig = {
      type: 'url',
      value: source,
      label: source
    };
    pushDebugLog('source.set.url', source);
  }
  stopCurrentPlayback();
  if (shouldBePlaying) {
    void play();
  } else {
    emitDebug();
  }
}

export function setVolume(value) {
  volume = Math.max(0, Math.min(1, value));
  if (currentGainNode && audioContext) {
    currentGainNode.gain.setValueAtTime(volume, audioContext.currentTime);
  }
  pushDebugLog('volume.set', String(volume));
  emitDebug();
}

export function getVolume() {
  return volume;
}

export async function play() {
  shouldBePlaying = true;
  setPlaybackState('loading');
  const playbackToken = ++activePlaybackToken;
  pushDebugLog('play.call', `token=${playbackToken} interacted=${userInteracted}`);

  try {
    const context = await resumeAudioContext();
    const audioBuffer = await decodeCurrentSource(context);

    if (!shouldBePlaying || playbackToken !== activePlaybackToken) {
      pushDebugLog('play.cancelled', `token=${playbackToken}`);
      return;
    }

    stopCurrentPlayback();

    const gainNode = context.createGain();
    gainNode.gain.setValueAtTime(volume, context.currentTime);
    gainNode.connect(context.destination);

    const sourceNode = context.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.loop = true;
    sourceNode.connect(gainNode);
    sourceNode.onended = () => {
      if (currentSourceNode !== sourceNode) return;
      pushDebugLog('source.ended');
      currentSourceNode = null;
      currentGainNode = null;
      if (!shouldBePlaying) {
        setPlaybackState('paused');
      }
      emitDebug();
    };

    currentSourceNode = sourceNode;
    currentGainNode = gainNode;
    sourceNode.start(0);
    pushDebugLog('play.started', `token=${playbackToken}`);
    setPlaybackState('playing');
    emitDebug();
  } catch (error) {
    pushDebugLog('play.failed', summarizeError(error));
    setPlaybackState(userInteracted ? 'paused' : 'loading');
    emitDebug();
  }
}

export function pause() {
  shouldBePlaying = false;
  activePlaybackToken += 1;
  pushDebugLog('pause.call');
  stopCurrentPlayback();
  setPlaybackState('paused');
}

export function stop() {
  shouldBePlaying = false;
  activePlaybackToken += 1;
  pushDebugLog('stop.call');
  stopCurrentPlayback();
  setPlaybackState('stopped');
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
