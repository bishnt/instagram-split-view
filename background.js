/*
 * Instagram Split View - background service worker
 * Click the toolbar icon (or press Alt+Shift+I) to open two windows tiled
 * side by side: Home on the left half, DMs on the right half.
 */
const HOME_URL = 'https://www.instagram.com/';
const DM_URL = 'https://www.instagram.com/direct/inbox/';

chrome.action.onClicked.addListener(() => {
  openSplit().catch((e) => console.error('[IG Split View]', e));
});

// Content scripts ask which role (home | dm) their window has.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'igsv-role') {
    chrome.storage.session.get('split').then(({ split }) => {
      const wid = sender.tab && sender.tab.windowId;
      if (split && wid === split.homeId) sendResponse('home');
      else if (split && wid === split.dmId) sendResponse('dm');
      else sendResponse(null);
    });
    return true; // async response
  }
});

async function getWorkArea() {
  const win = await chrome.windows.getLastFocused().catch(() => null);
  try {
    const displays = await chrome.system.display.getInfo();
    if (win && win.left != null && win.width) {
      const cx = win.left + win.width / 2;
      const cy = win.top + win.height / 2;
      const hit = displays.find(
        (d) =>
          cx >= d.bounds.left && cx < d.bounds.left + d.bounds.width &&
          cy >= d.bounds.top && cy < d.bounds.top + d.bounds.height
      );
      if (hit) return hit.workArea;
    }
    const primary = displays.find((d) => d.isPrimary) || displays[0];
    if (primary) return primary.workArea;
  } catch (e) {
    console.warn('[IG Split View] display info unavailable', e);
  }
  // Fallback: use the last focused window's own area.
  if (win && win.width) return { left: win.left, top: win.top, width: win.width, height: win.height };
  return { left: 0, top: 0, width: 1920, height: 1040 };
}

async function openSplit() {
  const wa = await getWorkArea();
  const half = Math.floor(wa.width / 2);
  const leftBounds = { left: wa.left, top: wa.top, width: half, height: wa.height };
  const rightBounds = { left: wa.left + half, top: wa.top, width: wa.width - half, height: wa.height };

  const { split } = await chrome.storage.session.get('split');
  const state = { homeId: split && split.homeId, dmId: split && split.dmId };

  state.homeId = await ensureWindow(state.homeId, HOME_URL, leftBounds);
  await chrome.storage.session.set({ split: state });
  state.dmId = await ensureWindow(state.dmId, DM_URL, rightBounds);
  await chrome.storage.session.set({ split: state });
}

// Re-use (and re-tile) an existing window if it's still open, else create it.
async function ensureWindow(id, url, bounds) {
  if (id != null) {
    try {
      await chrome.windows.update(id, { ...bounds, state: 'normal', focused: true });
      return id;
    } catch (_) { /* window was closed */ }
  }
  const w = await chrome.windows.create({ url, type: 'popup', focused: true, ...bounds });
  // Some platforms ignore position/size on create; enforce it.
  try { await chrome.windows.update(w.id, bounds); } catch (_) {}
  return w.id;
}
