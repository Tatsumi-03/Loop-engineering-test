# Issue #10 evidence: a Pong page

The repo had two pages that play themselves, the donut and the matrix rain,
and nothing to play. This change adds `pong.html`, a game of Pong against
the computer, plus `pong-engine.js`, the pure module that owns the rules.

## What could not be run here

Both the screenshot capture and the script runner were blocked in the
session this change was written in: running `node` and running `chromium`
each need an approval that the session had no way to grant. Nothing below is
a transcript of a run. Each figure is worked out from the committed code,
and the two commands that reproduce it are:

```bash
node verify-pong.js
chromium --headless --disable-gpu --hide-scrollbars --window-size=900,700 \
  --virtual-time-budget=2000 --screenshot=after-pong.png "file://$PWD/pong.html"
```

Add `--no-sandbox` in a container or VM, per AGENTS.md.

## Before and after

Before, the index listed two pages and the repo had no game:

```
index.html --> donut.html --> index.html
index.html --> matrix.html --> index.html
```

After, a third page joins the loop:

```
index.html --> donut.html  --> index.html
index.html --> matrix.html --> index.html
index.html --> pong.html   --> index.html
```

Every target is a file at the repo root, so the links resolve the same over
`file://` and over a static server. In a clean checkout:

```
$ rg -n 'href="[^"]+"' --glob '*.html'
pong.html:76:  <nav><a class="back-link" href="index.html">&larr; Back to index</a></nav>
matrix.html:45:  <nav><a class="back-link" href="index.html">&larr; Back to index</a></nav>
donut.html:61:  <nav><a class="back-link" href="index.html">&larr; Back to index</a></nav>
index.html:57:      <a href="donut.html">Donut Page</a>
index.html:61:      <a href="matrix.html">Matrix Rain Page</a>
index.html:65:      <a href="pong.html">Pong Page</a>
```

## The opening frame

The field is 160 by 100 units and the page scales it to the canvas, so these
coordinates hold at every screen size. Plotted from `draw()` and the state
`createGame()` returns:

| Piece | Field coordinates |
|---|---|
| Player paddle | x 5 to 8, y 41 to 59 (`#ffcf8f`) |
| Rival paddle | x 152 to 155, y 41 to 59 (`#8fb4ff`) |
| Ball | centre (80, 50), radius 1.6 (`#e6e8ef`) |
| Centre line | x 79.6 to 80.4, dashes of 4 every 7 |
| Score | baseline y 6, right-aligned at x 74 and left-aligned at x 86 |
| Banner | y 41 to 59, "Press space or tap the field to play." |

As a schematic, with the field coordinates marked:

```
 x=0                x=80                x=160
  +-----------------------------------------+ y=0
  |                   :                     |
  |                 0 : 0                   |  score, y 6 to 18
  |                   :                     |
  | #                 :                   # |  y=41, paddle tops
  | # [ Press space or tap the field to  ] # |  y=50, banner over the ball
  | #                 o                   # |
  | #                 :                   # |  y=59, paddle bottoms
  |                   :                     |
  +-----------------------------------------+ y=100
    x=5..8                        x=152..155
```

The banner is 80% opaque and only 18 units tall, so it dims the middle of
the field while the paddles and the ball stay visible through it. It clears
the moment play starts.

## Physics

Every number below follows from `DEFAULTS` in `pong-engine.js`.

The ball leaves the centre spot 0.9 s after a point, at 70 units/s and
within 30 degrees of the horizontal. Each paddle hit multiplies the speed by
1.05 and caps it at 150, so a rally reaches top speed on the 16th return
(70 x 1.05^15 = 145.5, the next hit clamps at 150).

Where the ball meets the paddle sets the angle it leaves at. The bounce
block in `verify-pong.js` drives a 70 units/s ball into a paddle centred at
y 50:

| Hit, relative to the paddle centre | Leaves at | Speed |
|---|---|---|
| 9 units above (the top tip) | -60 degrees | 73.5 units/s |
| dead centre | 0 degrees | 73.5 units/s |
| 9 units below (the bottom tip) | +60 degrees | 73.5 units/s |

Capping the angle at 60 degrees keeps `|vx|` at or above half the speed, so
the ball always crosses the field instead of stalling between the top and
bottom walls. `verify-pong.js` asserts that invariant on every frame of a
120 s game.

