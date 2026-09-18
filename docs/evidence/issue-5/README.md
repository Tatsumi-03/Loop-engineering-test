# Issue #5 evidence: mobile-friendly index page

Earlier issues in this repo stored PNG and GIF captures here. Headless
Chromium is blocked in the environment this change was made in, so the
before/after proof below is text: the markup each version serves, the page
structure a text browser or screen reader walks, and the numbers that follow
from the CSS.

Reproduce the captures with:

```bash
chromium --headless --disable-gpu --hide-scrollbars --window-size=375,667 \
  --screenshot=after-mobile-375.png "file://$PWD/index.html"
```

Add `--no-sandbox` in a container or VM, per AGENTS.md.

## Before

`index.html` at commit 16e1943:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Loop test page</title>
</head>
<body>
    <a href="donut.html">Donut Page</a>
</body>
</html>
```

Structure a screen reader announces:

```
document "Loop test page"
  link "Donut Page"
```

No heading, no description, no context for the link.

On a 375px phone screen a page without `<meta name="viewport">` gets the
desktop fallback layout viewport, 980px wide in both Chrome for Android and
iOS Safari, then scales it down to fit:

| Quantity | Value |
|---|---|
| Layout viewport | 980px |
| Scale to a 375px screen | 375 / 980 = 0.38 |
| Rendered size of the 16px link | 16 x 0.38 = 6.1px |

6.1px is below the size at which body text stays legible, which is what the
issue reports: the page arrives zoomed out.

## After

Structure a screen reader announces:

```
document "Loop test page"
  heading level 1 "Loop test page"
  paragraph "Static, self-contained pages used to try out this repository's
             agent workflow."
  list (1 item)
    listitem
      link "Donut Page"
      paragraph "An ASCII art donut that spins in the browser, rendered
                 without any external requests."
```

With `width=device-width, initial-scale=1` the layout viewport equals the
screen, so the 16px body text renders at 16px with no zoom out. The content
column is capped and padded rather than full-bleed:

| Screen | Layout viewport | Content width | Horizontal overflow |
|---|---|---|---|
| 320px phone | 320px | 320 - (2 x 20px padding) = 280px | none |
| 375px phone | 375px | 335px | none |
| 1280px desktop | 1280px | `max-width: 40rem` = 640px, centred | none |

Contrast against the `#0f1117` background, computed with the WCAG 2 formula:

| Text | Colour | Ratio | WCAG AA (4.5:1) |
|---|---|---|---|
| Body | `#e6e8ef` | 15.5:1 | pass |
| Intro and link descriptions | `#a7adbe` | 8.4:1 | pass |
| Links | `#ffcf8f` | 13.1:1 | pass |

## Self-contained check

The page pulls nothing over the network. Every declared font is a system
stack, the colours are literals, and there is no script tag:

```bash
$ grep -nE '<script|<link|https?://|url\(|@import' index.html
$ echo $?
1
```

No matches, so the page renders the same offline and from a `file://` URL.
