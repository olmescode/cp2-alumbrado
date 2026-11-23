import Config from './config.js';
import StateMachine from './stateMachine.js';

function fixed(brightness) {
  return { state: brightness > 0 ? 'Fixed' : 'Off', brightness };
}

function scheduledLevel(time) {
  const hour = (Config.NIGHT_START_HOUR + Math.floor(time / 3600)) % 24;
  if (hour >= 23 || hour < 5) return 0.5;
  return 1;
}

function permanent(pole, time, plans, night) {
  return fixed(night ? 1 : 0);
}

function scheduled(pole, time, plans, night) {
  return fixed(night ? scheduledLevel(time) : 0);
}

function adaptive(pole, time, plans, night) {
  const windows = [];
  for (const plan of plans) {
    windows.push(plan[pole]);
  }
  const state = StateMachine.stateAt(windows, time, night);
  return { state, brightness: StateMachine.BRIGHTNESS[state] };
}

const Strategies = { permanent, scheduled, adaptive };

export default Strategies;
