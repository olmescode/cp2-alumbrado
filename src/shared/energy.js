import Config from './config.js';

function power(brightness, intercept = Config.POWER_INTERCEPT, slope = Config.POWER_SLOPE) {
  return intercept + slope * brightness;
}

function energy(powers, timeStep = 1) {
  let total = 0;
  for (const watts of powers) {
    total += watts * timeStep;
  }
  return total / 3600;
}

function realScale(milliwatts) {
  return (milliwatts * Config.POWER_SLOPE) / Config.LED_FULL_MW;
}

function linearRegression(points) {
  const count = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;
  for (const [x, y] of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }
  const spreadX = count * sumXX - sumX * sumX;
  const spreadY = count * sumYY - sumY * sumY;
  const covariance = count * sumXY - sumX * sumY;
  return {
    intercept: (sumXX * sumY - sumXY * sumX) / spreadX,
    slope: covariance / spreadX,
    r2: (covariance * covariance) / (spreadX * spreadY),
  };
}

const Energy = { power, energy, realScale, linearRegression };

export default Energy;
