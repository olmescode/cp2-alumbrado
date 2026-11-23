const Config = {
  POLES: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'],
  ENTRANCES: { pirA: 'A1', pirB: 'B3' },
  STREETS: [
    ['A1', 'A2', 30],
    ['A2', 'A3', 30],
    ['A2', 'B1', 30],
    ['B1', 'B2', 30],
    ['B2', 'B3', 30],
  ],
  ROUTES: [
    ['A1', 'A2', 'B1', 'B2', 'B3'],
    ['B3', 'B2', 'B1', 'A2', 'A1'],
    ['A1', 'A2', 'A3'],
    ['B3', 'B2', 'B1', 'A2', 'A3'],
  ],
  BASE_LEVEL: 0.2,
  HOLD_TIME: 30,
  ANTICIPATION_TIME: 10,
  WALKING_SPEED: 1.4,
  NIGHT_THRESHOLD: 30,
  DAY_THRESHOLD: 40,
  POWER_INTERCEPT: 0,
  POWER_SLOPE: 100,
  LED_FULL_MW: 90,
  NIGHT_START_HOUR: 18,
  NIGHT_SECONDS: 12 * 3600,
  HOURLY_SHARE: [20, 20, 15, 15, 10, 6, 4, 2, 1, 1, 2, 4],
  SCENARIOS: { quiet: 5, normal: 20, busy: 60 },
  STRATEGIES: ['permanent', 'scheduled', 'adaptive'],
};

export default Config;
