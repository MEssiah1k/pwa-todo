const LEGACY_INDEX_FILE = /\/index\.html$/i;

function normalizePathname(pathname) {
  const normalized = String(pathname || '/').replace(/\/{2,}/g, '/');
  const withoutIndex = normalized.replace(LEGACY_INDEX_FILE, '/');
  if (withoutIndex.endsWith('/')) return withoutIndex;
  return `${withoutIndex}/`;
}

export function getStorageScopeUrl() {
  if (typeof window === 'undefined' || !window.location) return 'app://local/';
  const { origin, pathname } = window.location;
  return `${origin}${normalizePathname(pathname)}`;
}

export function createScopedStorageKey(baseKey) {
  return `${baseKey}::${getStorageScopeUrl()}`;
}

export function createScopedDbName(baseName) {
  return `${baseName}::${encodeURIComponent(getStorageScopeUrl())}`;
}

export function migrateLegacyLocalStorageKeys(baseKeys) {
  if (typeof window === 'undefined' || !window.localStorage) return;

  baseKeys.forEach(baseKey => {
    const scopedKey = createScopedStorageKey(baseKey);
    try {
      if (window.localStorage.getItem(scopedKey) != null) return;
      const legacyValue = window.localStorage.getItem(baseKey);
      if (legacyValue == null) return;
      window.localStorage.setItem(scopedKey, legacyValue);
      window.localStorage.removeItem(baseKey);
    } catch (err) {
      // 忽略本地迁移失败，避免阻断应用启动
    }
  });
}
