/**
 * Projects a rotating torus onto a grid of characters.
 * Pure: the same angles always produce the same frame.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DonutRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULTS = {
    width: 80,
    height: 22,
    tubeRadius: 1,
    ringRadius: 2,
    viewerDistance: 5,
    // A character cell is about twice as tall as it is wide, so the vertical
    // scale is halved to keep the donut round instead of stretched.
    horizontalScale: 30,
    verticalScale: 15,
    thetaStep: 0.07,
    phiStep: 0.02,
    shades: ".,-~:;=!*#$@",
  };

  const TWO_PI = Math.PI * 2;

  function renderDonutFrame(angleA, angleB, options) {
    const config = Object.assign({}, DEFAULTS, options);
    const {
      width, height, tubeRadius, ringRadius, viewerDistance,
      horizontalScale, verticalScale, thetaStep, phiStep, shades,
    } = config;

    const centerCol = width / 2;
    const centerRow = height / 2;
    const cells = new Array(width * height).fill(" ");
    const depth = new Float32Array(width * height);

    const cosA = Math.cos(angleA);
    const sinA = Math.sin(angleA);
    const cosB = Math.cos(angleB);
    const sinB = Math.sin(angleB);

    for (let theta = 0; theta < TWO_PI; theta += thetaStep) {
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      const tubeOffset = ringRadius + tubeRadius * cosTheta;

      for (let phi = 0; phi < TWO_PI; phi += phiStep) {
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);

        const invZ = 1 / (sinPhi * tubeOffset * sinA + sinTheta * cosA + viewerDistance);
        const tilt = sinPhi * tubeOffset * cosA - sinTheta * sinA;

        const col = Math.trunc(centerCol + horizontalScale * invZ * (cosPhi * tubeOffset * cosB - tilt * sinB));
        const row = Math.trunc(centerRow + verticalScale * invZ * (cosPhi * tubeOffset * sinB + tilt * cosB));

        if (col < 0 || col >= width || row < 0 || row >= height) continue;

        const cell = col + width * row;
        if (invZ <= depth[cell]) continue;

        const luminance = Math.trunc(8 * (
          (sinTheta * sinA - sinPhi * cosTheta * cosA) * cosB
          - sinPhi * cosTheta * sinA
          - sinTheta * cosA
          - cosPhi * cosTheta * sinB
        ));

        depth[cell] = invZ;
        cells[cell] = shades[Math.min(Math.max(luminance, 0), shades.length - 1)];
      }
    }

    let text = "";
    let filled = 0;
    for (let row = 0; row < height; row++) {
      const line = cells.slice(row * width, (row + 1) * width);
      for (const ch of line) if (ch !== " ") filled++;
      text += line.join("") + "\n";
    }

    return { text, width, height, filled };
  }

  return { renderDonutFrame, DEFAULTS };
});
