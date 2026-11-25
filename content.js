/*
 * Instagram Minimal
 * -----------------
 * One tab. The top document is replaced by a quiet two-pane shell:
 *
 *     Home feed  |  Direct messages
 *
 * Each pane is a same-origin frame of instagram.com. Inside a pane, the
 * navigation, logos, story tray, suggestions, ads and footers are removed, and
 * anything other than the pane's own page is blocked.
 *
 * Instagram's markup changes often. If something reappears, add it to the
 * lists in the "Things to remove" section below.
 */
(() => {
  'use strict';

  const HOME_URL = '/';
  const DM_URL = '/direct/inbox/';
  const FLOW_PATHS = ['/accounts/', '/challenge/', '/auth_platform/']; // login / checkpoint
  const EMBED_METHODS = ['iframe', 'object'];                          // tried in order
  const SPLIT_KEY = 'igsv.split';

  // ---------------- Things to remove ----------------
  // Links that identify the main navigation (the fixed bar around them is retired).
  const NAV_LINKS = ['a[href="/explore/"]', 'a[href="/reels/"]', 'a[href^="/explore/search"]'];
  // Anchors that identify the right-hand suggestions column on Home.
  const SIDEBAR_LINKS = ['a[href="/explore/people/"]'];
  // Individual links to hide (menus containing them are hidden whole).
  const HIDE_LINKS = ['a[href^="/accounts/activity"]'];
  const HIDE_LINKS_HOME = ['a[href^="/direct/"]'];
  // Visible text that marks clutter on Home (exact match on a single element).
  const CLUTTER_TEXT = ['Suggested for you'];
  const AD_TEXT = 'Sponsored';
  // --------------------------------------------------

  const inFlow = (p) => FLOW_PATHS.some((x) => p.startsWith(x));
  const onReady = (fn) =>
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', fn, { once: true })
      : fn();

  /* ======================================================================
   * Shell (top document)
   * ==================================================================== */

  const SHELL_CSS = `
    :root {
      color-scheme: light dark;
      --shell: #ececea; --pane: #ffffff;
      --edge: rgba(0,0,0,.09); --grip: rgba(0,0,0,.3);
      --text: #555; --gap: 10px; --radius: 14px; --grip-w: 12px; --split: 50;
    }
    @media (prefers-color-scheme: dark) {
      :root { --shell: #171717; --pane: #000000; --edge: rgba(255,255,255,.1); --grip: rgba(255,255,255,.38); --text: #aaa; }
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; overflow: hidden; background: var(--shell); }
    body { display: flex; padding: var(--gap); font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }

    .pane {
      position: relative; min-width: 0; overflow: hidden; isolation: isolate;
      border-radius: var(--radius); background: var(--pane); box-shadow: 0 0 0 1px var(--edge);
    }
    .pane.home { flex: 0 0 calc((100% - var(--grip-w)) * var(--split) / 100); }
    .pane.dm   { flex: 1 1 0; }
    /* The frame is shifted left by the width of Instagram's (hidden) nav rail,
       so the rail sits outside the pane and no blank gutter is left behind. */
    .pane iframe, .pane object {
      position: absolute; top: 0; height: 100%; border: 0; margin: 0; display: block;
      left: calc(var(--rail, 0px) * -1); width: calc(100% + var(--rail, 0px));
    }
    .note { max-width: 320px; margin: 24vh auto 0; padding: 0 24px; text-align: center; color: var(--text); }

    .grip { flex: 0 0 var(--grip-w); position: relative; cursor: col-resize; touch-action: none; outline: none; }
    .grip::after {
      content: ""; position: absolute; left: 50%; top: 50%; width: 4px; height: 40px;
      margin: -20px 0 0 -2px; border-radius: 2px; background: var(--grip); opacity: 0;
    }
    @media (prefers-reduced-motion: no-preference) { .grip::after { transition: opacity .15s; } }
    .grip:hover::after, .grip:focus-visible::after, body.drag .grip::after { opacity: 1; }
    body.drag { cursor: col-resize; user-select: none; }
    body.drag iframe, body.drag object { pointer-events: none; }

    /* Logged out: show one pane at full width until the session exists. */
    body.solo .dm, body.solo .grip { display: none; }
    body.solo .home { flex: 1 1 auto; }
  `;

  const FAVICON =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<rect width="32" height="32" rx="8" fill="#111"/>' +
        '<rect x="6" y="8" width="9" height="16" rx="2" fill="#fff"/>' +
        '<rect x="17" y="8" width="9" height="16" rx="2" fill="#fff" fill-opacity=".5"/>' +
        '</svg>'
    );

  function buildShell() {
    const root = document.documentElement;
    while (root.firstChild) root.removeChild(root.firstChild);
    root.removeAttribute('class');
    root.removeAttribute('style');

    const head = document.createElement('head');
    const title = document.createElement('title');
    title.textContent = 'Instagram';
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.href = FAVICON;
    const style = document.createElement('style');
    style.textContent = SHELL_CSS;
    head.append(title, icon, style);

    const body = document.createElement('body');
    root.append(head, body);

    const mkSlot = (cls) => {
      const s = document.createElement('div');
      s.className = 'pane ' + cls;
      return s;
    };
    const homeSlot = mkSlot('home');
    const dmSlot = mkSlot('dm');

    const grip = document.createElement('div');
    grip.className = 'grip';
    grip.tabIndex = 0;
    grip.setAttribute('role', 'separator');
    grip.setAttribute('aria-orientation', 'vertical');
    grip.setAttribute('aria-label', 'Resize panes');

    body.append(homeSlot, grip, dmSlot);

    const home = mountPane(homeSlot, 'home', HOME_URL);
    const dm = mountPane(dmSlot, 'dm', DM_URL);

    /* ---- Resizable divider (double-click or Home key resets to 50/50) ---- */
    let split = 50;
    try {
      const saved = parseFloat(localStorage.getItem(SPLIT_KEY));
      if (saved >= 25 && saved <= 75) split = saved;
    } catch (_) {}
    const setSplit = (v, persist) => {
      split = Math.min(75, Math.max(25, v));
      body.style.setProperty('--split', String(split));
      if (persist) { try { localStorage.setItem(SPLIT_KEY, String(split)); } catch (_) {} }
    };
    setSplit(split, false);

    const gapPx = () => parseFloat(getComputedStyle(body).paddingLeft) || 0;
    grip.addEventListener('pointerdown', (e) => {
      grip.setPointerCapture(e.pointerId);
      body.classList.add('drag');
    });
    grip.addEventListener('pointermove', (e) => {
      if (!body.classList.contains('drag')) return;
      const pad = gapPx();
      const gw = grip.getBoundingClientRect().width;
      const inner = body.clientWidth - pad * 2 - gw;
      setSplit(((e.clientX - pad - gw / 2) / inner) * 100, false);
    });
    const endDrag = () => {
      if (!body.classList.contains('drag')) return;
      body.classList.remove('drag');
      setSplit(split, true);
    };
    grip.addEventListener('pointerup', endDrag);
    grip.addEventListener('pointercancel', endDrag);
    grip.addEventListener('dblclick', () => setSplit(50, true));
    grip.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { setSplit(split - 2, true); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setSplit(split + 2, true); e.preventDefault(); }
      else if (e.key === 'Home') { setSplit(50, true); e.preventDefault(); }
    });

    /* ---- Panes report the width of Instagram's hidden nav rail ---- */
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (e.origin !== location.origin || !d || d.igsv !== 'rail') return;
      const from = (p) => p.el() && p.el().contentWindow === e.source;
      const slot = from(home) ? homeSlot : from(dm) ? dmSlot : null;
      if (!slot) return;
      const w = Math.min(320, Math.max(0, Number(d.w) || 0));
      slot.style.setProperty('--rail', w + 'px');
    });

    /* ---- Logged out: single pane. Once logged in, load DMs. ---- */
    let solo = false;
    setInterval(() => {
      let hp;
      try { hp = home.el().contentWindow.location.pathname; } catch (_) { return; }
      const flow = inFlow(hp);
      if (flow === solo) return;
      solo = flow;
      body.classList.toggle('solo', solo);
      if (!solo) dm.navigate(DM_URL);
    }, 800);
  }

  // Embeds `src` in `slot`. If Instagram renders its "page isn't available"
  // screen, retry with the next entry of EMBED_METHODS.
  function mountPane(slot, which, src) {
    let methodIdx = 0;
    let current = null;

    const fail = () => {
      slot.textContent = '';
      const d = document.createElement('div');
      d.className = 'note';
      d.textContent = 'Instagram wouldn’t load in this pane. Reload the tab to try again.';
      slot.appendChild(d);
    };

    const attempt = (url) => {
      slot.textContent = '';
      let node;
      if (EMBED_METHODS[methodIdx] === 'object') {
        node = document.createElement('object');
        node.type = 'text/html';
        node.data = url;
      } else {
        node = document.createElement('iframe');
        node.allow = 'clipboard-write; autoplay; fullscreen; microphone; camera';
        node.src = url;
      }
      node.setAttribute('data-ig-pane', which);
      current = node;
      node.addEventListener('load', () => setTimeout(() => check(node, url), 3000));
      slot.appendChild(node);
    };

    const check = (node, url) => {
      if (node !== current) return;
      let text = '';
      try { text = (node.contentDocument && node.contentDocument.body && node.contentDocument.body.innerText) || ''; } catch (_) {}
      if (/this page isn.?t available/i.test(text)) {
        if (methodIdx < EMBED_METHODS.length - 1) { methodIdx++; attempt(url); }
        else fail();
      }
    };

    attempt(src);
    return { el: () => current, navigate: attempt };
  }

  /* ======================================================================
   * Pane (inside each frame)
   * ==================================================================== */

  const PANE_CSS = `
    * { scrollbar-width: none !important; }
    *::-webkit-scrollbar { display: none !important; }
    svg[aria-label="Instagram"], img[alt="Instagram"],
    svg[aria-label="Meta"], img[alt="Meta"],
    a[href="/"]:has(> svg[aria-label="Instagram"]),
    a[href="/"]:has(> div > svg[aria-label="Instagram"]),
    footer { display: none !important; }
  `;

  function initPane(which) {
    const isHome = which === 'home';
    const homePath = isHome ? HOME_URL : DM_URL;
    const allowed = (path) => inFlow(path) || (isHome ? path === '/' : path.startsWith('/direct/'));

    const style = document.createElement('style');
    style.textContent = PANE_CSS;
    (document.head || document.documentElement).appendChild(style);

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
      if (!allowed(location.pathname)) location.replace(homePath);
    }, 400);

    // 3) After logging in, leave the login page.
    setInterval(() => {
      if (location.pathname.startsWith('/accounts/login') && /(?:^|;\s*)ds_user_id=/.test(document.cookie)) {
        location.replace(homePath);
      }
    }, 1500);

    // 4) Strip as the app re-renders (throttled; started at the end of this function).
    let timer = 0;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => { timer = 0; stripUi(); }, 150);
    };

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

    // Outermost fixed/sticky ancestor: the bar or rail an element lives in.
    const outerFixed = (el) => {
      let found = null;
      for (let p = el; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        const pos = getComputedStyle(p).position;
        if (pos === 'fixed' || pos === 'sticky') found = p;
      }
      return found;
    };

    // A tall bar pinned to the left edge is the nav rail (kept laid out, clipped by
    // the shell); anything else (bottom bar, top bar) is removed. Returns rail width.
    const retire = (box) => {
      if (!box || box.querySelector('main, article, [role="main"]')) return 0;
      const r = box.getBoundingClientRect();
      if (!r.width && !r.height) return 0;
      if (r.height > r.width && r.left <= 1) { quiet(box); return Math.round(r.right); }
      hide(box);
      return 0;
    };

    // The branch of the layout that sits beside the posts (story tray, suggestions
    // column), found as a sibling of the branch containing an <article>.
    const feedBranch = (el) => {
      for (let n = el; n && n.parentElement; n = n.parentElement) {
        if (n.parentElement.querySelector('article')) return n.querySelector('article') ? null : n;
      }
      return null;
    };

    let railW = 0;
    let lastSweep = 0;

    function stripUi() {
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
        try { parent.postMessage({ igsv: 'rail', pane: which, w: rail }, location.origin); } catch (_) {}
      }

      HIDE_LINKS.concat(isHome ? HIDE_LINKS_HOME : []).forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          hide(el.closest('[role="menu"], [role="listbox"]') || el);
        });
      });

      if (!isHome) return;

      const now = Date.now();
      if (now - lastSweep < 1000) {
        setTimeout(schedule, 1000 - (now - lastSweep) + 20); // trailing run
        return;
      }
      lastSweep = now;

      // Story tray and suggestions column.
      document.querySelectorAll('a[href^="/stories/"]').forEach((a) => {
        if (!a.closest('article')) hide(feedBranch(a));
      });
      SIDEBAR_LINKS.forEach((sel) => {
        document.querySelectorAll(sel).forEach((a) => {
          if (!a.closest('article')) hide(feedBranch(a));
        });
      });

      // Text-matched clutter, and the floating "Messages" pill.
      document.querySelectorAll('span, div, h2, h3').forEach((el) => {
        if (el.children.length) return;
        const t = el.textContent.trim();
        if (t === 'Messages') {
          const fx = outerFixed(el);
          if (fx) retire(fx);
        } else if (CLUTTER_TEXT.includes(t) && !el.closest('article')) {
          hide(feedBranch(el));
        }
      });

      // Ads.
      document.querySelectorAll('article').forEach((art) => {
        if (art.style.display === 'none') return;
        const ad = Array.from(art.querySelectorAll('span')).some(
          (s) => !s.children.length && s.textContent.trim() === AD_TEXT
        );
        if (ad) hide(art);
      });
    }

    onReady(() => {
      stripUi();
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  /* ======================================================================
   * Boot (kept last so every constant above is initialised)
   * ==================================================================== */

  if (window.top === window.self) {
    const p = location.pathname;
    if (p === '/') onReady(buildShell);
    else if (!inFlow(p)) location.replace(HOME_URL);
  } else {
    let which = null;
    try { which = window.frameElement && window.frameElement.getAttribute('data-ig-pane'); } catch (_) {}
    if (which) initPane(which);
  }
})();
