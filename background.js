/*
 * Instagram Split View - background service worker
 *
 * Click the toolbar icon (or press Alt+Shift+I):
 *   - opens Instagram Home and Instagram DMs as two adjacent tabs, and
 *   - joins them into the browser's native Split View (chrome.tabs.createSplit,
 *     Chrome 155+), Home on the left half and DMs on the right half.
 * If the browser has no Split View API yet, the two tabs are still opened side by
 * side in the tab strip and a notification explains how to split them manually.
 */
const HOME_URL = 'https://www.instagram.com/';
const DM_URL = 'https://www.instagram.com/direct/inbox/';

chrome.action.onClicked.addListener(() => {
  openSplit().catch((e) => console.error('[IG Split View]', e));
});

// Content scripts ask which role (home | dm) their tab has.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'igsv-role') {
    chrome.storage.session.get('split').then(({ split }) => {
      const id = sender.tab && sender.tab.id;
      if (split && id === split.homeTabId) sendResponse('home');
      else if (split && id === split.dmTabId) sendResponse('dm');
      else sendResponse(null);
    });
    return true; // async response
  }
});

const getTab = (id) =>
  id == null ? Promise.resolve(null) : chrome.tabs.get(id).catch(() => null);

async function openSplit() {
  const { split } = await chrome.storage.session.get('split');
  let home = await getTab(split && split.homeTabId);
  let dm = await getTab(split && split.dmTabId);

  const win = await chrome.windows.getLastFocused().catch(() => null);
  const windowId = home ? home.windowId : win ? win.id : undefined;

  if (!home) home = await chrome.tabs.create({ url: HOME_URL, windowId, active: true });
  if (!dm) dm = await chrome.tabs.create({ url: DM_URL, windowId: home.windowId, index: home.index + 1, active: false });
  await chrome.storage.session.set({ split: { homeTabId: home.id, dmTabId: dm.id } });

  // Split View needs the two tabs next to each other (Home first, DMs second).
  if (dm.windowId !== home.windowId || dm.index !== home.index + 1) {
    dm = await chrome.tabs.move(dm.id, { windowId: home.windowId, index: home.index + 1 });
    dm = Array.isArray(dm) ? dm[0] : dm;
  }

  if (typeof chrome.tabs.createSplit !== 'function') {
    notify('Your browser has no Split View API yet (needs Chrome 155+ or a matching Chromium). ' +
      'The two tabs are open next to each other: use the browser\'s own split view to show them side by side.');
    await chrome.tabs.update(home.id, { active: true });
    return;
  }

  try {
    await chrome.tabs.createSplit([home.id, dm.id]);
  } catch (e) {
    // Most likely already in a split view (button pressed twice) - verify before complaining.
    const [h, d] = await Promise.all([getTab(home.id), getTab(dm.id)]);
    const same = h && d && h.splitViewId != null && h.splitViewId === d.splitViewId && h.splitViewId !== -1;
    if (!same) {
      console.error('[IG Split View] createSplit failed', e);
      notify('Could not create the split view: ' + (e && e.message ? e.message : e));
    }
  }
  await chrome.tabs.update(home.id, { active: true });
}

function notify(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: 'Instagram Split View',
    message,
  });
}
