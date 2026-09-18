const P = require("./pong-engine.js");

let seed = 42;
const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

const FRAME = 1 / 60;
const newGame = (options) => P.createGame(Object.assign({ random }, options));

/** Plays `seconds` frame by frame, checking the game never leaves its field. */
function playFrames(game, seconds, aim) {
  const { width, height, paddleHeight, maxSpeed } = game.config;
  const half = paddleHeight / 2;
  const radius = game.ball.radius;
  const slack = 1e-9;

  for (let elapsed = 0; elapsed < seconds; elapsed += FRAME) {
    if (aim) aim(game);
    P.advanceGame(game, FRAME);

    const { x, y, vx, vy } = game.ball;
    const speed = Math.hypot(vx, vy);
    if (!Number.isFinite(x + y + vx + vy)) throw new Error("ball state went non-finite");
    if (x + radius < -slack || x - radius > width + slack) throw new Error("ball left the field at x " + x);
    if (y - radius < -slack || y + radius > height + slack) throw new Error("ball left the field at y " + y);
    if (speed > maxSpeed + slack) throw new Error("ball past the speed cap at " + speed);
    if (!game.serving && Math.abs(vx) < speed * 0.4) throw new Error("ball stalled between the walls");
    for (const paddle of [game.player, game.rival]) {
      if (paddle.y < half - slack || paddle.y > height - half + slack) throw new Error("paddle left the field at " + paddle.y);
    }
  }
  return game;
}

/** A game with the ball already in play, so a test can place it by hand. */
function inPlay(options) {
  const game = newGame(Object.assign({ serveDelay: 0 }, options));
  P.advanceGame(game, 1e-6);
  return game;
}

const game = newGame();
console.log("opening score:", JSON.stringify(game.score), "winner:", game.winner);
console.log("ball parked on the centre spot:", game.ball.x === 80 && game.ball.y === 50 && game.ball.vx === 0);
console.log("serve goes left or right:", Math.abs(game.serveDirection) === 1);
console.log("paddles face each other:", game.player.right, "<", game.rival.left, "=", game.player.right < game.rival.left);

P.advanceGame(game, 0.5);
console.log("still parked mid-delay:", game.serving, "timer", game.serveTimer.toFixed(2));
P.advanceGame(game, 0.5);
console.log("served after the delay at", Math.hypot(game.ball.vx, game.ball.vy).toFixed(2), "units/s towards the", game.ball.vx > 0 ? "rival" : "player");

// A player who keeps the paddle on the ball plays out long rallies.
const rally = playFrames(newGame(), 120, (g) => P.aimPlayer(g, g.ball.y));
console.log("120s of tracking play:", JSON.stringify(rally.score), "winner:", rally.winner);

// Where the ball meets the paddle sets the angle it leaves at.
const angles = [];
for (const offset of [-9, 0, 9]) {
  const hit = inPlay();
  hit.player.y = 50;
  hit.player.target = 50;
  Object.assign(hit.ball, { x: 20, y: 50 + offset, vx: -70, vy: 0 });
  P.advanceGame(hit, 0.2);
  angles.push("hit " + offset + " from centre -> " + (Math.atan2(hit.ball.vy, hit.ball.vx) * 180 / Math.PI).toFixed(1) + " degrees at " + Math.hypot(hit.ball.vx, hit.ball.vy).toFixed(1) + " units/s");
}
console.log(angles.join("\n"));

// A missed ball is a point, and the winning score ends the game.
const point = inPlay({ winningScore: 1 });
Object.assign(point.ball, { x: 3, y: 50, vx: -70, vy: 0 });
P.advanceGame(point, 0.2);
console.log("ball past the wall scores:", JSON.stringify(point.score), "winner:", point.winner);
const frozen = JSON.stringify(point.ball);
P.advanceGame(point, 5);
console.log("a won game holds still:", JSON.stringify(point.ball) === frozen);
P.resetGame(point);
console.log("reset clears the board:", JSON.stringify(point.score), "winner:", point.winner, "ball at", point.ball.x, point.ball.y);

// Aiming is clamped to the field, and junk input is ignored.
const aim = newGame();
P.aimPlayer(aim, -500);
console.log("aim clamped low:", aim.player.target);
P.aimPlayer(aim, 500);
console.log("aim clamped high:", aim.player.target);
const kept = aim.player.target;
P.aimPlayer(aim, NaN);
console.log("NaN aim ignored:", aim.player.target === kept);

// A degenerate field must not produce NaN geometry.
const tiny = P.createGame({ width: 0, height: 0, paddleHeight: 999, ballRadius: 50, serveDelay: 0, random });
playFrames(tiny, 5);
console.log("degenerate field:", tiny.config.width + "x" + tiny.config.height, "paddle", tiny.config.paddleHeight, "ball radius", tiny.config.ballRadius, "at", tiny.ball.x.toFixed(2), tiny.ball.y.toFixed(2));

// Time only runs forwards.
const before = JSON.stringify(game.ball);
P.advanceGame(game, -1);
P.advanceGame(game, NaN);
console.log("negative and NaN steps ignored:", JSON.stringify(game.ball) === before);