Reach, which is what makes the rival beatable:

| | Speed | Seconds to cross the 82 units of paddle travel |
|---|---|---|
| Player | 115 units/s | 0.71 |
| Rival | 80 units/s | 1.02 |
| Ball, paddle face to paddle face (144 units) | 70 to 150 units/s | 2.06 down to 0.96 |

At the speed cap the player can still cover the field between returns and
the rival cannot, so rallies end in points rather than running forever.

### Why the collision test is swept, not an overlap

The page caps a frame step at 0.05 s, the same guard `matrix.html` uses
against a background tab. At the 150 units/s cap that is 7.5 units of travel
in one step, more than the 3 units a paddle is thick, so a paddle tested by
overlap alone would be passed straight through. `bounceOffPaddle` instead
asks whether the ball's leading edge crossed the paddle's face during the
step and interpolates the crossing point, which catches the hit whatever the
step size.

## Edge cases `verify-pong.js` covers

| Check | Expected |
|---|---|
| Opening state | 0-0, ball parked on the centre spot, paddles facing each other |
| Serve timing | parked for 0.9 s, then away at 70 units/s |
| 120 s of play, every frame | ball inside the field, under the speed cap, never stalled; paddles inside the field; no NaN |
| Bounce geometry | -60, 0 and +60 degrees off the tips and the centre |
| A ball past the wall | a point to the other side, and the winning score sets `winner` |
| A won game | holds still until `resetGame` clears the board |
| Aim outside the field, or `NaN` | clamped, or ignored |
| A 0 by 0 field with a 999-unit paddle | sizes pulled back into range, no NaN |
| A negative or `NaN` step | ignored |

## Accessibility

Structure a screen reader walks:

```
document "Pong"
  navigation
    link "← Back to index"
  img "A Pong field: your paddle on the left, the rival's on the right, a
       ball between them"
  status "You 0, rival 0. Press space or tap the field to play."
  paragraph "Move with the mouse, a finger, the arrow keys or W and S.
             Space starts and pauses. First to eleven wins."
```

The status line is a live region that carries the score and the state, so
the game is followable without seeing the canvas. It is only written to when
its wording changes, which during a rally means once per point rather than
once per frame.

The page opens stopped and never animates on its own, so a visitor who has
asked for reduced motion sees a still field. Turning the preference on
during a game pauses it, and while it is on the status line says why. The
game still starts when the visitor asks it to, by key or by tap.

Contrast by the WCAG 2 formula:

| Text | Colour | On | Ratio | AA (4.5:1) |
|---|---|---|---|---|
| Back link | `#ffcf8f` | `#0f1117` | 13.1:1 | pass |
| Status line | `#e6e8ef` | `#0f1117` | 15.5:1 | pass |
| Controls hint | `#a7adbe` | `#0f1117` | 8.4:1 | pass |
| Score | `#8a94ad` | `#0b0e16` | 6.4:1 | pass |
| Banner | `#e6e8ef` | `#0b0e16` | 15.8:1 | pass |

Paddles and ball against the `#0b0e16` field: player `#ffcf8f` 13.5:1, rival
`#8fb4ff` 9.4:1, ball `#e6e8ef` 15.8:1, all past the 3:1 that WCAG asks of
graphics.

## Layout

The canvas is the full width of a box capped at 44rem, with `aspect-ratio:
8 / 5` matching the field, so nothing letterboxes:

| Screen | Canvas | CSS pixels per unit | Ball diameter | Paddle |
|---|---|---|---|---|
| 320px phone | 272 x 170 | 1.7 | 5.4px | 5.1 x 30.6px |
| 375px phone | 327 x 204 | 2.04 | 6.5px | 6.1 x 36.7px |
| 900px desktop | 680 x 425 | 4.25 | 13.6px | 12.8 x 76.5px |

`touch-action: none` on the canvas plus `preventDefault()` on pointerdown
mean dragging a finger across the field aims the paddle instead of scrolling
the page.

## Self-contained check

The page pulls nothing over the network:

```
$ rg -n '<script|<link|https?://|url\(|@import' pong.html
85:  <script src="pong-engine.js"></script>
86:  <script>
```

Both matches are the local engine and the inline block that drives it. No
stylesheet links, no remote URLs, no `@import`, no images, so the page
renders the same offline and from a `file://` URL.
