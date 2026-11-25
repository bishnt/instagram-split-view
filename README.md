# Instagram Minimal

A Chrome / Brave / Edge extension (Manifest V3). **One tab, split in two:** your Home feed
on the left, your Messages on the right. Everything else is removed.

No iframes, no second tab, no window tiling. Instagram refuses to be embedded in a frame,
so this reworks the real page instead:

- The page is narrowed to the left half of the window and shows your feed.
- Instagram's own floating **Messages** panel (the pill at the bottom right of the feed) is
  opened automatically and docked to the full height of the right half. Chat windows it
  opens are docked over it; close one to get back to the list.

## What's removed

- Navigation rail / bottom bar (Explore, Reels, Search, Notifications, Create, Profile)
- Instagram and Meta logos, footers
- Story tray, "Suggested for you", the suggestions column
- Sponsored posts
- Scrollbars

Other pages (`/explore/`, `/reels/`, `/p/...`, profiles) redirect back to Home.

## Install (developer mode)

1. Clone or download this repo.
2. Open `chrome://extensions` (or `brave://extensions` / `edge://extensions`).
3. Turn on **Developer mode** and click **Load unpacked**; select this folder.
4. Open <https://www.instagram.com/>.

## Customising

At the top of `content.js`, under **Things to remove**: `NAV_LINKS`, `SIDEBAR_LINKS`,
`HIDE_LINKS`, `CLUTTER_TEXT`, `AD_TEXT`. Text matches are English. Open the browser console
and filter for `igsv` to see what the script found (docked panel, docked chat, ...).

## Known limitations

- Instagram's markup uses obfuscated class names and changes often, so everything is matched
  by links, labels and layout. Expect to tweak things now and then.
- If Messages can't be docked (pill missing or not opening), the right half shows **Try again**
  and **Open full inbox** instead of staying blank.
- The docked panel relies on Instagram's Messages pill being on the feed. If Instagram opens
  the full-page inbox instead, you get that page full width with a **‹ Feed** button.
- Unofficial tool, not affiliated with Instagram/Meta.
