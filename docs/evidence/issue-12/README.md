# Issue #12 evidence: teleporting target game

Earlier issues in this repo stored PNG and GIF captures here. The sandbox
this change was made in refused permission to run `node` and `chromium`, so
there are no captures and no recorded run of `verify-game.js`. The proof
below is what can be established without executing anything: the markup and
structure each version serves, the rules read straight out of
`game-engine.js`, and the numbers those rules produce.

Anyone with a shell can run the checks the sandbox blocked:

```bash
node verify-game.js          # exercises every rule in game-engine.js
chromium --headless --disable-gpu --hide-scrollbars --window-size=900,700 \
  --virtual-time-budget=2000 --screenshot=after-game.png "file://$PWD/game.html"
```

Add `--no-sandbox` in a container or VM, per AGENTS.md.

## Before

There was no game page. `index.html` listed two pages, and nothing in the
repo handled a click:

```
index.html --> donut.html --> index.html
index.html --> matrix.html --> index.html
```

## After

```
index.html --> donut.html  --> index.html
index.html --> matrix.html --> index.html
index.html --> game.html   --> index.html
```

Every link target is a file in the repo, and every href is relative, so the
pages resolve the same over `file://` and over a static server:

```
$ grep -nE 'href="[^"]+"' index.html game.html
index.html:57:      <a href="donut.html">Donut Page</a>
index.html:61:      <a href="matrix.html">Matrix Rain Page</a>
index.html:65:      <a href="game.html">Teleporting Target Game</a>
game.html:143:  <nav><a class="back-link" href="index.html">&larr; Back to index</a></nav>
```

## What the issue asked for, and where it lives

| Issue | Where |
|---|---|
| A circle that teleports across the page | `game-engine.js:99` picks the spot, `game.html:198` places it |
| Each successful click scores | `game-engine.js:120` `registerHit` |
| The circle is red | `game.html:78`, `radial-gradient(circle at 32% 30%, #ff8a80, #e5231b 70%)` |
| Teleport frequency rises with the score | `game-engine.js:56` `teleportDelay`, driving the timer at `game.html:195` |
| Three misses end the game | `game-engine.js:132` `registerMiss`, `maxMisses: 3` at `game-engine.js:14` |

A miss is either a click that lands on the play area instead of the circle
(`game.html:237`) or a circle that jumps away before it is clicked
(`game.html:195`). Both are "missing the circle", and the page says so above
the play area.

## The speed ramp

`teleportDelay` is `max(minDelay, round(startDelay * speedUp^score))` with
`startDelay = 1400ms`, `minDelay = 420ms`, `speedUp = 0.93`. Evaluating that
formula (in Python, since `node` could not run here):

| Score | Wait before the jump | Jumps per second |
|---|---|---|
| 0 | 1400ms | 0.71 |
| 3 | 1126ms | 0.89 |
| 5 | 974ms | 1.03 |
| 10 | 678ms | 1.47 |
| 15 | 471ms | 2.12 |
| 17 | 420ms | 2.38 |
| 50 | 420ms | 2.38 |

The wait is monotonically decreasing, halves by the tenth point, and reaches
its floor at score 17, where it stays. The floor is what keeps the game
playable rather than impossible: the delay never decays to zero.

## The jump

Each jump draws up to 12 candidate spots and takes the first that lands at
least `minJump = 0.35` of the play area away from the old one, keeping the
farthest candidate if none clears the bar. That stops the circle reappearing
under the pointer that just clicked it. Simulating the same loop 200,000
times from a `random.random()` source:

| Measure | Value |
|---|---|
| Jumps shorter than 0.35 | 0 |
| Longest run of short jumps | 0 |
| Mean jump distance | 0.636 |
| Shortest / longest jump | 0.350 / 1.397 |

Positions are fractions of the play area, not pixels, and the page turns
them into `calc(x * (100% - var(--target-size)))`, so the circle stays whole
inside the arena at every viewport width and needs no repositioning on
resize.

## Rounds end, and stay ended

Walking the engine through a losing round:

| Call | score | misses | lives left | over |
|---|---|---|---|---|
| `createGame` | 0 | 0 | 3 | false |
| `registerHit` | 1 | 0 | 3 | false |
| `registerMiss` | 1 | 1 | 2 | false |
| `registerMiss` | 1 | 2 | 1 | false |
| `registerMiss` | 1 | 3 | 0 | true |
| `registerHit` | 1 | 3 | 0 | true |

The last row is the guard at `game-engine.js:121`: once the round is over,
further clicks change nothing, the third miss leaves the circle where it is
instead of jumping, and the page hides it behind the game-over panel.
`verify-game.js` asserts each of those, plus a 5,000-jump run that fails if
the circle ever leaves the 0..1 box or the delay drops below the floor, plus
generators that answer `NaN` or out-of-range numbers, plus nonsense settings
(`maxMisses: 0`, `startDelay: -5`, `minDelay: 9000`, `speedUp: 4`) falling
back to sane ones.

## Structure a screen reader announces

```
document "Teleporting target"
  navigation
    link "← Back to index"
  main
    heading level 1 "Teleporting target"
    paragraph "Click the red circle. Every catch scores a point ..."
    status "Score 0 Lives 3"
    button "Red target"            (hidden until the round starts)
    heading level 2 "Ready?"
    paragraph "Catch the circle before it teleports away."
    button "Start"
```

The circle is a real `<button>`, so it takes keyboard focus and Enter counts
as a click; the scoreboard is a `role="status"` region, so the score and the
remaining lives are announced as they change; focus moves to the circle when
a round starts and to "Play again" when it ends. Contrast against the
`#0f1117` background: body text `#e6e8ef` 15.5:1, muted text `#a7adbe`
8.4:1, the back link `#ffcf8f` 13.1:1, all the same pairs the index already
ships.

Motion is opt-in the same way the donut and matrix pages handle it. The jump
itself is instant by design, and the only animation, the press feedback, is
inside `@media (prefers-reduced-motion: no-preference)`.

## Static checks that did run

Python was available where `node` was not, so the shipped files were walked
for structural faults: bracket, brace, string and comment balance across
`game-engine.js`, `verify-game.js` and the inline script in `game.html`;
every `getElementById` argument matched against the ids in the markup; and
the element nesting in `game.html`.

```
game-engine.js: balanced
verify-game.js: balanced
game.html inline script: balanced
ids in markup: ['action', 'arena', 'lives', 'overlay', 'overlay-text', 'overlay-title', 'score', 'target']
every id the script reads exists: True []
html tags nest correctly, nothing left open: True []
```

That is a structural pass, not a parse and not a run of the rules. The
behaviour above still wants `node verify-game.js` and a browser.

## Self-contained check

The page pulls nothing over the network, like the rest of the repo:

```
$ grep -nE '<script|<link|https?://|url\(|@import' game.html
170:  <script src="game-engine.js"></script>
171:  <script>
```

Both matches are the local engine and the inline block that drives it, so
the page plays the same offline.
