import { mkdirSync, writeFileSync } from 'node:fs';
import Config from '../src/shared/config.js';
import NightSimulator from '../src/shared/nightSimulator.js';

const folder = new URL('../data/results/', import.meta.url);
const scenarios = { empty: 0, ...Config.SCENARIOS };
const runs = Object.entries(scenarios).flatMap(([scenario, people]) => NightSimulator.compare(people).map((run) => ({ scenario, ...run })));

const clock = (minute) => {
  const hour = (Config.NIGHT_START_HOUR + Math.floor(minute / 60)) % 24;
  return `${String(hour).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
};

const summary = runs.map((run) => [run.strategy, run.scenario, run.people, run.energyWh.toFixed(2), run.savingsPercent.toFixed(2), run.serviceLevel.toFixed(2), run.switchOns]);
const header = 'strategy,scenario,people,energyWh,savingsPercent,serviceLevel,switchOns';
const seriesHeader = ['minute', 'clock', ...runs.map((run) => `${run.strategy}_${run.scenario}`)].join(',');
const seriesRows = runs[0].powerPerMinute.map((_, minute) => [minute, clock(minute), ...runs.map((run) => run.powerPerMinute[minute].toFixed(2))].join(','));

mkdirSync(folder, { recursive: true });
writeFileSync(new URL('results.csv', folder), [header, ...summary.map((row) => row.join(','))].join('\n'));
writeFileSync(new URL('power_per_minute.csv', folder), [seriesHeader, ...seriesRows].join('\n'));
writeFileSync(new URL('results.json', folder), JSON.stringify({ parameters: Config, runs }, null, 2));
console.table(runs.map(({ strategy, scenario, energyWh, savingsPercent, serviceLevel, switchOns }) => ({ strategy, scenario, energyWh, savingsPercent, serviceLevel, switchOns })));
