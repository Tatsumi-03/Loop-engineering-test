/**
 * Computes frames of matrix rain: one falling drop per column, each trailing
 * the glyphs it has passed and whitening as it drops down the screen.
 * Pure: a frame follows from the state handed in, and every random choice
 * comes from the generator the caller injects.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MatrixRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULTS = {
    // Half-width katakana and digits, the alphabet the film's rain is built
    // from. Both ranges sit in the system fonts a monospace stack falls back
    // to, so the page still downloads nothing.
    glyphs: "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789",
    // Glyphs kept behind the leading one, fading towards minAlpha.
    trailLength: 16,
    minAlpha: 0.06,
    // Rows per second. The spread stops the columns falling in lockstep.
    minSpeed: 8,
    maxSpeed: 22,
    // A drop starts up to this many rows above the top edge, so the screen
    // fills in ragged waves instead of one flat line.
    spawnSpread: 40,
    // A drop leaves the top green and arrives at the bottom white.
    startColor: [0, 255, 70],
    endColor: [255, 255, 255],
  };

  function randomIndex(random, count) {
    return Math.min(Math.max(Math.floor(random() * count), 0), count - 1);
  }

  function pickGlyph(glyphs, random) {
    return glyphs.charAt(randomIndex(random, glyphs.length));
  }

  /** Puts a drop back above the top edge with a fresh speed and an empty trail. */
  function respawn(column, config, random) {
    column.head = -random() * config.spawnSpread;
    column.speed = config.minSpeed + random() * (config.maxSpeed - config.minSpeed);
    column.glyphs.length = 0;
    return column;
  }

  /** Colour of a glyph at `progress` of the fall: 0 at the top, 1 at the bottom. */
  function fallColor(progress, config) {
    const t = Math.min(Math.max(progress, 0), 1);
    const [red, green, blue] = config.startColor.map((from, index) => {
      const to = config.endColor[index];
      return Math.round(from + (to - from) * t);
    });
    return `rgb(${red}, ${green}, ${blue})`;
  }

  function createRain(grid, options) {
    const config = Object.assign({}, DEFAULTS, options);
    const random = grid.random || Math.random;
    const columnCount = Math.max(1, Math.floor(grid.columns));
    const rows = Math.max(1, Math.floor(grid.rows));

    // The colour depends only on how far down the screen a glyph sits, so it
    // is worth resolving once per grid rather than once per glyph per frame.
    const colors = [];
    for (let row = 0; row < rows; row++) {
      colors.push(fallColor(rows > 1 ? row / (rows - 1) : 0, config));
    }

    const columns = [];
    for (let index = 0; index < columnCount; index++) {
      columns.push(respawn({ head: 0, speed: 0, glyphs: [] }, config, random));
    }

    return { columns, rows, colors, config, random };
  }

  /** Falls every drop `seconds` further, refilling trails and recycling drops. */
  function advanceRain(rain, seconds) {
    const { rows, config, random } = rain;
    const step = Math.max(seconds, 0);

    for (const column of rain.columns) {
      const previousRow = Math.floor(column.head);
      column.head += column.speed * step;

      const firstRow = Math.max(previousRow + 1, 0);
      const lastRow = Math.min(Math.floor(column.head), rows - 1);
      for (let row = firstRow; row <= lastRow; row++) {
        column.glyphs[row] = pickGlyph(config.glyphs, random);
      }

      // Recycle the drop once its whole trail has cleared the bottom edge.
      if (column.head - config.trailLength >= rows) respawn(column, config, random);
    }

    return rain;
  }

  /** Every glyph to paint this frame, the leading glyph of each drop first. */
  function frameCells(rain) {
    const { rows, colors, config } = rain;
    const fade = config.trailLength > 1 ? (1 - config.minAlpha) / (config.trailLength - 1) : 0;
    const cells = [];

    rain.columns.forEach((column, index) => {
      const headRow = Math.floor(column.head);
      for (let offset = 0; offset < config.trailLength; offset++) {
        const row = headRow - offset;
        if (row < 0) break;
        if (row >= rows) continue;

        const glyph = column.glyphs[row];
        if (!glyph) continue;

        cells.push({
          column: index,
          row,
          glyph,
          color: colors[row],
          alpha: 1 - offset * fade,
        });
      }
    });

    return cells;
  }

  return { createRain, advanceRain, frameCells, DEFAULTS };
});
