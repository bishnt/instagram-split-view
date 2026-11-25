# Instagram Split View

A Chrome/Edge extension (Manifest V3) that turns instagram.com into a focused
two-pane layout inside a single tab:

| Left half | Right half |
|-----------|------------|
| Home feed | Direct messages (DMs) |

Everything else (Explore, Reels, Search, Notifications, Profile, Create, story
tray, suggestions, etc.) is hidden, and navigation to those pages is blocked.

## Install (developer mode)

1. Clone or download this repo.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select this folder.
5. Open https://www.instagram.com/ — you'll get Home on the left, DMs on the right.

Log in as usual; both panes share your session.

## How it works

Instagram refuses to be embedded by other sites, so the extension runs *on*
instagram.com. In the top frame it replaces the page with a 50/50 shell holding
two same-origin iframes (`/` and `/direct/inbox/`). A content script inside each
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
- This is an unofficial tool, not affiliated with Instagram/Meta.
