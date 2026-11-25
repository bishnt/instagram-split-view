/*
 * Instagram Minimal: one tab, split in two, no iframes.
 *
 *     Home feed (left half)  |  Messages (right half)
 *
 * This runs on the real instagram.com page.
 *  - The page body is narrowed to the left half of the window.
 *  - Instagram's own floating "Messages" panel (and any chat window it opens) is
 *    docked to the full height of the right half.
 *  - Navigation, logos, story tray, suggestions, ads and footers are removed.
 *
 * Instagram's markup changes often and uses obfuscated class names, so everything
 * here is found by links, labels and layout. If something reappears, add it to the
 * lists under "Things to remove".
 */
(() => {
  'use strict';
  if (window.top !== window.self) return;

  const FLOW_PATHS = ['/accounts/', '/challenge/', '/auth_platform/']; // login / checkpoint
  const MIN_PANEL_H = 150; // a Messages box shorter than this is the collapsed pill
  const MAX_PILL_CLICKS = 5; // attempts to open the Messages pill before showing the fallback
  const PILL_RETRY_MS = 3000;

  // ---------------- Things to remove ----------------
  // Links that identify the main navigation (the fixed bar around them is retired).
  const NAV_LINKS = ['a[href="/explore/"]', 'a[href="/reels/"]', 'a[href^="/explore/search"]'];
  // Anchors that identify the right-hand suggestions column on Home.
  const SIDEBAR_LINKS = ['a[href="/explore/people/"]'];
  // Individual links to hide (menus containing them are hidden whole).
  const HIDE_LINKS = ['a[href^="/accounts/activity"]'];
  // Visible text that marks clutter on Home (exact match on a single element).
  const CLUTTER_TEXT = ['Suggested for you'];
  const AD_TEXT = 'Sponsored';
  // --------------------------------------------------

  const root = document.documentElement;
  const inFlow = (p) => FLOW_PATHS.some((x) => p.startsWith(x));
  const allowed = (p) => inFlow(p) || p === '/' || p.startsWith('/direct/');
  const route = () => {
    const p = location.pathname;
    return inFlow(p) ? 'flow' : p.startsWith('/direct/') ? 'dm' : 'home';
  };
  const log = (...a) => console.debug('[igsv]', ...a);

  const CSS = `
    * { scrollbar-width: none !important; }
    *::-webkit-scrollbar { display: none !important; }

    /* logos and footers */
    svg[aria-label="Instagram"], img[alt="Instagram"],
    svg[aria-label="Meta"], img[alt="Meta"],
    a[href="/"]:has(> svg[aria-label="Instagram"]),
    a[href="/"]:has(> div > svg[aria-label="Instagram"]),
    footer { display: none !important; }

    /* left half: the feed. The (hidden) nav rail's width is pulled off the left edge. */
    html.igsv-home, html.igsv-dm { overflow-x: hidden !important; }
    html.igsv-home body, html.igsv-dm body { margin-left: calc(var(--igsv-rail, 0px) * -1) !important; }
    html.igsv-home body { margin-right: 50vw !important; }

    /* right half: a quiet surface behind the docked Messages panel */
    html.igsv-home::before {
      content: ""; position: fixed; top: 0; right: 0; bottom: 0; left: 50vw; pointer-events: none;
      background: rgba(128,128,128,.06); border-left: 1px solid rgba(128,128,128,.22);
    }

    /* Messages panel and chat windows, docked to the right half */
    [data-igsv] {
      position: fixed !important; inset: 0 0 0 50vw !important;
      width: 50vw !important; height: 100vh !important;
      min-width: 0 !important; min-height: 0 !important; max-width: none !important; max-height: none !important;
      margin: 0 !important; transform: none !important; border-radius: 0 !important; box-shadow: none !important;
    }
    [data-igsv] > * { max-height: none !important; }
    [data-igsv="chat"] { z-index: 2147483000 !important; }

    /* right half placeholder while Messages is opening (or if it can't be docked) */
    .igsv-fallback {
      position: fixed; top: 0; right: 0; bottom: 0; left: 50vw; z-index: 1; box-sizing: border-box; padding: 24px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center;
      font: 400 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: inherit; opacity: .85;
    }
    .igsv-fallback a, .igsv-fallback button {
      font: 600 13px/1.4 inherit; font-family: inherit; color: inherit; cursor: pointer; text-decoration: none;
      padding: 6px 14px; border-radius: 999px; border: 0; background: rgba(128,128,128,.22);
    }
    .igsv-fallback .igsv-actions { display: flex; gap: 8px; }

    /* shown only if Instagram opens the full-page inbox */
    .igsv-back {
      position: fixed; top: 12px; left: 12px; z-index: 2147483647; padding: 6px 14px; border-radius: 999px;
      font: 600 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; text-decoration: none;
      color: inherit; background: rgba(128,128,128,.18); backdrop-filter: blur(8px);
    }
  `;
  const style = document.createElement('style');
  style.textContent = CSS;
  root.appendChild(style);

  /* ---------- Route handling ---------- */

  let back = null;
  function applyRoute() {
    const r = route();
    root.classList.toggle('igsv-home', r === 'home');
    root.classList.toggle('igsv-dm', r === 'dm');
    if (r === 'dm' && !back && document.body) {
      back = document.createElement('a');
      back.className = 'igsv-back';
      back.href = '/';
      back.textContent = '‹ Feed';
      document.body.appendChild(back);
    } else if (r !== 'dm' && back) {
      back.remove();
      back = null;
    }
  }
  applyRoute();

  // 1) Links to anywhere else do nothing.
  document.addEventListener(
    'click',
    (e) => {
      const a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      let url;
      try { url = new URL(a.getAttribute('href'), location.href); } catch (_) { return; }
      if (url.origin !== location.origin) return;
      if (!allowed(url.pathname)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );

  // 2) Route changes that slip through (SPA pushState, modals) are sent back.
  setInterval(() => {
    if (!allowed(location.pathname)) location.replace('/');
    else applyRoute();
  }, 400);

  /* ---------- DOM helpers ---------- */

  const hide = (el) => {
    if (el && el.style && el.style.display !== 'none') el.style.setProperty('display', 'none', 'important');
  };
  // Invisible but still laid out, so the rail width stays measurable.
  const quiet = (el) => {
    if (el && el.style && el.style.visibility !== 'hidden') {
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    }
  };
  const isLeaf = (el) => !el.children.length;
  const hasMain = (box) => !!box.querySelector('main, article, [role="main"]');

  // Outermost fixed/sticky ancestor: the bar, rail or popup an element lives in.
  function outerFixed(el) {
    let found = null;
    for (let p = el; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const pos = getComputedStyle(p).position;
      if (pos === 'fixed' || pos === 'sticky') found = p;
    }
    return found;
  }

  // A tall bar pinned to the left edge is the nav rail (kept laid out, then pulled off
  // screen by the body margin); anything else (bottom bar, top bar) is removed.
  // Returns the rail width, or 0.
  function retire(box) {
    if (!box || hasMain(box)) return 0;
    const r = box.getBoundingClientRect();
    if (!r.width && !r.height) return 0;
    if (r.height > r.width && r.left <= 1) { quiet(box); return Math.round(r.right); }
    hide(box);
    return 0;
  }

  // The branch of the layout that sits beside the posts (story tray, suggestions
  // column): a sibling of the branch containing an <article>.
  function feedBranch(el) {
    for (let n = el; n && n.parentElement; n = n.parentElement) {
      if (n.parentElement.querySelector('article')) return n.querySelector('article') ? null : n;
    }
    return null;
  }

  /* ---------- Messages panel ---------- */

  let pillClicks = 0;
  let pillClickAt = 0;
  let fallback = null;
  const sweepStart = Date.now();

  // Right-half placeholder: never leave the right side blank or broken.
  function showFallback(failed) {
    if (!document.body) return;
    if (!fallback) {
      fallback = document.createElement('div');
      fallback.className = 'igsv-fallback';
      document.body.appendChild(fallback);
    }
    const state = failed ? 'failed' : 'opening';
    if (fallback.getAttribute('data-state') === state) return;
    fallback.setAttribute('data-state', state);
    fallback.textContent = '';
    const msg = document.createElement('div');
    fallback.appendChild(msg);
    if (!failed) {
      msg.textContent = 'Opening Messages…';
      return;
    }
    msg.textContent = 'Couldn’t dock Messages here.';
    const actions = document.createElement('div');
    actions.className = 'igsv-actions';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => { pillClicks = 0; pillClickAt = 0; lastSweep = 0; schedule(); });
    const full = document.createElement('a');
    full.href = '/direct/inbox/';
    full.textContent = 'Open full inbox';
    actions.append(retry, full);
    fallback.appendChild(actions);
  }
  function hideFallback() {
    if (fallback) { fallback.remove(); fallback = null; }
  }

  // The element React actually listens on is usually the button around the label.
  const clickTarget = (leaf) => leaf.closest('[role="button"], button, a[href], [tabindex]') || leaf;

  // Finds Instagram's floating Messages pill / panel. Opens the pill (retrying a few
  // times), then docks the expanded panel into the right half.
  function dockMessages() {
    let panel = null;
    let pill = null;
    document.querySelectorAll('span, div').forEach((leaf) => {
      if (!isLeaf(leaf) || leaf.textContent.trim() !== 'Messages') return;
      const box = outerFixed(leaf);
      // Skip the nav rail (its expanded labels include "Messages") and page-wide wrappers.
      if (!box || hasMain(box) || box.querySelector(NAV_LINKS.join(','))) return;
      if (box.hasAttribute('data-igsv')) { panel = panel || box; return; }
      if (box.getBoundingClientRect().height >= MIN_PANEL_H) panel = panel || box;
      else pill = pill || { box, leaf };
    });

    if (panel) {
      if (!panel.hasAttribute('data-igsv')) { panel.setAttribute('data-igsv', 'dock'); log('docked panel', panel); }
      if (pill && pill.box !== panel) hide(pill.box);
      hideFallback();
      return;
    }

    if (pill && pillClicks < MAX_PILL_CLICKS) {
      showFallback(false);
      if (Date.now() - pillClickAt > PILL_RETRY_MS) {
        pillClicks++;
        pillClickAt = Date.now();
        log('opening Messages pill, attempt', pillClicks);
        clickTarget(pill.leaf).click();
        // Dock the panel as soon as it appears instead of waiting for the next sweep.
        [250, 700, 1500].forEach((ms) => setTimeout(() => { lastSweep = 0; schedule(); }, ms));
      }
    } else if (!pill && pillClicks === 0 && Date.now() - sweepStart < 8000) {
      showFallback(false); // pill not rendered yet; keep sweeping for a few seconds
    } else {
      log('Messages did not dock', { pill: !!pill, pillClicks });
      showFallback(true);
    }
  }

  // Chat windows Instagram opens next to the panel: dock them over it (close = back to list).
  function dockChats() {
    document.querySelectorAll('[role="textbox"], textarea, [contenteditable="true"]').forEach((inp) => {
      const box = outerFixed(inp);
      if (!box || box.hasAttribute('data-igsv') || hasMain(box)) return;
      box.setAttribute('data-igsv', 'chat');
      log('docked chat', box);
    });
  }

  /* ---------- Main strip pass ---------- */

  let railW = 0;
  let lastSweep = 0;
  let timer = 0;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => { timer = 0; stripUi(); }, 150);
  };

  function stripUi() {
    applyRoute();
    const r = route();
    if (r === 'flow') return;

    let rail = 0;
    const seen = new Set();
    const consider = (el) => {
      const box = outerFixed(el);
      if (!box || seen.has(box)) return;
      seen.add(box);
      rail = Math.max(rail, retire(box));
    };
    NAV_LINKS.forEach((sel) => document.querySelectorAll(sel).forEach(consider));
    document.querySelectorAll('svg[aria-label="Instagram"]').forEach(consider);

    if (rail !== railW) {
      railW = rail;
      root.style.setProperty('--igsv-rail', rail + 'px');
    }

    HIDE_LINKS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        hide(el.closest('[role="menu"], [role="listbox"]') || el);
      });
    });

    if (r !== 'home') { hideFallback(); return; }

    dockChats();

    const now = Date.now();
    if (now - lastSweep < 1000) {
      setTimeout(schedule, 1000 - (now - lastSweep) + 20); // trailing run
      return;
    }
    lastSweep = now;

    dockMessages();

    // Story tray and suggestions column.
    document.querySelectorAll('a[href^="/stories/"]').forEach((a) => {
      if (!a.closest('article')) hide(feedBranch(a));
    });
    SIDEBAR_LINKS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((a) => {
        if (!a.closest('article')) hide(feedBranch(a));
      });
    });

    // Text-matched clutter.
    document.querySelectorAll('span, div, h2, h3').forEach((el) => {
      if (!isLeaf(el) || el.closest('article')) return;
      if (CLUTTER_TEXT.includes(el.textContent.trim())) hide(feedBranch(el));
    });

    // Ads.
    document.querySelectorAll('article').forEach((art) => {
      if (art.style.display === 'none') return;
      const ad = Array.from(art.querySelectorAll('span')).some(
        (s) => isLeaf(s) && s.textContent.trim() === AD_TEXT
      );
      if (ad) hide(art);
    });
  }

  const start = () => {
    stripUi();
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
