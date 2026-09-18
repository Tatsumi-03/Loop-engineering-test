# Issue #6 evidence: donut page linked back to the index

The index has pointed at the donut page since commit 16e1943, but the donut
page was a dead end: once you opened it the only way back was the browser's
back button. This change adds the return link, so the two pages form a loop.

Headless Chromium is blocked in the environment this change was made in, so
the proof below is text, the same way the issue #5 evidence is. Reproduce
the captures with:

```bash
chromium --headless --disable-gpu --hide-scrollbars --window-size=900,700 \
  --virtual-time-budget=2000 --screenshot=after-donut-back-link.png \
  "file://$PWD/donut.html"
```

Add `--no-sandbox` in a container or VM, per AGENTS.md.

## Link graph

Before:

```
index.html --> donut.html
donut.html --> (nothing)
```

After:

```
index.html --> donut.html
donut.html --> index.html
```

Every link target is a file that exists in the repo:

```bash
$ grep -nE 'href="[^"]+"' index.html donut.html
index.html:57:      <a href="donut.html">Donut Page</a>
donut.html:61:  <nav><a class="back-link" href="index.html">&larr; Back to index</a></nav>

$ ls -l index.html donut.html
-rw-r--r-- 1 kaeser kaeser 2650 Sep 18 16:37 donut.html
-rw-r--r-- 1 kaeser kaeser 1250 Sep 18 16:36 index.html
```

Both hrefs are relative and sit next to each other at the repo root, so they
resolve the same way over `file://` and over a static server.

## Structure a screen reader announces

Before:

```
document "Rotating donut"
  img "Spinning ASCII art donut"
```

After:

```
document "Rotating donut"
  navigation
    link "← Back to index"
  img "Spinning ASCII art donut"
```

The link is the first thing in the tab order and the first landmark, so
keyboard and screen-reader users reach it without stepping through the
donut.

## Layout

`body` became a centred column (`flex-direction: column`, `gap: 1.25rem`)
with `1.5rem 1rem` padding, so the link sits above the donut instead of
beside it. `.donut-box` was capped at `100vw`, which assumed an unpadded
body; it is now `100%` of the padded content box, which is what the cap was
for.

Widths the donut has to fit, with the `clamp(3.5px, 1.55vw, 13px)` font size
and 80 columns at a 0.6em advance:

| Screen | Content width | Glyph size | Donut width | Fits |
|---|---|---|---|---|
| 320px phone | 320 - 32 = 288px | 1.55vw = 4.96px | 80 x 0.6 x 4.96 + 24px padding = 262px | yes |
| 375px phone | 343px | 5.81px | 303px | yes |
| 900px desktop | 868px | 13px (clamp ceiling) | 624px + 56px padding = 680px | yes |

Contrast of the link colour `#ffcf8f` on the `#0f1117` background is 13.1:1
by the WCAG 2 formula, the same pair the index already uses for links, so it
passes AA (4.5:1) and AAA (7:1).

## Self-contained check

The page still pulls nothing over the network:

```bash
$ grep -nE '<script|<link|https?://|url\(|@import' donut.html
67:  <script src="donut-renderer.js"></script>
68:  <script>
```

Both matches are the local renderer and the inline block that drives it. No
stylesheet links, no remote URLs, no `@import`, so the page renders the same
offline.
