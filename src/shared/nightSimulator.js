import Config from './config.js';
import Energy from './energy.js';
import Scenarios from './scenarios.js';
import Strategies from './strategies.js';
import StreetGraph from './streetGraph.js';

const planSpan = (plan) => {
  const windows = Object.values(plan);
  return { plan, start: Math.min(...windows.map((window) => window.activeFrom)), end: Math.max(...windows.map((window) => window.baseAt)) };
};

const NightSimulator = {
  planSpan,

  clock: (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const hour = (Config.NIGHT_START_HOUR + Math.floor(minutes / 60)) % 24;
    const minute = minutes % 60;
    return `${hour < 10 ? '0' : ''}${hour}:${minute < 10 ? '0' : ''}${minute}`;
  },

  snapshot: (strategy, plans, time, isNight = true) => Config.POLES.map((pole) => Strategies[strategy](pole, time, plans, isNight)),

  simulate: (strategy, people) => {
    const walkers = Scenarios.walkers(people);
    const plans = walkers.map((walker) => StreetGraph.lightWavePlan(walker.route[0], walker.startTime));
    const spans = plans.map(planSpan);
    const powers = [];
    let previous = Config.POLES.map(() => 0);
    let switchOns = 0;
    for (let time = 0; time < Config.NIGHT_SECONDS; time += 1) {
      const relevant = spans.filter((span) => span.start <= time && time < span.end);
      const poles = NightSimulator.snapshot(strategy, relevant.map((span) => span.plan), time);
      switchOns += poles.filter((pole, index) => pole.brightness >= 1 && previous[index] < 1).length;
      previous = poles.map((pole) => pole.brightness);
      powers.push(poles.reduce((total, pole) => total + Energy.power(pole.brightness), 0));
    }
    const served = walkers.filter((walker) => {
      const arrivals = StreetGraph.routeArrivals(walker.route, walker.startTime);
      return arrivals.every(({ pole, time }) => Strategies[strategy](pole, time, plans, true).brightness >= 1);
    });
    const powerPerMinute = Array.from({ length: powers.length / 60 }, (_, minute) => {
      const minutePowers = powers.slice(minute * 60, minute * 60 + 60);
      return minutePowers.reduce((total, power) => total + power, 0) / 60;
    });
    return {
      strategy,
      people,
      energyWh: Energy.energy(powers),
      serviceLevel: walkers.length > 0 ? (100 * served.length) / walkers.length : 100,
      switchOns,
      powerPerMinute,
    };
  },

  compare: (people) => {
    const runs = Config.STRATEGIES.map((strategy) => NightSimulator.simulate(strategy, people));
    const baseline = runs[0].energyWh;
    return runs.map((run) => ({ ...run, savingsPercent: 100 * (1 - run.energyWh / baseline) }));
  },
};

export default NightSimulator;
