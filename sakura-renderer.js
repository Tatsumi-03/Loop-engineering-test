/**
 * Computes frames of sakura rain: a static ASCII tree anchored to the right
 * edge, and a swarm of blossom glyphs drifting down past it.
 * Pure: a frame follows from the state handed in, and every random choice
 * comes from the generator the caller injects.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SakuraRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const TWO_PI = Math.PI * 2;

  const DEFAULTS = {
    glyphs: "✿❀*.˚'",
    colors: ["#ffd6ea", "#ffb0d8", "#ff8fc7", "#fff5fa"],
    // Rows per second. Slower and gentler than a hard rain.
    minSpeed: 3,
    maxSpeed: 7,
    // A petal starts up to this many rows above the top edge, so the fall
    // fills in ragged waves instead of one flat line.
    spawnSpread: 30,
    // Side-to-side sway, in columns, as a petal drifts down.
    driftAmplitude: 2.5,
    driftSpeed: 1.2,
    // Swarm size scales with grid area, with a floor for small screens.
    density: 0.06,
    minPetals: 12,
  };

  // A small ASCII tree: a blossom canopy over a forked trunk.
  const TREE_TEMPLATE = [
    "      .@@@@.      ",
    "    @@@@@@@@@@    ",
    "   @@@@@@@@@@@@   ",
    "  @@@@@@@@@@@@@@  ",
    "   @@@@@@@@@@@@   ",
    "  @@@@@@@@@@@@@@  ",
    "     @@@@@@@@     ",
    "        ||        ",
    "        ||        ",
    "       /||\\       ",
    "      / || \\      ",
    "     /  ||  \\     ",
  ];

  const TREE_COLORS = {
    "@": "#ff9ecb",
    ".": "#ffe3ef",
    "|": "#5a3a29",
    "/": "#5a3a29",
    "\\": "#5a3a29",
  };

  // Columns of empty space kept between the tree and the right edge.
  const TREE_MARGIN = 2;

  function randomIndex(random, count) {
    return Math.min(Math.max(Math.floor(random() * count), 0), count - 1);
  }

  /** Puts a petal back above the top edge with a fresh path and glyph. */
  function respawn(petal, columns, rows, config, random) {
    petal.baseX = random() * columns;
    petal.y = -random() * config.spawnSpread;
    petal.speed = config.minSpeed + random() * (config.maxSpeed - config.minSpeed);
    petal.phase = random() * TWO_PI;
    petal.sway = config.driftAmplitude * (0.4 + random() * 0.6);
    petal.age = 0;
    petal.glyph = config.glyphs.charAt(randomIndex(random, config.glyphs.length));
    petal.color = config.colors[randomIndex(random, config.colors.length)];
    return petal;
  }

  function createFall(grid, options) {
    const config = Object.assign({}, DEFAULTS, options);
    const random = grid.random || Math.random;
    const columns = Math.max(0, Math.floor(grid.columns));
    const rows = Math.max(0, Math.floor(grid.rows));

    const count = columns > 0 && rows > 0
      ? Math.max(config.minPetals, Math.round(columns * rows * config.density))
      : 0;

    const petals = [];
    for (let index = 0; index < count; index++) {
      petals.push(respawn({}, columns, rows, config, random));
    }

    return { petals, columns, rows, config, random };
  }

  /** Falls every petal `seconds` further, recycling the ones past the bottom. */
  function advanceFall(fall, seconds) {
    const { columns, rows, config, random } = fall;
    const step = Math.max(seconds, 0);

    for (const petal of fall.petals) {
      petal.age += step;
      petal.y += petal.speed * step;
      if (petal.y - 1 >= rows) respawn(petal, columns, rows, config, random);
    }

    return fall;
  }

  /** Every petal glyph to paint this frame. */
  function frameCells(fall) {
    const { columns, rows, config } = fall;
    const cells = [];

    for (const petal of fall.petals) {
      const row = Math.floor(petal.y);
      if (row < 0 || row >= rows) continue;

      const column = Math.round(
        petal.baseX + Math.sin(petal.age * config.driftSpeed + petal.phase) * petal.sway,
      );
      if (column < 0 || column >= columns) continue;

      cells.push({ column, row, glyph: petal.glyph, color: petal.color, alpha: 1 });
    }

    return cells;
  }

  /** The static tree, anchored to the bottom-right of the grid and clipped to fit it. */
  function treeCells(columns, rows, options) {
    const config = Object.assign({}, DEFAULTS, options);
    const template = config.tree || TREE_TEMPLATE;
    const treeHeight = template.length;
    const treeWidth = template.reduce((max, line) => Math.max(max, line.length), 0);

    const originColumn = Math.max(0, columns - treeWidth - TREE_MARGIN);
    const originRow = Math.max(0, rows - treeHeight);

    const cells = [];
    template.forEach((line, lineRow) => {
      const row = originRow + lineRow;
      if (row < 0 || row >= rows) return;

      for (let lineColumn = 0; lineColumn < line.length; lineColumn++) {
        const glyph = line[lineColumn];
        if (glyph === " ") continue;

        const column = originColumn + lineColumn;
        if (column < 0 || column >= columns) continue;

        cells.push({ column, row, glyph, color: TREE_COLORS[glyph] || "#ffffff" });
      }
    });

    return cells;
  }

  return { createFall, advanceFall, frameCells, treeCells, DEFAULTS };
});
