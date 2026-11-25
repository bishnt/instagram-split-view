# Instagram Minimal

A Chrome / Brave / Edge extension (Manifest V3). **One tab:** your Home feed on the left,
your DMs on the right, nothing else.

No window tiling, no browser Split View, no toolbar button. Open `instagram.com` and
the page is the split view.

| Left | Right |
|------|-------|
| Home feed | Direct messages |

## What's removed

- Navigation rail / bottom bar (Explore, Reels, Search, Notifications, Create, Profile)
- Instagram and Meta logos, footers
- Story tray, "Suggested for you", the suggestions column
- Sponsored posts
- The floating Messages pill (DMs already live on the right)
- Scrollbars

Other pages (`/explore/`, `/reels/`, `/p/...`, profiles) redirect back to Home, both at
the network level (`rules.json`) and inside each pane.

## Layout

- Drag the divider to resize; double-click it (or press **Home** while it's focused) to
  reset to 50/50. Arrow keys nudge it. Your choice is remembered.
- Colours follow your system light / dark setting.
- Logged out, you get a single full-width login pane; the DMs pane loads once you're in.

## Install (developer mode)

1. Clone or download this repo.
2. Open `chrome://extensions` (or `brave://extensions` / `edge://extensions`).
3. Turn on **Developer mode** and click **Load unpacked**; select this folder.
4. Open <https://www.instagram.com/>.

## How it works

- `rules.json` redirects every top-level page except `/` and the login paths to `/`,
  swaps Instagram's own scripts out of the top document (so only the shell runs), and
  removes `X-Frame-Options` / CSP from Instagram's frames so the two panes can load.
- `content.js` in the top document builds the shell: two same-origin frames and a divider.
  Inside each frame it strips the UI listed above and blocks links to other sections.
- Instagram's desktop layout reserves space on the left for its nav rail. The pane
  measures the rail, hides it, and tells the shell to shift the frame left by that width so
  no empty gutter remains.

## Customising

At the top of `content.js`, under **Things to remove**: `NAV_LINKS`, `SIDEBAR_LINKS`,
`HIDE_LINKS`, `CLUTTER_TEXT`, `AD_TEXT`. Add to them when Instagram changes its markup.
Text matches (`Suggested for you`, `Sponsored`) are English.

## Known limitations

- Instagram's markup uses obfuscated class names and changes often, so selectors are based
  on links, labels and layout rather than classes. Expect to tweak them now and then.
- If Instagram refuses to render inside a frame, the extension retries with `<object>` and
  then shows a short message in the pane.
- Links to posts/reels shared inside DMs are blocked.
- Unofficial tool, not affiliated with Instagram/Meta.
