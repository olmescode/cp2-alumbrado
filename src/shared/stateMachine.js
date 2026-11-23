import Config from './config.js';

const BRIGHTNESS = { Off: 0, Base: Config.BASE_LEVEL, Hold: 1, Active: 1 };
const PRIORITY = ['Off', 'Base', 'Hold', 'Active'];

const strongest = (states) => states.reduce((best, state) => (PRIORITY.indexOf(state) > PRIORITY.indexOf(best) ? state : best), 'Off');

const windowState = (window, time) => {
  if (time < window.activeFrom || time >= window.baseAt) return 'Base';
  return time < window.holdFrom ? 'Active' : 'Hold';
};

const StateMachine = {
  BRIGHTNESS,
  strongest,
  isNight: (ldrPercent, wasNight) => (wasNight ? ldrPercent <= Config.DAY_THRESHOLD : ldrPercent < Config.NIGHT_THRESHOLD),
  stateAt: (windows, time, isNight) => (isNight ? strongest(['Base', ...windows.map((window) => windowState(window, time))]) : 'Off'),
};

export default StateMachine;
