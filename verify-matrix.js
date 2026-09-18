const R = require("./matrix-renderer.js");

let seed = 42;
const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

const rain = R.createRain({ columns: 6, rows: 10, random });
console.log("colors:", rain.colors[0], "|", rain.colors[5], "|", rain.colors[9]);
console.log("heads start above the top:", rain.columns.every((c) => c.head <= 0));
console.log("speeds in range:", rain.columns.every((c) => c.speed >= 8 && c.speed <= 22));

R.advanceRain(rain, 0.5);
const cells = R.frameCells(rain);
console.log("cells after 0.5s:", cells.length);
console.log("sample cell:", JSON.stringify(cells[0]));
console.log("rows in range:", cells.every((c) => c.row >= 0 && c.row < 10));
console.log("alpha in range:", cells.every((c) => c.alpha > 0 && c.alpha <= 1));
console.log("single glyphs:", cells.every((c) => c.glyph.length === 1));

// 30 seconds at 60fps: drops must recycle and stay inside the grid.
let maxHead = -Infinity;
for (let i = 0; i < 1800; i++) {
  R.advanceRain(rain, 1 / 60);
  for (const cell of R.frameCells(rain)) {
    if (cell.row < 0 || cell.row >= 10) throw new Error("row out of grid: " + cell.row);
    if (!(cell.alpha > 0 && cell.alpha <= 1)) throw new Error("alpha out of range: " + cell.alpha);
  }
  for (const column of rain.columns) maxHead = Math.max(maxHead, column.head);
}
console.log("30s run: heads never exceed rows + trail:", maxHead < 10 + 16 + 1, "(max head", maxHead.toFixed(2) + ")");

// A one-row grid and a zero-size viewport must not produce NaN.
const tiny = R.createRain({ columns: 0, rows: 0, random });
R.advanceRain(tiny, 5);
console.log("degenerate grid:", tiny.columns.length, "column,", tiny.rows, "row, colour", tiny.colors[0]);

// A step backwards in time is clamped to zero.
const before = rain.columns[0].head;
R.advanceRain(rain, -1);
console.log("negative step ignored:", rain.columns[0].head === before);
