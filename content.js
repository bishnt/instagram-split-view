/*
 * Instagram Split View
 * --------------------
 * Top frame  -> replaced by a 50/50 shell holding two same-origin panes:
 *                 left  = Home feed   (instagram.com/)
 *                 right = Direct msgs (instagram.com/direct/inbox/)
 * Inside each pane -> the navigation (Explore, Reels, Search, Profile, ...) is
 *                 hidden and navigation to any page other than the pane's own
 *                 page is blocked.
 *
 * Instagram's DOM changes often. If something reappears, add a selector to
 * HIDE_SELECTORS below.
 */
(() => {
  'use strict';

  const LOG = (...a) => console.log('[IG Split View]', ...a);
  const HOME_URL = '/';
  const DM_URL = '/direct/inbox/';

  // ---------- Config you can tweak ----------
  const NAV_LINK_SELECTORS = [
    'a[href="/explore/"]',
    'a[href="/reels/"]',
    'a[href^="/explore/search"]',
  ];
  const HIDE_SELECTORS = [
    'a[href^="/stories/"]',            // story tray items
    'a[href="/explore/people/"]',      // "See all" suggestions
    'a[href^="/accounts/activity"]',
  ];
  // Paths always allowed (login / checkpoint flows).
  const ALWAYS_ALLOWED = ['/accounts/', '/challenge/', '/auth_platform/'];
  // How a pane is embedded, tried in order if Instagram shows its
  // "page isn't available" screen for the previous method.
  const EMBED_METHODS = ['iframe', 'object'];
  // ------------------------------------------

  const isTop = window.top === window.self;

  if (isTop) {
    const path = location.pathname;
    if (path === '/') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildShell, { once: true });
      } else {
        buildShell();
      }
    } else if (!ALWAYS_ALLOWED.some((p) => path.startsWith(p))) {
      location.replace(HOME_URL);
    }
  } else {
    let pane = null;
    try { pane = window.frameElement && window.frameElement.getAttribute('data-ig-pane'); } catch (_) {}
    if (pane) initPane(pane);
  }

  /* ===================== Top-level shell ===================== */

  function buildShell() {
    LOG('building shell');
    const root = document.documentElement;
    while (root.firstChild) root.removeChild(root.firstChild);
    root.style.background = '#000';

    const head = document.createElement('head');
    const title = document.createElement('title');
    title.textContent = 'Instagram';
    head.appendChild(title);

    const body = document.createElement('body');
    Object.assign(body.style, {
      margin: '0', height: '100vh', width: '100vw',
      display: 'flex', background: '#000', overflow: 'hidden',
    });
    root.append(head, body);

    const mkSlot = () => {
      const s = document.createElement('div');
      Object.assign(s.style, { flex: '1 1 50%', width: '50%', height: '100%', position: 'relative' });
      return s;
    };
    const divider = document.createElement('div');
    Object.assign(divider.style, { flex: '0 0 1px', background: 'rgba(128,128,128,0.35)' });

    const home = mountPane(mkSlot(), 'home', HOME_URL);
    const dm = mountPane(mkSlot(), 'dm', DM_URL);
    body.append(home.slot, divider, dm.slot);

    // After logging in on one pane, bring the other pane out of the login page.
    setInterval(() => {
      try {
        const hp = home.el().contentWindow.location.pathname;
        const dp = dm.el().contentWindow.location.pathname;
        const hLogin = hp.startsWith('/accounts/');
        const dLogin = dp.startsWith('/accounts/');
        if (dLogin && !hLogin) dm.navigate(DM_URL);
        if (hLogin && !dLogin) home.navigate(HOME_URL);
      } catch (_) { /* frame mid-navigation */ }
    }, 1500);
  }

  // Embeds `src` in `slot`. If Instagram renders its "page isn't available"
  // screen, retry with the next EMBED_METHODS entry.
  function mountPane(slot, pane, src) {
    let methodIdx = 0;
    let current = null;

    function show(msg) {
      slot.textContent = '';
      const d = document.createElement('div');
      Object.assign(d.style, {
        color: '#ccc', font: '14px/1.5 system-ui, sans-serif', padding: '24px',
        maxWidth: '420px', margin: '20vh auto 0', textAlign: 'center',
      });
      d.textContent = msg;
      slot.appendChild(d);
    }

    function attempt(url) {
      const method = EMBED_METHODS[methodIdx];
      slot.textContent = '';
      let el;
      if (method === 'object') {
        el = document.createElement('object');
        el.type = 'text/html';
        el.data = url;
      } else {
        el = document.createElement('iframe');
        el.allow = 'clipboard-write; autoplay; fullscreen; microphone; camera';
        el.src = url;
      }
      el.setAttribute('data-ig-pane', pane);
      Object.assign(el.style, {
        width: '100%', height: '100%', border: '0', margin: '0', background: '#000', display: 'block',
      });
      current = el;
      el.addEventListener('load', () => setTimeout(() => check(el, url, method), 3000));
      slot.appendChild(el);
      LOG(pane, 'loading via', method);
    }

    function check(el, url, method) {
      if (el !== current) return;
      let text = '';
      try { text = (el.contentDocument && el.contentDocument.body && el.contentDocument.body.innerText) || ''; } catch (_) {}
      if (/this page isn.?t available/i.test(text)) {
        LOG(pane, 'Instagram refused to render via', method);
        if (methodIdx < EMBED_METHODS.length - 1) {
          methodIdx++;
          attempt(url);
        } else {
          show('Instagram refuses to render inside this pane (tried: ' + EMBED_METHODS.join(', ') + ').');
        }
      }
    }

    attempt(src);
    return {
      slot,
      el: () => current,
      navigate: (url) => attempt(url),
    };
  }

  /* ===================== Pane logic ===================== */

  function initPane(pane) {
    const isHome = pane === 'home';
    const homePath = isHome ? HOME_URL : DM_URL;
    LOG('pane ready:', pane);

    const isAllowed = (path) => {
      if (ALWAYS_ALLOWED.some((p) => path.startsWith(p))) return true;
      return isHome ? path === '/' : path.startsWith('/direct/');
    };

    // 1) Block clicks on links leading anywhere else.
    document.addEventListener(
      'click',
      (e) => {
        const a = e.target && e.target.closest && e.target.closest('a[href]');
        if (!a) return;
        let url;
        try { url = new URL(a.getAttribute('href'), location.href); } catch (_) { return; }
        if (url.origin !== location.origin) return;
        if (!isAllowed(url.pathname)) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true
    );

    // 2) Catch any route change that slipped through (SPA pushState, modals, etc.).
    setInterval(() => {
      if (!isAllowed(location.pathname)) location.replace(homePath);
    }, 400);

    // 3) Strip navigation + unwanted widgets as the SPA re-renders.
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; stripUi(); });
    };
    const start = () => {
      stripUi();
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  }

  function hide(el) {
    if (el && el.style && el.style.display !== 'none') {
      el.style.setProperty('display', 'none', 'important');
    }
  }

  function stripUi() {
    NAV_LINK_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((a) => {
        let el = a;
        let container = null;
        while (el && el !== document.body && el !== document.documentElement) {
          const pos = getComputedStyle(el).position;
          if (pos === 'fixed' || pos === 'sticky') { container = el; break; }
          el = el.parentElement;
        }
        hide(container || a);
      });
    });

    HIDE_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        const menu = el.closest('[role="menu"], [role="listbox"]');
        hide(menu || el);
      });
    });
  }
})();
