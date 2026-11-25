/*
 * Instagram Split View
 * --------------------
 * Top frame  -> replaced by a 50/50 shell holding two same-origin iframes:
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

  const HOME_URL = '/';
  const DM_URL = '/direct/inbox/';
  const HOME_PANE = 'ig-split-home';
  const DM_PANE = 'ig-split-dm';

  // ---------- Config you can tweak ----------
  // Links that identify the main navigation (we hide the fixed bar containing them).
  const NAV_LINK_SELECTORS = [
    'a[href="/explore/"]',
    'a[href="/reels/"]',
    'a[href^="/explore/search"]',
  ];
  // Extra elements to remove (best effort; Instagram class names are obfuscated).
  const HIDE_SELECTORS = [
    'a[href^="/stories/"]',            // story tray items
    'a[href="/explore/people/"]',      // "See all" suggestions
    'a[href^="/accounts/activity"]',
  ];
  // Paths always allowed (login / checkpoint flows).
  const ALWAYS_ALLOWED = ['/accounts/', '/challenge/', '/auth_platform/'];
  // ------------------------------------------

  const isTop = window.top === window.self;

  if (isTop) {
    const path = location.pathname;
    if (path === '/') {
      buildShell();
    } else if (!ALWAYS_ALLOWED.some((p) => path.startsWith(p))) {
      // Fallback for the network-level rules (rules.json): any other route
      // typed or followed in the top frame goes back to the split view.
      try { window.stop(); } catch (_) {}
      location.replace(HOME_URL);
    }
    // else: login / checkpoint pages render normally, full width.
  } else if (window.name === HOME_PANE || window.name === DM_PANE) {
    initPane(window.name);
  }

  /* ===================== Top-level shell ===================== */

  function buildShell() {
    try { window.stop(); } catch (_) {}

    const root = document.documentElement;
    while (root.firstChild) root.removeChild(root.firstChild);

    const head = document.createElement('head');
    const title = document.createElement('title');
    title.textContent = 'Instagram';
    head.appendChild(title);

    const body = document.createElement('body');
    Object.assign(body.style, {
      margin: '0',
      height: '100vh',
      width: '100vw',
      display: 'flex',
      background: '#000',
      overflow: 'hidden',
    });
    root.append(head, body);

    const makeFrame = (name, src) => {
      const f = document.createElement('iframe');
      f.name = name;
      f.src = src;
      f.allow = 'clipboard-write; autoplay; fullscreen; microphone; camera';
      Object.assign(f.style, {
        flex: '1 1 50%',
        width: '50%',
        height: '100%',
        border: '0',
        margin: '0',
        background: '#000',
      });
      return f;
    };

    const home = makeFrame(HOME_PANE, HOME_URL);
    const dm = makeFrame(DM_PANE, DM_URL);

    const divider = document.createElement('div');
    Object.assign(divider.style, {
      flex: '0 0 1px',
      background: 'rgba(128,128,128,0.35)',
    });

    body.append(home, divider, dm);

    // After logging in on one pane, bring the other pane out of the login page.
    setInterval(() => {
      try {
        const hp = home.contentWindow.location.pathname;
        const dp = dm.contentWindow.location.pathname;
        const hLogin = hp.startsWith('/accounts/');
        const dLogin = dp.startsWith('/accounts/');
        if (dLogin && !hLogin) dm.src = DM_URL;
        if (hLogin && !dLogin) home.src = HOME_URL;
      } catch (_) { /* frame mid-navigation */ }
    }, 1500);
  }

  /* ===================== Pane logic ===================== */

  function initPane(paneName) {
    const isHome = paneName === HOME_PANE;
    const homePath = isHome ? HOME_URL : DM_URL;

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
        if (url.origin !== location.origin) return; // external links behave normally
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

    // 3) Strip navigation + unwanted widgets, keep doing so as the SPA re-renders.
    let scheduled = false;
    const run = () => {
      scheduled = false;
      stripUi();
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(run);
    };
    const start = () => {
      stripUi();
      new MutationObserver(schedule).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
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
    // Main nav: climb from a nav link to its fixed-position container and hide it.
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
        // Hide the story tray as a whole, not just a single item.
        const menu = el.closest('[role="menu"], [role="listbox"]');
        hide(menu || el);
      });
    });
  }
})();
