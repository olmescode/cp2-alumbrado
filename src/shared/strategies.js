import Config from './config.js';
import StateMachine from './stateMachine.js';

const fixed = (brightness) => ({ state: brightness > 0 ? 'Fixed' : 'Off', brightness });

const scheduledLevel = (time) => {
  const hour = (Config.NIGHT_START_HOUR + Math.floor(time / 3600)) % 24;
  return hour >= 23 || hour < 5 ? 0.5 : 1;
};

const Strategies = {
  permanent: (pole, time, plans, isNight) => fixed(isNight ? 1 : 0),
  scheduled: (pole, time, plans, isNight) => fixed(isNight ? scheduledLevel(time) : 0),
  adaptive: (pole, time, plans, isNight) => {
    const state = StateMachine.stateAt(plans.map((plan) => plan[pole]), time, isNight);
    return { state, brightness: StateMachine.BRIGHTNESS[state] };
  },
};

export default Strategies;
