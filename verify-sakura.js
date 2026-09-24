const R = require("./sakura-renderer.js");

let seed = 42;
const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

const fall = R.createFall({ columns: 40, rows: 20, random });
console.log("petal count at least the floor:", fall.petals.length >= R.DEFAULTS.minPetals);
console.log("heads start above the top:", fall.petals.every((p) => p.y <= 0));
console.log("speeds in range:", fall.petals.every((p) => p.speed >= 3 && p.speed <= 7));

R.advanceFall(fall, 0.5);
const cells = R.frameCells(fall);
console.log("sample cell:", JSON.stringify(cells[0]));
console.log("columns in range:", cells.every((c) => c.column >= 0 && c.column < 40));
console.log("rows in range:", cells.every((c) => c.row >= 0 && c.row < 20));
console.log("alpha in range:", cells.every((c) => c.alpha > 0 && c.alpha <= 1));
console.log("single glyphs:", cells.every((c) => c.glyph.length === 1));

// 30 seconds at 60fps: petals must recycle and stay inside the grid.
let maxY = -Infinity;
for (let i = 0; i < 1800; i++) {
  R.advanceFall(fall, 1 / 60);
  for (const cell of R.frameCells(fall)) {
    if (cell.column < 0 || cell.column >= 40) throw new Error("column out of grid: " + cell.column);
    if (cell.row < 0 || cell.row >= 20) throw new Error("row out of grid: " + cell.row);
  }
  for (const petal of fall.petals) maxY = Math.max(maxY, petal.y);
}
console.log("30s run: petals never fall far past the bottom:", maxY < 20 + 2, "(max y", maxY.toFixed(2) + ")");

// A degenerate grid must not spawn petals or produce NaN.
const tiny = R.createFall({ columns: 0, rows: 0, random });
R.advanceFall(tiny, 5);
console.log("degenerate grid:", tiny.petals.length, "petals,", R.frameCells(tiny).length, "cells");

// A step backwards in time is clamped to zero.
const before = fall.petals[0].y;
R.advanceFall(fall, -1);
console.log("negative step ignored:", fall.petals[0].y === before);

// The tree sits inside the grid, hugging the bottom-right corner.
const tree = R.treeCells(40, 20);
console.log("tree cell count:", tree.length, tree.length > 0);
console.log("tree stays in bounds:", tree.every((c) => c.column >= 0 && c.column < 40 && c.row >= 0 && c.row < 20));
const maxTreeColumn = Math.max(...tree.map((c) => c.column));
const maxTreeRow = Math.max(...tree.map((c) => c.row));
console.log("tree hugs the right edge:", maxTreeColumn >= 40 - 5, "(max column", maxTreeColumn + ")");
console.log("tree hugs the bottom edge:", maxTreeRow === 19, "(max row", maxTreeRow + ")");

// A grid smaller than the template clips instead of throwing.
const small = R.treeCells(6, 4);
console.log("small grid clips cleanly:", small.every((c) => c.column >= 0 && c.column < 6 && c.row >= 0 && c.row < 4));

// A zero-size grid yields no tree cells.
console.log("degenerate grid has no tree:", R.treeCells(0, 0).length === 0);
