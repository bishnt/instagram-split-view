# Instagram Split View

A Chrome / Brave / Edge extension (Manifest V3). **One click opens Instagram Home and
Instagram DMs side by side in one window**, using the browser's native **Split View**:

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

Log in as usual; both tabs share your session.

## Requirements

The Split View extension API (`chrome.tabs.createSplit`) shipped in **Chrome 155**.
Check your version at `chrome://version` (`brave://version`). If your browser doesn't have
the API yet, the extension still opens the two tabs next to each other and shows a
notification; use the browser's own split-view menu on those tabs, and the hiding /
route-blocking still applies to each.

## How it works

- `background.js` opens two adjacent tabs (Home, then DMs), remembers which is which and
  joins them with `chrome.tabs.createSplit`.
- `content.js` runs in each tab with a role (`home` or `dm`): it hides Instagram's nav,
  blocks links to other sections, and bounces any route change back to the tab's page.
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

- A small blank gutter can remain on the left of each pane where the nav bar used to be.
- Links to posts/reels shared inside DMs are blocked.
- This is an unofficial tool, not affiliated with Instagram/Meta.
