import { mkdirSync, writeFileSync } from 'node:fs';
import Config from '../src/shared/config.js';
import NightSimulator from '../src/shared/nightSimulator.js';

const folder = new URL('../data/results/', import.meta.url);
const SCENARIOS = { empty: 0, ...Config.SCENARIOS };

function runAllScenarios() {
  const runs = [];
  for (const [scenario, people] of Object.entries(SCENARIOS)) {
    for (const run of NightSimulator.compare(people)) {
      runs.push({ scenario, ...run });
    }
  }
  return runs;
}

function summaryCsv(runs) {
  const lines = ['strategy,scenario,people,energyWh,savingsPercent,serviceLevel,switchOns'];
  for (const run of runs) {
    lines.push([run.strategy, run.scenario, run.people, run.energyWh.toFixed(2), run.savingsPercent.toFixed(2), run.serviceLevel.toFixed(2), run.switchOns].join(','));
  }
  return lines.join('\n');
}

function seriesCsv(runs) {
  const header = ['minute', 'clock'];
  for (const run of runs) {
    header.push(`${run.strategy}_${run.scenario}`);
  }
  const lines = [header.join(',')];
  for (let minute = 0; minute < runs[0].powerPerMinute.length; minute++) {
    const row = [minute, NightSimulator.clock(minute * 60)];
    for (const run of runs) {
      row.push(run.powerPerMinute[minute].toFixed(2));
    }
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

const runs = runAllScenarios();
mkdirSync(folder, { recursive: true });
writeFileSync(new URL('results.csv', folder), summaryCsv(runs));
writeFileSync(new URL('power_per_minute.csv', folder), seriesCsv(runs));
writeFileSync(new URL('results.json', folder), JSON.stringify({ parameters: Config, runs }, null, 2));
console.log(summaryCsv(runs));
