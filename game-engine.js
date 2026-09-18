/**
 * Runs the clicking game's rules: where the red target jumps to, how long it
 * sits there before jumping on its own, and when three misses end the round.
 * Pure: every state change follows from the game handed in, and every random
 * choice comes from the generator the caller injects.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GameEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULTS = {
    // Misses allowed before the round ends.
    maxMisses: 3,
    // Milliseconds the target waits before jumping on its own, at score 0.
    startDelay: 1400,
    // The floor that wait decays to. Short, but still clickable on a phone.
    minDelay: 420,
    // Each point keeps this share of the previous wait: 1400ms at 0 points,
    // roughly half that at 10, and down on the floor from 17 on.
    speedUp: 0.93,
    // How far a jump has to travel, as a share of the play area, so the
    // target never reappears under the pointer that just clicked it.
    minJump: 0.35,
    // Spots tried per jump; the farthest one wins if none clears minJump.
    jumpAttempts: 12,
  };

  function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
  }

  function positive(value, fallback) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  /** Clamps a generator's output into the 0..1 box the play area is measured in. */
  function unit(value) {
    return Number.isFinite(value) ? clamp(value, 0, 1) : 0.5;
  }

  /** Folds the caller's options into settings the rules can do arithmetic on. */
  function settle(options) {
    const config = Object.assign({}, DEFAULTS, options);
    config.maxMisses = Math.max(1, Math.round(positive(config.maxMisses, DEFAULTS.maxMisses)));
    config.startDelay = positive(config.startDelay, DEFAULTS.startDelay);
    // A floor above the opening wait would speed the game up backwards.
    config.minDelay = Math.min(positive(config.minDelay, DEFAULTS.minDelay), config.startDelay);
    config.speedUp = Math.min(positive(config.speedUp, DEFAULTS.speedUp), 1);
    config.minJump = unit(config.minJump);
    config.jumpAttempts = Math.max(1, Math.round(positive(config.jumpAttempts, DEFAULTS.jumpAttempts)));
    return config;
  }

  /** Milliseconds the target sits still at `score` points. */
  function teleportDelay(score, config) {
    const points = Math.max(0, Math.floor(Number.isFinite(score) ? score : 0));
    return Math.max(config.minDelay, Math.round(config.startDelay * Math.pow(config.speedUp, points)));
  }

  /** What the page needs to paint the game, with nothing of its internals. */
  function snapshot(game) {
    return {
      score: game.score,
      misses: game.misses,
      remaining: Math.max(game.config.maxMisses - game.misses, 0),
      over: game.over,
      target: { x: game.target.x, y: game.target.y },
      delay: teleportDelay(game.score, game.config),
    };
  }

  function createGame(options) {
    const settings = Object.assign({}, options);
    const random = typeof settings.random === "function" ? settings.random : Math.random;
    delete settings.random;

    return {
      score: 0,
      misses: 0,
      over: false,
      // The target opens in the middle, where the first jump moves it from.
      target: { x: 0.5, y: 0.5 },
      config: settle(settings),
      random,
    };
  }

  /** Puts a finished round back to its opening state, keeping the settings. */
  function resetGame(game) {
    game.score = 0;
    game.misses = 0;
    game.over = false;
    game.target = { x: 0.5, y: 0.5 };
    return snapshot(game);
  }

  /** Jumps the target to a fresh spot, as far from the old one as the tries allow. */
  function teleport(game) {
    const { config, random } = game;
    const from = game.target;
    let best = from;
    let bestDistance = -1;

    for (let attempt = 0; attempt < config.jumpAttempts; attempt++) {
      const spot = { x: unit(random()), y: unit(random()) };
      const distance = Math.hypot(spot.x - from.x, spot.y - from.y);
      if (distance > bestDistance) {
        best = spot;
        bestDistance = distance;
      }
      if (distance >= config.minJump) break;
    }

    game.target = best;
    return best;
  }

  /** The player caught the target: a point, and a jump to the next spot. */
  function registerHit(game) {
    if (game.over) return snapshot(game);

    game.score += 1;
    teleport(game);
    return snapshot(game);
  }

  /**
   * The player missed, either by clicking empty space or by letting the wait
   * run out. The third miss ends the round and leaves the target where it is.
   */
  function registerMiss(game) {
    if (game.over) return snapshot(game);

    game.misses += 1;
    if (game.misses >= game.config.maxMisses) game.over = true;
    else teleport(game);

    return snapshot(game);
  }

  return {
    createGame,
    resetGame,
    teleport,
    registerHit,
    registerMiss,
    snapshot,
    teleportDelay,
    DEFAULTS,
  };
});
