const P = require("./pong-engine.js");

let seed = 42;
const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

const FRAME = 1 / 60;
const newGame = (options) => P.createGame(Object.assign({ random }, options));

let passed = 0;

/** Prints a check, and throws on the first failure so the run exits non-zero. */
function check(label, condition, detail) {
  if (!condition) throw new Error("FAIL: " + label + (detail ? " [" + detail + "]" : ""));
  passed += 1;
  console.log("ok   " + label + (detail ? "  [" + detail + "]" : ""));
}

const near = (actual, expected, tolerance) => Math.abs(actual - expected) <= tolerance;
const speedOf = (ball) => Math.hypot(ball.vx, ball.vy);
const degreesOf = (ball) => Math.atan2(ball.vy, ball.vx) * 180 / Math.PI;
/** How far off the horizontal the ball is flying, whichever way it is going. */
const offFlatOf = (ball) => Math.atan2(ball.vy, Math.abs(ball.vx)) * 180 / Math.PI;

/**
 * Plays `seconds` frame by frame, checking on every one of them that the ball
 * and the paddles stay legal. Returns the number of frames played.
 */
function playFrames(game, seconds, aim) {
  const { width, height, paddleHeight, serveSpeed, maxSpeed } = game.config;
  const half = paddleHeight / 2;
  const radius = game.ball.radius;
  const slack = 1e-9;
  const frames = Math.round(seconds / FRAME);

  for (let frame = 0; frame < frames; frame++) {
    if (aim) aim(game);
    P.advanceGame(game, FRAME);

    const { x, y, vx, vy } = game.ball;
    const speed = speedOf(game.ball);
    const live = !game.serving && game.winner === null;

    if (!Number.isFinite(x + y + vx + vy)) throw new Error("ball state went non-finite on frame " + frame);
    if (x + radius < -slack || x - radius > width + slack) throw new Error("ball left the field at x " + x);
    if (y - radius < -slack || y + radius > height + slack) throw new Error("ball left the field at y " + y);
    if (live && speed > maxSpeed + slack) throw new Error("ball past the speed cap at " + speed);
    if (live && speed < serveSpeed - slack) throw new Error("ball slower than a serve at " + speed);
    if (live && Math.abs(vx) < speed * 0.4) throw new Error("ball stalled between the walls at vx " + vx);
    for (const paddle of [game.player, game.rival]) {
      if (paddle.y < half - slack || paddle.y > height - half + slack) throw new Error("paddle left the field at " + paddle.y);
    }
  }

  return frames;
}

/** A game with the ball already in play, so a test can place it by hand. */
function inPlay(options) {
  const game = newGame(Object.assign({ serveDelay: 0 }, options));
  P.advanceGame(game, 1e-6);
  return game;
}

// --- the opening state -----------------------------------------------------

const game = newGame();
check("opens level", game.score.player === 0 && game.score.rival === 0 && game.winner === null);
check("ball parked on the centre spot", game.ball.x === 80 && game.ball.y === 50 && game.ball.vx === 0 && game.ball.vy === 0);
check("serve is pending", game.serving === true && game.serveTimer === game.config.serveDelay, "delay " + game.config.serveDelay);
check("serve goes left or right", Math.abs(game.serveDirection) === 1, "direction " + game.serveDirection);
check("paddles face each other", game.player.right === 8 && game.rival.left === 152, "player 5-8, rival 152-155");
check("paddles start centred", game.player.y === 50 && game.rival.y === 50);

// --- the serve -------------------------------------------------------------

P.advanceGame(game, 0.5);
check("ball waits out the delay", game.serving && game.ball.vx === 0, "timer " + game.serveTimer.toFixed(3));

P.advanceGame(game, 0.5);
const servedSpeed = speedOf(game.ball);
check("served at serveSpeed", !game.serving && near(servedSpeed, 70, 1e-9), servedSpeed.toFixed(6) + " units/s");
check("serve is within 30 degrees of flat", Math.abs(offFlatOf(game.ball)) <= 30 + 1e-9, offFlatOf(game.ball).toFixed(3) + " degrees off the horizontal");

// --- a long game, checked on every frame ------------------------------------

const rally = newGame();
const rallyFrames = playFrames(rally, 120, (g) => P.aimPlayer(g, g.ball.y));
check("120 s of tracking play stays legal", rallyFrames === 7200, rallyFrames + " frames, score " + JSON.stringify(rally.score) + ", winner " + rally.winner);

// --- where the ball meets the paddle sets the angle -------------------------

for (const [offset, expected] of [[-9, -60], [0, 0], [9, 60]]) {
  const hit = inPlay();
  hit.player.y = 50;
  hit.player.target = 50;
  Object.assign(hit.ball, { x: 20, y: 50 + offset, vx: -70, vy: 0 });
  P.advanceGame(hit, 0.2);

  check(
    "a hit " + offset + " from the paddle centre leaves at " + expected + " degrees",
    near(degreesOf(hit.ball), expected, 1e-9) && near(speedOf(hit.ball), 73.5, 1e-9) && near(hit.ball.x, 9.6, 1e-9),
    degreesOf(hit.ball).toFixed(3) + " degrees at " + speedOf(hit.ball).toFixed(3) + " units/s",
  );
}

