# Instagram Split View

A Chrome / Brave / Edge extension (Manifest V3). **One click tiles two windows side by
side:**

| Left half | Right half |
|-----------|------------|
| Home feed | Direct messages (DMs) |

Everything else (Explore, Reels, Search, Notifications, Profile, Create, story tray,
suggestions, the floating Messages pill, ...) is hidden, and those pages are
**inaccessible by route too**: typing e.g. `instagram.com/explore/`, `/reels/`, `/p/...`
or a profile URL redirects straight back.

## Install (developer mode)

1. Clone or download this repo.
2. Open `chrome://extensions` (or `brave://extensions` / `edge://extensions`).
3. Turn on **Developer mode** and click **Load unpacked**; select this folder.
4. Click the extension's toolbar icon (or press **Alt+Shift+I**).
   Home opens on the left half of the screen and DMs on the right half.

Log in as usual; both windows share your session. Clicking the icon again re-tiles the
windows (or reopens one you closed).

## How it works

- `background.js` opens two popup windows sized to the left / right half of the screen's
  work area and remembers which is which.
- `content.js` runs in each window with a role (`home` or `dm`): it hides Instagram's nav,
  blocks links to other sections, and bounces any route change back to the window's page.
- `rules.json` (declarativeNetRequest) redirects any top-level navigation other than `/`,
  `/direct/` and the login paths (`/accounts/`, `/challenge/`, `/auth_platform/`) to `/`
  before the page loads.

## Customising

At the top of `content.js`:
- `HIDE_SELECTORS` - add selectors for anything Instagram shows that you want gone.
- `NAV_LINK_SELECTORS` - links used to find (and hide) the main navigation.
- `ALWAYS_ALLOWED` - paths that are always allowed (login / checkpoint flows).

Instagram changes its markup often and uses obfuscated class names, so some selectors may
need updating over time.

## Known limitations

- A small blank gutter can remain on the left of each window where the nav bar used to be.
- Links to posts/reels shared inside DMs are blocked.
- Some Linux window managers / Wayland compositors ignore requested window positions; if the
  windows don't land on the right halves, snap them with your OS tiling shortcuts.
- This is an unofficial tool, not affiliated with Instagram/Meta.
