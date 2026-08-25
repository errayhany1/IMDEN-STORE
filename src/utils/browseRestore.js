/**
 * Save/restore storefront browse position when opening a product page.
 * Full navigations remount the app and wipe in-memory search + scroll.
 */
const KEY = 'browseRestore.v1';

export function saveBrowseRestore(partial = {}) {
  try {
    const prev = (() => {
      try {
        return JSON.parse(sessionStorage.getItem(KEY) || 'null') || {};
      } catch {
        return {};
      }
    })();

    const next = {
      ...prev,
      path: window.location.pathname + window.location.search,
      scrollY: typeof window.scrollY === 'number' ? window.scrollY : 0,
      savedAt: Date.now(),
      ...partial,
    };
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota */
  }
}

/** Snapshot from the live Zustand store + window. */
export function saveBrowseRestoreFromStore(getState) {
  const state = typeof getState === 'function' ? getState() : getState;
  if (!state) return;
  saveBrowseRestore({
    searchQuery: state.searchQuery || '',
    selectedFamily: state.selectedFamily || null,
    selectedCategory: state.selectedCategory || 'All',
    browseMode: state.browseMode === 'catalog' ? 'catalog' : 'shop',
    path: window.location.pathname + window.location.search,
    scrollY: window.scrollY || 0,
  });
}

export function peekBrowseRestore() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (data.savedAt && Date.now() - data.savedAt > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearBrowseRestore() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Apply snapshot to the store + scroll. Returns true if applied.
 * Call on storefront mount (/, /catalog, /family/...).
 */
export function applyBrowseRestore({
  setSearchQuery,
  setFamily,
  clearFamily,
  setCategory,
  setBrowseMode,
}) {
  const snap = peekBrowseRestore();
  if (!snap) return false;

  const path = window.location.pathname;
  const onStorefront =
    path === '/'
    || path === ''
    || path === '/catalog'
    || path === '/catalog/'
    || path.startsWith('/family/')
    || path.startsWith('/catalog/family/');

  if (!onStorefront) return false;

  // Prefer the exact list URL the user left (e.g. /family/audio?…)
  if (snap.path && typeof snap.path === 'string') {
    const current = window.location.pathname + window.location.search;
    if (snap.path !== current && !snap.path.startsWith('/p/')) {
      try {
        window.history.replaceState({}, '', snap.path);
      } catch {
        /* ignore */
      }
    }
  }

  if (snap.browseMode) setBrowseMode?.(snap.browseMode);

  if (snap.selectedFamily) {
    setFamily?.(snap.selectedFamily);
  } else {
    clearFamily?.();
  }

  if (snap.selectedCategory) setCategory?.(snap.selectedCategory);

  // setFamily clears searchQuery — restore search last
  if (typeof snap.searchQuery === 'string') {
    setSearchQuery?.(snap.searchQuery);
  }

  const y = Number(snap.scrollY) || 0;
  const restoreScroll = () => {
    window.scrollTo(0, y);
  };
  requestAnimationFrame(() => {
    restoreScroll();
    setTimeout(restoreScroll, 50);
    setTimeout(restoreScroll, 250);
    setTimeout(restoreScroll, 600);
  });

  clearBrowseRestore();
  return true;
}