// --- a corner shot: wall and paddle inside one step -------------------------

// The ball meets the top wall 0.12 s in and the paddle face 0.08 s after that.
// Taken as one straight run the crossing point works out at y -0.4, outside
// the field and past the paddle tip; cut at the wall it is y 3.6, six tenths
// of the way up a paddle parked at y 9, which is a -36 degree return.
const corner = inPlay();
corner.player.y = 9;
corner.player.target = 9;
Object.assign(corner.ball, { x: 20, y: 10, vx: -70, vy: -70 });
P.advanceGame(corner, 0.2);
check(
  "a corner shot bounces off the wall then the paddle",
  near(corner.ball.y, 3.6, 1e-6) && near(corner.ball.x, 9.6, 1e-9) && near(degreesOf(corner.ball), -36, 1e-6),
  "met the paddle at y " + corner.ball.y.toFixed(3) + ", left at " + degreesOf(corner.ball).toFixed(3) + " degrees",
);
check(
  "the corner shot keeps its speed gain",
  near(speedOf(corner.ball), Math.hypot(70, 70) * 1.05, 1e-9),
  speedOf(corner.ball).toFixed(3) + " units/s",
);

// --- points, the winning score, and a reset ---------------------------------

const rebound = inPlay();
Object.assign(rebound.ball, { x: 3, y: 50, vx: -70, vy: 0 });
P.advanceGame(rebound, 0.2);
check("a ball past the wall is a point", rebound.score.rival === 1 && rebound.score.player === 0 && rebound.winner === null, JSON.stringify(rebound.score));
check("the side that conceded receives", rebound.serving && rebound.serveDirection === -1 && rebound.serveTimer === rebound.config.serveDelay);
check("the ball goes back to the centre spot", rebound.ball.x === 80 && rebound.ball.y === 50 && rebound.ball.vx === 0);

const decider = inPlay({ winningScore: 1 });
Object.assign(decider.ball, { x: 3, y: 50, vx: -70, vy: 0 });
P.advanceGame(decider, 0.2);
check("the winning score ends the game", decider.winner === "rival" && decider.serving === false, JSON.stringify(decider.score));

const frozen = JSON.stringify(decider.ball);
P.advanceGame(decider, 5);
check("a won game holds still", JSON.stringify(decider.ball) === frozen, frozen);

P.resetGame(decider);
check(
  "reset clears the board",
  decider.winner === null && decider.score.rival === 0 && decider.score.player === 0
    && decider.serving === true && decider.ball.x === 80 && decider.ball.y === 50 && decider.player.y === 50,
);

// --- aiming -----------------------------------------------------------------

const aim = newGame();
P.aimPlayer(aim, -500);
check("aim clamped to the top of the field", aim.player.target === 9, "target " + aim.player.target);
P.aimPlayer(aim, 500);
check("aim clamped to the bottom of the field", aim.player.target === 91, "target " + aim.player.target);
P.aimPlayer(aim, NaN);
check("NaN aim ignored", aim.player.target === 91);

// --- input that would otherwise produce NaN ---------------------------------

const junk = P.createGame({ paddleWidth: NaN, serveSpeed: "fast", winningScore: null, random });
check(
  "config that is not a finite number falls back to the default",
  junk.config.paddleWidth === 3 && junk.config.serveSpeed === 70 && junk.config.winningScore === 11,
  JSON.stringify({ pw: junk.config.paddleWidth, serve: junk.config.serveSpeed, target: junk.config.winningScore }),
);

const tiny = P.createGame({ width: 0, height: 0, paddleHeight: 999, ballRadius: 50, serveDelay: 0, random });
check(
  "a degenerate field is pulled back into range",
  tiny.config.width === 1 && tiny.config.height === 1 && tiny.config.paddleHeight === 1
    && tiny.config.paddleWidth === 0.25 && tiny.config.paddleInset === 0.25 && tiny.config.ballRadius === 0.25,
  JSON.stringify({ w: tiny.config.width, h: tiny.config.height, pw: tiny.config.paddleWidth, ph: tiny.config.paddleHeight, r: tiny.config.ballRadius }),
);
const tinyFrames = playFrames(tiny, 5);
check("5 s on a one-unit field stays legal", tinyFrames === 300, tinyFrames + " frames, ball at " + tiny.ball.x.toFixed(3) + ", " + tiny.ball.y.toFixed(3));

const before = JSON.stringify(game.ball);
P.advanceGame(game, -1);
P.advanceGame(game, NaN);
P.advanceGame(game, Infinity);
check("negative, NaN and infinite steps are ignored", JSON.stringify(game.ball) === before, before);

console.log("\n" + passed + " checks passed");
