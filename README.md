# Instagram Split View

A Chrome/Edge extension (Manifest V3) that turns instagram.com into a focused
two-pane layout inside a single tab:

| Left half | Right half |
|-----------|------------|
| Home feed | Direct messages (DMs) |

Everything else (Explore, Reels, Search, Notifications, Profile, Create, story
tray, suggestions, etc.) is hidden, and those pages are **inaccessible by route
too**: typing e.g. `instagram.com/explore/`, `/reels/`, `/p/...` or a profile URL
redirects straight back to the split view.

## Install (developer mode)

1. Clone or download this repo.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select this folder.
5. Open https://www.instagram.com/ — you'll get Home on the left, DMs on the right.

Log in as usual; both panes share your session.

## How routes are blocked

1. **Network level** (`rules.json`, declarativeNetRequest): any top-level
   navigation on instagram.com other than `/` (and the login/checkpoint paths
   `/accounts/`, `/challenge/`, `/auth_platform/`) is redirected to `/` before the
   page loads. Inside the panes only `/` and `/direct/` can load.
2. **Content script** (`content.js`): blocks link clicks to other sections and
   catches in-app (pushState) route changes, sending each pane back to its own page.

## Troubleshooting

- **Blank page?** Open `chrome://extensions` / `brave://extensions`, click **Reload** on the
  extension, then hard-refresh Instagram (Ctrl+Shift+R). Check the extension's **Errors** button
  for rule/permission problems. If it still fails, open DevTools on the Instagram tab and look
  for `[IG Split View]` messages in the console.
- Brave: make sure the extension is allowed on `www.instagram.com` (Site access → On all sites / on click).

## How it works

Instagram refuses to be embedded by other sites, so the extension runs *on*
instagram.com. In the top frame it replaces the page with a 50/50 shell holding
two same-origin iframes (`/` and `/direct/inbox/`). A response-header rule gives the top-level page a CSP that disables Instagram's own scripts there, so the shell can be built cleanly. A content script inside each
pane hides Instagram's navigation and blocks links to other sections.

## Customising

All the tweakable bits are at the top of `content.js`:

- `HIDE_SELECTORS` — add selectors for anything Instagram shows that you want gone.
- `NAV_LINK_SELECTORS` — links used to find (and hide) the main navigation.
- `ALWAYS_ALLOWED` — paths that are always allowed (login/checkpoint flows).

Instagram changes its markup often and uses obfuscated class names, so some
selectors may need updating over time.

## Known limitations

- A small blank gutter can remain on the left of each pane where the hidden nav bar used to sit.
- Links to posts/reels shared inside DMs are blocked (no other section is reachable).
- Only `www.instagram.com` is covered; Instagram's own redirect from `instagram.com` goes through `www` first, so it ends up blocked too.
- This is an unofficial tool, not affiliated with Instagram/Meta.
