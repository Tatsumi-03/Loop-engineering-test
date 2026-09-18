/**
 * Runs a game of Pong on a fixed logical field: ball flight, paddle motion,
 * the rival's tracking and the score.
 * Pure: a step follows from the state handed in, and every random choice
 * comes from the generator the caller injects.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PongEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULTS = {
    // Field units. The page scales this field to whatever the canvas is, so
    // the game plays the same on a phone and on a desktop.
    width: 160,
    height: 100,
    paddleWidth: 3,
    paddleHeight: 18,
    // Gap between a paddle and the wall behind it.
    paddleInset: 5,
    ballRadius: 1.6,
    // Units per second. The rival is a shade slower than the player, which is
    // what leaves the game winnable.
    playerSpeed: 115,
    rivalSpeed: 80,
    serveSpeed: 70,
    maxSpeed: 150,
    // Speed multiplier per paddle hit, so a long rally keeps getting harder.
    speedGain: 1.05,
    // Steepest angle off a paddle, measured from the horizontal. Staying well
    // under a right angle keeps the ball crossing the field instead of
    // stalling between the top and bottom walls.
    maxBounceAngle: Math.PI / 3,
    // Seconds the ball rests on the centre spot after a point.
    serveDelay: 0.9,
    winningScore: 11,
  };

  // Angles the bounce may be configured down to and up to, in radians.
  const ANGLE_LIMITS = [0.05, 1.4];

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /** Pulls sizes that would divide by zero or overhang the field back in. */
  function sanitize(config) {
    // A non-finite override would spread NaN through every sum after it.
    for (const key of Object.keys(DEFAULTS)) {
      if (!Number.isFinite(config[key])) config[key] = DEFAULTS[key];
    }

    config.width = Math.max(config.width, 1);
    config.height = Math.max(config.height, 1);
    config.paddleWidth = clamp(config.paddleWidth, 0.5, config.width / 4);
    config.paddleHeight = clamp(config.paddleHeight, 1, config.height);
    config.paddleInset = clamp(config.paddleInset, 0, config.width / 4);
    config.ballRadius = clamp(config.ballRadius, 0.1, Math.min(config.width, config.height) / 4);
    config.serveSpeed = Math.max(config.serveSpeed, 1);
    config.maxSpeed = Math.max(config.maxSpeed, config.serveSpeed);
    config.speedGain = Math.max(config.speedGain, 1);
    config.maxBounceAngle = clamp(config.maxBounceAngle, ANGLE_LIMITS[0], ANGLE_LIMITS[1]);
    config.serveDelay = Math.max(config.serveDelay, 0);
    config.winningScore = Math.max(Math.floor(config.winningScore), 1);
    return config;
  }

  function createPaddle(config, left) {
    return {
      left,
      right: left + config.paddleWidth,
      y: config.height / 2,
      target: config.height / 2,
    };
  }

  /** Parks the ball on the centre spot and starts the count to the next serve. */
  function prepareServe(game, direction) {
    const { config, ball } = game;
    ball.x = config.width / 2;
    ball.y = config.height / 2;
    ball.vx = 0;
    ball.vy = 0;
    game.serveDirection = direction;
    game.serveTimer = config.serveDelay;
    game.serving = true;
  }

  /** Sends the parked ball off towards `game.serveDirection`. */
  function serve(game) {
    const { config, ball } = game;
    const angle = (game.random() * 2 - 1) * (config.maxBounceAngle / 2);
    ball.vx = game.serveDirection * config.serveSpeed * Math.cos(angle);
    ball.vy = config.serveSpeed * Math.sin(angle);
    game.serving = false;
  }

  function createGame(options) {
    const config = sanitize(Object.assign({}, DEFAULTS, options));
    const random = (options && options.random) || Math.random;

    const game = {
      config,
      random,
      ball: { x: 0, y: 0, vx: 0, vy: 0, radius: config.ballRadius },
      player: createPaddle(config, config.paddleInset),
      rival: createPaddle(config, config.width - config.paddleInset - config.paddleWidth),
      score: { player: 0, rival: 0 },
      // `serving` is true while the ball waits on the centre spot, and
      // `serveTimer` counts the seconds left of that wait. The opening serve
      // below fills all three in.
      serving: true,
      serveTimer: 0,
      serveDirection: 1,
      winner: null,
    };

    prepareServe(game, random() < 0.5 ? -1 : 1);
    return game;
  }

  /** Puts the score, the ball and both paddles back to their opening state. */
  function resetGame(game) {
    const centre = game.config.height / 2;
    game.score.player = 0;
    game.score.rival = 0;
    game.winner = null;
    game.player.y = centre;
    game.player.target = centre;
    game.rival.y = centre;
    game.rival.target = centre;
    prepareServe(game, game.random() < 0.5 ? -1 : 1);
    return game;
  }

  /** Points the player's paddle at field row `y`; it still travels at its own speed. */
  function aimPlayer(game, y) {
    if (!Number.isFinite(y)) return game;
    const half = game.config.paddleHeight / 2;
    game.player.target = clamp(y, half, game.config.height - half);
    return game;
  }

  /** Slides `paddle` towards its target, covering at most `speed * seconds`. */
  function movePaddle(paddle, speed, seconds, config) {
    const half = config.paddleHeight / 2;
    const goal = clamp(paddle.target, half, config.height - half);
    const reach = Math.max(speed, 0) * seconds;
    paddle.y = clamp(paddle.y, half, config.height - half);
    paddle.y += clamp(goal - paddle.y, -reach, reach);
  }

  /**
   * The rival chases the ball once it has crossed into its half, and drifts
   * back to the centre the rest of the time. Its speed cap, not its aim, is
   * what decides how hard it is to beat.
   */
  function aimRival(game) {
    const { config, ball } = game;
    const approaching = ball.vx > 0 && ball.x > config.width / 4;
    game.rival.target = approaching ? ball.y : config.height / 2;
  }

  function scorePoint(game, scorer) {
    const { config, ball } = game;
    game.score[scorer] += 1;

    if (game.score[scorer] >= config.winningScore) {
      game.winner = scorer;
      game.serving = false;
      game.serveTimer = 0;
      ball.x = config.width / 2;
      ball.y = config.height / 2;
      ball.vx = 0;
      ball.vy = 0;
      return;
    }

    // The side that just conceded receives, so play restarts on their half.
    prepareServe(game, scorer === "player" ? 1 : -1);
  }

  /**
   * Bounces the ball off `paddle` when its path crossed the paddle's face
   * during this step. `exit` is the x direction the ball leaves in: +1 for
   * the player's paddle on the left, -1 for the rival's on the right.
   * Testing the crossing rather than the overlap means even a ball that
   * outran the paddle's thickness in one step is caught.
   * Returns true when the paddle hit the ball.
   */
  function bounceOffPaddle(game, paddle, exit, fromX, fromY) {
    const { config, ball } = game;
    const face = exit > 0 ? paddle.right : paddle.left;
    const before = fromX - exit * ball.radius;
    const after = ball.x - exit * ball.radius;

    // The leading edge has to reach the face this step, travelling inwards.
    const crossed = exit > 0 ? before > face && after <= face : before < face && after >= face;
    if (!crossed) return false;

    const progress = (face - before) / (after - before);
    const hitY = fromY + (ball.y - fromY) * progress;
    if (Math.abs(hitY - paddle.y) > config.paddleHeight / 2 + ball.radius) return false;

    // Where the ball met the paddle sets the angle: the middle sends it back
    // flat, the tips send it away steeply.
    const offset = clamp((hitY - paddle.y) / (config.paddleHeight / 2), -1, 1);
    const angle = offset * config.maxBounceAngle;
    const speed = Math.min(Math.hypot(ball.vx, ball.vy) * config.speedGain, config.maxSpeed);

    ball.x = face + exit * ball.radius;
    ball.y = hitY;
    ball.vx = exit * speed * Math.cos(angle);
    ball.vy = speed * Math.sin(angle);
    return true;
  }

  /** Flies the ball for `seconds`, off the walls, the paddles or out of play. */
  function moveBall(game, seconds) {
    const { config, ball } = game;
    const fromX = ball.x;
    const fromY = ball.y;

    ball.x += ball.vx * seconds;
    ball.y += ball.vy * seconds;

    if (!bounceOffPaddle(game, game.player, 1, fromX, fromY)) {
      bounceOffPaddle(game, game.rival, -1, fromX, fromY);
    }

    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    } else if (ball.y + ball.radius > config.height) {
      ball.y = config.height - ball.radius;
      ball.vy = -Math.abs(ball.vy);
    }

    if (ball.x + ball.radius < 0) scorePoint(game, "rival");
    else if (ball.x - ball.radius > config.width) scorePoint(game, "player");
  }

  /** Plays `seconds` of the game. A won game holds still until it is reset. */
  function advanceGame(game, seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0 || game.winner !== null) return game;
    const { config } = game;

    aimRival(game);
    movePaddle(game.player, config.playerSpeed, seconds, config);
    movePaddle(game.rival, config.rivalSpeed, seconds, config);

    if (game.serving) {
      game.serveTimer -= seconds;
      if (game.serveTimer > 0) return game;
      // Play out whatever is left of the step with the ball on its way.
      seconds = -game.serveTimer;
      game.serveTimer = 0;
      serve(game);
      if (seconds <= 0) return game;
    }

    moveBall(game, seconds);
    return game;
  }

  return { createGame, advanceGame, aimPlayer, resetGame, DEFAULTS };
});
