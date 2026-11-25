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
  // Backgrounds: Instagram's dark-theme surfaces (feed #0c1014, inbox/chat #212328) become this.
  const BG = '#000';
  const SURFACES = new Set(['rgb(12, 16, 20)', 'rgb(33, 35, 40)']);
  // Anything that marks the story tray.
  const STORY_SELECTORS = ['a[href^="/stories/"]', '[aria-label^="Story by"]', '[aria-label*="story" i][role="button"]'];
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
    html.igsv-dm body { margin-left: calc(var(--igsv-rail, 0px) * -1) !important; }
    /* --igsv-shift nudges the feed so the post is centred in the left half (width stays constant) */
    html.igsv-home body {
      margin-left: calc(var(--igsv-rail, 0px) * -1 + var(--igsv-shift, 0px)) !important;
      margin-right: calc(50vw - var(--igsv-shift, 0px)) !important;
    }
    html.igsv-home, html.igsv-home body { background: #000 !important; }

    /* left half: no scrolling; posts are stepped with the arrow buttons / keys */
    html.igsv-home { overflow-y: hidden !important; }
    [data-igsv] { overscroll-behavior: contain !important; }
    .igsv-nav button {
      position: fixed; top: calc(50vh - 22px); z-index: 2147482000; width: 44px; height: 44px; padding: 0;
      border: 0; border-radius: 50%; cursor: pointer; font: 400 28px/1 system-ui, sans-serif;
      color: inherit; background: rgba(128,128,128,.28); backdrop-filter: blur(8px);
    }
    .igsv-nav button:hover { background: rgba(128,128,128,.45); }
    .igsv-nav .igsv-prev { left: 10px; }
    .igsv-nav .igsv-next { right: calc(50vw + 10px); }

    /* right half: a quiet surface behind the docked Messages panel */
    html.igsv-home::before {
      content: ""; position: fixed; top: 0; right: 0; bottom: 0; left: 50vw; pointer-events: none;
      border-left: 1px solid rgba(128,128,128,.22);
    }

    /* Messages panel and chat windows, docked to the right half */
    [data-igsv] {
      position: fixed !important; inset: 0 0 0 50vw !important;
      width: 50vw !important; height: 100vh !important;
      min-width: 0 !important; min-height: 0 !important; max-width: none !important; max-height: none !important;
      margin: 0 !important; transform: none !important; border-radius: 0 !important; box-shadow: none !important;
    }
    [data-igsv] > * { max-height: none !important; }
    /* an open chat covers the whole right half (‹ goes back to the list); other open chats stay hidden */
    [data-igsv="chat"] { z-index: 2147483000 !important; visibility: visible !important; }
    html.igsv-chat [data-igsv="dock"] { visibility: hidden !important; } /* nothing of the list shows through */
    [data-igsv="chat-bg"] { visibility: hidden !important; pointer-events: none !important; }

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
  let navEl = null; // carousel buttons
  let cur = null; // current post
  let loading = false;
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
    ensureNav(r === 'home');
  }
  applyRoute();

  /* ---------- Carousel: one post at a time, no scrolling ---------- */

  const postList = () =>
    Array.from(document.querySelectorAll('article')).filter(
      (a) => a.style.display !== 'none' && a.offsetHeight > 0 && !a.closest('[role="dialog"]')
    );
  function nearest(list) {
    const mid = innerHeight / 2;
    let best = null;
    let bd = Infinity;
    list.forEach((a) => {
      const r = a.getBoundingClientRect();
      const d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bd) { bd = d; best = a; }
    });
    return best;
  }
  // Centre a post in the left half, shrinking it (scaled about its centre) if it is taller
  // than the window.
  let shift = 0;
  function centerFeed() {
    const a = cur && cur.isConnected ? cur : postList()[0];
    if (!a) return;
    const r = a.getBoundingClientRect();
    if (!r.width) return;
    const delta = innerWidth / 4 - (r.left + r.width / 2);
    if (Math.abs(delta) < 2) return;
    shift += delta;
    root.style.setProperty('--igsv-shift', Math.round(shift) + 'px');
  }
  addEventListener('resize', () => {
    shift = 0;
    root.style.removeProperty('--igsv-shift');
    setTimeout(centerFeed, 150);
  });
  function show(art) {
    document.querySelectorAll('article[data-igsv-fit]').forEach((a) => {
      a.style.removeProperty('transform');
      a.style.removeProperty('transform-origin');
      a.removeAttribute('data-igsv-fit');
    });
    const h = art.offsetHeight;
    const z = Math.min(1, (innerHeight - 24) / (h || 1));
    if (z < 1) {
      art.style.setProperty('transform-origin', '50% 50%', 'important');
      art.style.setProperty('transform', 'scale(' + z.toFixed(3) + ')', 'important');
      art.setAttribute('data-igsv-fit', '1');
    }
    cur = art;
    art.scrollIntoView({ block: 'center', behavior: 'instant' });
    centerFeed();
  }
  // Past the last loaded post: scroll to the end so Instagram fetches more, then step on.
  function loadMore(last) {
    if (loading) return;
    loading = true;
    let tries = 0;
    const kick = () => {
      const se = document.scrollingElement;
      if (se) se.scrollTop = se.scrollHeight;
      last.scrollIntoView({ block: 'end', behavior: 'instant' });
    };
    kick();
    const poll = () => {
      const l = postList();
      const i = l.indexOf(last);
      if (i >= 0 && l[i + 1]) { loading = false; show(l[i + 1]); return; }
      if (++tries > 8) { loading = false; show(last); return; }
      if (tries % 3 === 0) kick();
      setTimeout(poll, 500);
    };
    setTimeout(poll, 500);
  }
  function step(dir) {
    const list = postList();
    if (!list.length) return;
    const i = cur && list.includes(cur) ? list.indexOf(cur) : list.indexOf(nearest(list));
    const j = i + dir;
    if (j < 0) return;
    if (j >= list.length) loadMore(list[list.length - 1]);
    else show(list[j]);
  }

  function ensureNav(on) {
    if (on && !navEl && document.body) {
      navEl = document.createElement('div');
      navEl.className = 'igsv-nav';
      [['igsv-prev', '‹', 'Previous post', -1], ['igsv-next', '›', 'Next post', 1]].forEach(([c, t, l, d]) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = c; b.textContent = t; b.setAttribute('aria-label', l);
        b.addEventListener('click', () => step(d));
        navEl.appendChild(b);
      });
      document.body.appendChild(navEl);
    } else if (!on && navEl) {
      navEl.remove();
      navEl = null;
    }
  }

  // Scrolling is locked on Home (wheel, touch, keys); the docked Messages panel and dialogs still scroll.
  const typing = (t) =>
    !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || (t.closest && t.closest('[role="textbox"]')));
  const inDock = (t) => !!(t && t.closest && t.closest('[data-igsv], [role="dialog"]'));
  const lock = (e) => {
    if (route() !== 'home' || e.ctrlKey || inDock(e.target)) return;
    e.preventDefault();
  };
  window.addEventListener('wheel', lock, { passive: false, capture: true });
  window.addEventListener('touchmove', lock, { passive: false, capture: true });
  window.addEventListener(
    'keydown',
    (e) => {
      if (route() !== 'home' || e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || inDock(e.target)) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if ([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
    },
    true
  );

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
  const MSG_SVG = 'svg[aria-label="Messages"], svg[aria-label="New message"]';
  const inNavLink = (el) => !!el.closest('a[href^="/direct/"]');
  // True if a fixed wrapper also holds the floating Messages widget (not just the nav link).
  const hasMessagesWidget = (box) => Array.from(box.querySelectorAll(MSG_SVG)).some((n) => !inNavLink(n));

  function retire(box) {
    if (!box || hasMain(box)) return 0;
    if (hasMessagesWidget(box)) { log('kept wrapper that holds Messages widget', box); return 0; }
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

  // Anything sitting above the first post in the feed column (the story tray and its
  // arrows) is removed, whatever it is built from.
  function hideAboveFeed() {
    const first = document.querySelector('article');
    if (!first) return;
    let n = first;
    for (let i = 0; i < 8 && n && n.parentElement; i++) {
      if (n.tagName === 'MAIN' || n.getAttribute('role') === 'main') break;
      for (let sib = n.previousElementSibling; sib; sib = sib.previousElementSibling) {
        if (sib.querySelector('article') || sib.hasAttribute('data-igsv')) continue;
        const r = sib.getBoundingClientRect();
        if (r.height > 0 && r.height < 260) hide(sib);
      }
      n = n.parentElement;
    }
  }
  const inDockOrDialog = (el) => !!el.closest('[data-igsv], [role="dialog"]');

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

  // One-time console report (always visible, filter for igsv): where the Messages
  // elements are and what hides them (this extension's inline style vs Instagram).
  let diagnosed = false;
  function diagnose() {
    if (diagnosed) return;
    diagnosed = true;
    const rows = Array.from(document.querySelectorAll(MSG_SVG + ', a[href^="/direct/"]')).map((el) => {
      let hiddenBy = 'visible';
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden') {
          const ours = n.style.display === 'none' || n.style.visibility === 'hidden';
          hiddenBy = (ours ? 'EXTENSION' : 'instagram') + ' <' + n.tagName.toLowerCase() + '>';
          break;
        }
      }
      const r = el.getBoundingClientRect();
      return { el: el.tagName + ' ' + (el.getAttribute('aria-label') || el.getAttribute('href') || ''), hiddenBy, rect: Math.round(r.width) + 'x' + Math.round(r.height) + '@' + Math.round(r.left) + ',' + Math.round(r.top) };
    });
    console.log('[igsv] diagnose', JSON.stringify(rows, null, 1));
  }

  // Finds Instagram's floating Messages pill / panel. Opens the pill (retrying a few
  // times), then docks the expanded panel into the right half.
  function dockMessages() {
    // Instagram's widget flips between the list and an open chat (‹ goes back) inside one
    // container, and the "Messages" label is absent in chat view. Once it is docked, keep it.
    if (document.querySelector('[data-igsv="dock"]')) { hideFallback(); return; }
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
    // Instagram may label the widget only through an <svg aria-label>, with no text element.
    document.querySelectorAll(MSG_SVG).forEach((icon) => {
      if (inNavLink(icon)) return;
      const box = outerFixed(icon);
      if (!box || hasMain(box)) return;
      if (box.hasAttribute('data-igsv')) { panel = panel || box; return; }
      const h = box.getBoundingClientRect().height;
      if (!h) return; // hidden
      if (h >= MIN_PANEL_H) panel = panel || box;
      else pill = pill || { box, leaf: icon };
    });

    if (panel) {
      if (!panel.hasAttribute('data-igsv')) { panel.setAttribute('data-igsv', 'dock'); log('docked panel', panel); paintTree(panel); }
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
      diagnose();
      showFallback(true);
    }
  }

  // Chat windows Instagram opens next to the panel: docked beside the conversation list.
  // Only the active chat is shown; opening or focusing another conversation switches to it.
  let activeChat = null;
  let chatSeq = 0;
  const hasInput = (box) => !!box.querySelector('[role="textbox"], textarea, [contenteditable="true"]');

  function dockChats() {
    // Chats that lost their input (minimised or closed) go back to Instagram's own layout.
    document.querySelectorAll('[data-igsv^="chat"]').forEach((box) => {
      if (!box.isConnected || hasInput(box)) return;
      box.removeAttribute('data-igsv');
      if (box === activeChat) activeChat = null;
    });
    document.querySelectorAll('[role="textbox"], textarea, [contenteditable="true"]').forEach((inp) => {
      const box = outerFixed(inp);
      if (!box || hasMain(box)) return;
      const kind = box.getAttribute('data-igsv');
      if (kind) return; // the widget itself or an already-docked chat window
      if (!document.querySelector('[data-igsv="dock"]')) {
        // Chat view of the single Messages widget: this container is the dock.
        box.setAttribute('data-igsv', 'dock');
        paintTree(box);
        hideFallback();
        log('docked widget (chat view)', box);
        return;
      }
      // A separate chat window next to an already-docked list.
      box.setAttribute('data-igsv', 'chat-bg');
      paintTree(box);
      box.setAttribute('data-igsv-seq', String(++chatSeq));
      activeChat = box; // the newest window is the one just opened
      log('docked chat', box);
    });
    if (activeChat && !activeChat.isConnected) activeChat = null;
    document.querySelectorAll('[data-igsv^="chat"]').forEach((box) => {
      const want = box === activeChat ? 'chat' : 'chat-bg';
      if (box.getAttribute('data-igsv') !== want) box.setAttribute('data-igsv', want);
    });
    root.classList.toggle('igsv-chat', !!activeChat);
  }

  // Focusing another chat's input (Instagram does this when a conversation is opened or
  // restored) makes it the visible one.
  document.addEventListener(
    'focusin',
    (e) => {
      const box = e.target && e.target.closest && e.target.closest('[data-igsv^="chat"]');
      if (box && box !== activeChat) { activeChat = box; dockChats(); }
    },
    true
  );
  // Clicking a row in the list for a conversation that is already open: show that chat.
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target;
      if (!t || !t.closest || !t.closest('[data-igsv="dock"]')) return;
      const row = t.closest('[role="button"], [role="listitem"], a, [tabindex]');
      const name = row && (row.innerText || '').split('\n').map((x) => x.trim()).find(Boolean);
      if (!name) return;
      setTimeout(() => {
        const text = (c) => c.textContent || '';
        if (activeChat && activeChat.isConnected && text(activeChat).includes(name)) return;
        const hit = Array.from(document.querySelectorAll('[data-igsv^="chat"]')).find((c) => text(c).includes(name));
        if (hit && hit !== activeChat) { activeChat = hit; dockChats(); }
      }, 300);
    },
    true
  );

  /* ---------- Backgrounds ---------- */

  // Instagram paints its surfaces through its own variables; recolour whatever resolves to
  // them (exact match only, so message bubbles and media keep their colours).
  function paint(n) {
    if (SURFACES.has(getComputedStyle(n).backgroundColor)) n.style.setProperty('background-color', BG, 'important');
  }
  function paintTree(el) {
    if (!el || el.nodeType !== 1) return;
    paint(el);
    el.querySelectorAll('*').forEach(paint);
  }
  // Containers around the feed.
  function paintAncestors(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) paint(n);
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

    // Story tray (removed completely) and suggestions column.
    STORY_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((a) => {
        if (!a.closest('article') && !inDockOrDialog(a)) hide(feedBranch(a) || a);
      });
    });
    hideAboveFeed();
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

    const firstArt = document.querySelector('article');
    if (firstArt) paintAncestors(firstArt);
    centerFeed();

    // Carousel: make sure a post is centred and fitted.
    if (!cur || !cur.isConnected || cur.style.display === 'none') {
      const l = postList();
      if (l.length) show(nearest(l));
    }
  }

  // Dock chat windows (and re-dock a re-rendered panel) before the next paint, so switching
  // conversations never flashes Instagram's own floating layout.
  let rafPending = false;
  const toPaint = new Set();
  let hadDock = false;
  const fast = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      if (route() !== 'home') return;
      dockChats();
      toPaint.forEach((n) => { if (n.isConnected) paintTree(n); });
      toPaint.clear();
      const dock = document.querySelector('[data-igsv="dock"]');
      if (dock) hadDock = true;
      else if (hadDock) { hadDock = false; lastSweep = 0; stripUi(); }
    });
  };
  const start = () => {
    stripUi();
    new MutationObserver((records) => {
      for (const rec of records) {
        rec.addedNodes.forEach((n) => {
          if (n.nodeType === 1 && (n.hasAttribute('data-igsv') || (n.closest && n.closest('[data-igsv]')))) toPaint.add(n);
        });
      }
      fast();
      schedule();
    }).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
