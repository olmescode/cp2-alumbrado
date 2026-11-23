import Config from './config.js';
import Energy from './energy.js';
import Scenarios from './scenarios.js';
import Strategies from './strategies.js';
import StreetGraph from './streetGraph.js';

function planSpan(plan) {
  let start = Infinity;
  let end = 0;
  for (const window of Object.values(plan)) {
    start = Math.min(start, window.activeFrom);
    end = Math.max(end, window.baseAt);
  }
  return { plan, start, end };
}

function activePlans(spans, time) {
  const plans = [];
  for (const span of spans) {
    if (span.start <= time && time < span.end) plans.push(span.plan);
  }
  return plans;
}

function clock(seconds) {
  const minutes = Math.floor(seconds / 60);
  const hour = (Config.NIGHT_START_HOUR + Math.floor(minutes / 60)) % 24;
  const minute = minutes % 60;
  return `${hour < 10 ? '0' : ''}${hour}:${minute < 10 ? '0' : ''}${minute}`;
}

function snapshot(strategy, plans, time, night = true) {
  const poles = [];
  for (const pole of Config.POLES) {
    poles.push(Strategies[strategy](pole, time, plans, night));
  }
  return poles;
}

function totalPower(poles) {
  let watts = 0;
  for (const pole of poles) {
    watts += Energy.power(pole.brightness);
  }
  return watts;
}

function isServed(strategy, walker, plans) {
  for (const { pole, time } of StreetGraph.routeArrivals(walker.route, walker.startTime)) {
    if (Strategies[strategy](pole, time, plans, true).brightness < 1) return false;
  }
  return true;
}

function minuteAverages(powers) {
  const averages = [];
  for (let start = 0; start < powers.length; start += 60) {
    let sum = 0;
    for (let second = start; second < start + 60; second++) {
      sum += powers[second];
    }
    averages.push(sum / 60);
  }
  return averages;
}

function simulate(strategy, people) {
  const walkers = Scenarios.walkers(people);
  const plans = [];
  const spans = [];
  for (const walker of walkers) {
    const plan = StreetGraph.lightWavePlan(walker.route[0], walker.startTime);
    plans.push(plan);
    spans.push(planSpan(plan));
  }
  const powers = [];
  const previous = [0, 0, 0, 0, 0, 0];
  let switchOns = 0;
  for (let time = 0; time < Config.NIGHT_SECONDS; time++) {
    const poles = snapshot(strategy, activePlans(spans, time), time);
    for (let index = 0; index < poles.length; index++) {
      if (poles[index].brightness >= 1 && previous[index] < 1) switchOns += 1;
      previous[index] = poles[index].brightness;
    }
    powers.push(totalPower(poles));
  }
  let served = 0;
  for (const walker of walkers) {
    if (isServed(strategy, walker, plans)) served += 1;
  }
  return {
    strategy,
    people,
    energyWh: Energy.energy(powers),
    serviceLevel: walkers.length > 0 ? (100 * served) / walkers.length : 100,
    switchOns,
    powerPerMinute: minuteAverages(powers),
  };
}

function compare(people) {
  const runs = [];
  for (const strategy of Config.STRATEGIES) {
    runs.push(simulate(strategy, people));
  }
  for (const run of runs) {
    run.savingsPercent = 100 * (1 - run.energyWh / runs[0].energyWh);
  }
  return runs;
}

const NightSimulator = { planSpan, activePlans, clock, snapshot, totalPower, simulate, compare };

export default NightSimulator;
