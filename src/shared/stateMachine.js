import Config from './config.js';

const BRIGHTNESS = { Off: 0, Base: Config.BASE_LEVEL, Hold: 1, Active: 1 };
const PRIORITY = ['Off', 'Base', 'Hold', 'Active'];

function strongest(first, second) {
  if (PRIORITY.indexOf(second) > PRIORITY.indexOf(first)) return second;
  return first;
}

function windowState(window, time) {
  if (time < window.activeFrom || time >= window.baseAt) return 'Base';
  if (time < window.holdFrom) return 'Active';
  return 'Hold';
}

function isNight(ldrPercent, wasNight) {
  if (wasNight) return ldrPercent <= Config.DAY_THRESHOLD;
  return ldrPercent < Config.NIGHT_THRESHOLD;
}

function stateAt(windows, time, night) {
  if (!night) return 'Off';
  let state = 'Base';
  for (const window of windows) {
    state = strongest(state, windowState(window, time));
  }
  return state;
}

const StateMachine = { BRIGHTNESS, isNight, stateAt };

export default StateMachine;
