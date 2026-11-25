/*
 * Instagram Split View - content script (top frames of www.instagram.com)
 *
 * Each window has a role:
 *   home -> only the Home feed ("/")           is reachable
 *   dm   -> only Direct messages ("/direct/")  is reachable
 * Navigation (Explore, Reels, Search, Profile, ...) is hidden, links to other
 * sections are blocked, and stray route changes are bounced back.
 *
 * Instagram's DOM changes often. If something reappears, add a selector to
 * HIDE_SELECTORS below.
 */
(() => {
  'use strict';
  if (window.top !== window.self) return;

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
  // ------------------------------------------

  const startsWithAny = (path, list) => list.some((p) => path.startsWith(p));
  const pathRole = () => (location.pathname.startsWith('/direct/') ? 'dm' : 'home');

  // Initial guess from the path (null on login pages); refined by the background script.
  let role = startsWithAny(location.pathname, ALWAYS_ALLOWED) ? null : pathRole();

  const isAllowed = (path) => {
    if (startsWithAny(path, ALWAYS_ALLOWED)) return true;
    if (!role) return true;
    return role === 'home' ? path === '/' : path.startsWith('/direct/');
  };
  const rolePath = () => (role === 'dm' ? DM_URL : HOME_URL);

  // Ask the background script which window we are in (opened by the toolbar button).
  (async () => {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await chrome.runtime.sendMessage({ type: 'igsv-role' });
        if (r) { role = r; return; }
      } catch (_) { /* extension reloaded or worker waking up */ }
      await new Promise((res) => setTimeout(res, 400));
    }
  })();

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

  // 2) Catch route changes that slipped through (SPA pushState, modals, etc.).
  setInterval(() => {
    if (!isAllowed(location.pathname)) location.replace(rolePath());
  }, 400);

  // 3) After logging in, leave the login page (the login cookie is shared by both windows).
  setInterval(() => {
    if (location.pathname.startsWith('/accounts/login') && /(?:^|;\s*)ds_user_id=/.test(document.cookie)) {
      location.replace(role ? rolePath() : HOME_URL);
    }
  }, 1500);

  // 4) Strip navigation + unwanted widgets as the SPA re-renders.
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

  function hide(el) {
    if (el && el.style && el.style.display !== 'none') {
      el.style.setProperty('display', 'none', 'important');
    }
  }

  function fixedAncestor(el) {
    let p = el;
    while (p && p !== document.body && p !== document.documentElement) {
      const pos = getComputedStyle(p).position;
      if (pos === 'fixed' || pos === 'sticky') return p;
      p = p.parentElement;
    }
    return null;
  }

  let lastPillCheck = 0;
  function stripUi() {
    // Main nav: climb from a nav link to its fixed-position container and hide it.
    NAV_LINK_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((a) => hide(fixedAncestor(a) || a));
    });

    HIDE_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        const menu = el.closest('[role="menu"], [role="listbox"]');
        hide(menu || el);
      });
    });

    // The floating "Messages" pill: DMs live in their own window.
    if (role === 'home') {
      const now = Date.now();
      if (now - lastPillCheck > 1000) {
        lastPillCheck = now;
        document.querySelectorAll('span, div').forEach((el) => {
          if (el.children.length === 0 && el.textContent.trim() === 'Messages') {
            const fx = fixedAncestor(el);
            if (fx) hide(fx);
          }
        });
      }
    }
  }
})();
