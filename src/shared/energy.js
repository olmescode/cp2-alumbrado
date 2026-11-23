import Config from './config.js';

const Energy = {
  power: (brightness, intercept = Config.POWER_INTERCEPT, slope = Config.POWER_SLOPE) => intercept + slope * brightness,

  energy: (powers, timeStep = 1) => powers.reduce((total, power) => total + power * timeStep, 0) / 3600,

  linearRegression: (points) => {
    const count = points.length;
    const sums = points.reduce(
      (total, [x, y]) => ({ x: total.x + x, y: total.y + y, xy: total.xy + x * y, xx: total.xx + x * x, yy: total.yy + y * y }),
      { x: 0, y: 0, xy: 0, xx: 0, yy: 0 },
    );
    const spreadX = count * sums.xx - sums.x ** 2;
    const spreadY = count * sums.yy - sums.y ** 2;
    const covariance = count * sums.xy - sums.x * sums.y;
    return {
      intercept: (sums.xx * sums.y - sums.xy * sums.x) / spreadX,
      slope: covariance / spreadX,
      r2: covariance ** 2 / (spreadX * spreadY),
    };
  },
};

export default Energy;
