const G = require("./game-engine.js");

let seed = 42;
const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

const game = G.createGame({ random });
const config = game.config;
console.log("opening state:", JSON.stringify(G.snapshot(game)));

// The wait shrinks with every point and settles on the floor.
const delays = [0, 1, 5, 10, 17, 40].map((score) => G.teleportDelay(score, config));
console.log("delays at 0/1/5/10/17/40 points:", delays.join(" "));
console.log("delay never grows:", delays.every((delay, i) => i === 0 || delay <= delays[i - 1]));
console.log("delay floors at minDelay:", delays[delays.length - 1] === config.minDelay);

// Catching the target scores a point and moves it somewhere else.
const before = G.snapshot(game).target;
const hit = G.registerHit(game);
console.log("hit scores:", hit.score === 1, "and moves:", hit.target.x !== before.x || hit.target.y !== before.y);
console.log("hit is quicker than the opening wait:", hit.delay < config.startDelay);

// Three misses end the round, and clicks after it change nothing.
const round = G.createGame({ random });
console.log("miss 1:", JSON.stringify(G.registerMiss(round)));
console.log("miss 2:", JSON.stringify(G.registerMiss(round)));
const over = G.registerMiss(round);
console.log("miss 3 ends it:", over.over, "with", over.remaining, "lives left");
const afterOver = G.registerHit(round);
console.log("hit after game over is ignored:", afterOver.score === 0 && afterOver.over);
const stranded = G.snapshot(round).target;
console.log("target stays put once the round is over:",
  stranded.x === over.target.x && stranded.y === over.target.y);

// A long round: the target stays inside the play area and keeps jumping clear
// of where it was.
let shortJumps = 0;
let tooShortInARow = 0;
let worstRun = 0;
let last = G.snapshot(game).target;
for (let i = 0; i < 5000; i++) {
  const state = G.registerHit(game);
  const spot = state.target;
  if (!(spot.x >= 0 && spot.x <= 1 && spot.y >= 0 && spot.y <= 1)) {
    throw new Error("target left the play area: " + JSON.stringify(spot));
  }
  if (!Number.isFinite(state.delay) || state.delay < config.minDelay) {
    throw new Error("delay out of range: " + state.delay);
  }
  if (Math.hypot(spot.x - last.x, spot.y - last.y) < config.minJump) {
    shortJumps++;
    tooShortInARow++;
    worstRun = Math.max(worstRun, tooShortInARow);
  } else {
    tooShortInARow = 0;
  }
  last = spot;
}
console.log("5000 jumps: short ones:", shortJumps, "longest run of them:", worstRun);

// A generator that answers out of range, or not with a number at all, must not
// push the target off the board.
const broken = G.createGame({ random: () => NaN });
G.teleport(broken);
const wild = G.createGame({ random: () => 9 });
G.teleport(wild);
console.log("NaN generator:", JSON.stringify(broken.target), "out-of-range generator:", JSON.stringify(wild.target));

// Nonsense settings fall back to workable ones instead of producing NaN: the
// floor cannot outlast the opening wait, and the game cannot slow down.
const odd = G.createGame({ maxMisses: 0, startDelay: -5, minDelay: 9000, speedUp: 4, jumpAttempts: 0, random });
console.log("settings settled:", JSON.stringify({
  maxMisses: odd.config.maxMisses,
  startDelay: odd.config.startDelay,
  minDelay: odd.config.minDelay,
  speedUp: odd.config.speedUp,
  jumpAttempts: odd.config.jumpAttempts,
}));
console.log("delay stays a number:", Number.isFinite(G.teleportDelay(3, odd.config)));
console.log("delay never grows with nonsense settings:",
  G.teleportDelay(3, odd.config) <= G.teleportDelay(0, odd.config));

// A shorter round is allowed: one miss, one life.
const sudden = G.createGame({ maxMisses: 1, random });
console.log("one miss ends a one-life round:", G.registerMiss(sudden).over);

// Replaying resets the score and the lives.
const replay = G.resetGame(round);
console.log("replay:", JSON.stringify(replay));
console.log("replay accepts hits again:", G.registerHit(round).score === 1);
