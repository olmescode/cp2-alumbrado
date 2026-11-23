import Config from '/shared/config.js';
import Energy from '/shared/energy.js';
import NightSimulator from '/shared/nightSimulator.js';
import Scenarios from '/shared/scenarios.js';
import StateMachine from '/shared/stateMachine.js';
import StreetGraph from '/shared/streetGraph.js';
import Labels from '../labels.js';
import Store from './store.js';

const PUBLISH_EVERY_MS = 100;
const MANUAL_ROUTES = { A1: [Config.ROUTES[0], Config.ROUTES[2]], B3: [Config.ROUTES[1], Config.ROUTES[3]] };

const routeLength = (route) => {
  const arrivals = StreetGraph.routeArrivals(route, 0);
  return arrivals[arrivals.length - 1].time;
};

const LocalSimulation = {
  time: 0,
  energy: 0,
  isNight: true,
  walkers: [],
  plans: [],
  samples: [],
  manualCount: 0,
  lastFrame: 0,
  lastPublish: 0,

  reset: () => {
    const walkers = Scenarios.walkers(Config.SCENARIOS[Store.state.scenario]);
    Object.assign(LocalSimulation, { time: 0, energy: 0, samples: [], walkers: [], plans: [] });
    walkers.forEach(LocalSimulation.addWalker);
    LocalSimulation.publish();
  },

  addWalker: (walker) => {
    LocalSimulation.walkers.push({ ...walker, endTime: walker.startTime + routeLength(walker.route) });
    LocalSimulation.plans.push(NightSimulator.planSpan(StreetGraph.lightWavePlan(walker.route[0], walker.startTime)));
  },

  addPerson: (entrance) => {
    const routes = MANUAL_ROUTES[entrance];
    LocalSimulation.manualCount += 1;
    LocalSimulation.addWalker({ startTime: LocalSimulation.time, route: routes[LocalSimulation.manualCount % routes.length] });
    LocalSimulation.publish();
  },

  poles: (time) => {
    const relevant = LocalSimulation.plans.filter((span) => span.start <= time && time < span.end);
    return NightSimulator.snapshot(Store.state.strategy, relevant.map((span) => span.plan), time, LocalSimulation.isNight);
  },

  advance: (seconds) => {
    const target = Math.min(LocalSimulation.time + seconds, Config.NIGHT_SECONDS);
    LocalSimulation.isNight = StateMachine.isNight(Store.state.ldrPercent, LocalSimulation.isNight);
    while (LocalSimulation.time < target) {
      const step = Math.min(1, target - LocalSimulation.time);
      const poles = LocalSimulation.poles(LocalSimulation.time);
      const power = poles.reduce((total, pole) => total + Energy.power(pole.brightness), 0);
      const minuteBefore = Math.floor(LocalSimulation.time / 60);
      LocalSimulation.energy += (power * step) / 3600;
      LocalSimulation.time += step;
      if (Math.floor(LocalSimulation.time / 60) > minuteBefore) LocalSimulation.samples.push({ label: Labels.clock(LocalSimulation.time), power, energy: LocalSimulation.energy });
    }
    if (LocalSimulation.time >= Config.NIGHT_SECONDS) Store.state.playing = false;
  },

  publish: () => {
    const time = LocalSimulation.time;
    const poles = LocalSimulation.poles(time);
    const walking = LocalSimulation.walkers.filter((walker) => walker.startTime <= time && time < walker.endTime);
    Store.set({
      source: 'simulation',
      clock: Labels.clock(time),
      isNight: LocalSimulation.isNight,
      poles,
      walkers: walking.map((walker) => ({ route: walker.route, meters: (time - walker.startTime) * Config.WALKING_SPEED })),
      unit: 'W',
      power: poles.reduce((total, pole) => total + Energy.power(pole.brightness), 0),
      energy: LocalSimulation.energy,
      samples: LocalSimulation.samples,
      progress: time / Config.NIGHT_SECONDS,
    });
  },

  frame: (now) => {
    const elapsed = Math.min((now - LocalSimulation.lastFrame) / 1000, 0.25);
    LocalSimulation.lastFrame = now;
    if (Store.state.mode === 'simulation' && Store.state.playing) LocalSimulation.advance(elapsed * Store.state.speed);
    if (Store.state.mode === 'simulation' && now - LocalSimulation.lastPublish > PUBLISH_EVERY_MS) {
      LocalSimulation.lastPublish = now;
      LocalSimulation.publish();
    }
    requestAnimationFrame(LocalSimulation.frame);
  },

  start: () => {
    LocalSimulation.reset();
    requestAnimationFrame(LocalSimulation.frame);
  },
};

export default LocalSimulation;
