# Loop engineering test

A handful of static, self-contained web pages used to exercise this
repository's agent workflow. No build step, no dependencies: every page is
plain HTML, CSS and JavaScript.

## Running it

Open `index.html` in a browser, or serve the directory:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Links to the other pages. |
| `donut.html` | ASCII rotating donut, rendered by `donut-renderer.js`. |
| `matrix.html` | Matrix-style character rain, rendered by `matrix-renderer.js`. |
| `sakura.html` | Sakura rain: pink blossom glyphs falling past a tree on the right, rendered by `sakura-renderer.js`. |
| `game.html` | Click the red target before it teleports; logic in `game-engine.js`. |

The renderers and the game engine are kept in their own files so they can run
under Node without a browser.

## Checks

```bash
node verify-matrix.js
node verify-sakura.js
node verify-game.js
```

Each script prints the result of every assertion it makes; read the output and
check that nothing reports `false`.

## Contributing

`AGENTS.md` describes the workflow agents follow here: work in a worktree off
`origin/main`, prove the change with evidence, and open a PR.
