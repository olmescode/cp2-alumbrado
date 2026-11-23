import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import Energy from '../shared/energy.js';
import NightSimulator from '../shared/nightSimulator.js';

const DATA_FOLDER = new URL('../../data/', import.meta.url);
const NIGHTS_FOLDER = new URL('nights/', DATA_FOLDER);
const NIGHTS_FILE = new URL('nights.json', DATA_FOLDER);
const CALIBRATION_FILE = new URL('calibration.json', DATA_FOLDER);
const MAX_STEP_SECONDS = 2;
const MINIMUM_NIGHT_SECONDS = 5;
const COLUMNS = ['time', 'clock', 'strategy', 'mode', 'isNight', 'ldrPercent', 'pirA', 'pirB', 'brightness', 'states', 'currentMa', 'voltage', 'powerMw'];
const SUMMARY_COLUMNS = ['source', 'startedAt', 'strategy', 'scenario', 'people', 'seconds', 'energyWh', 'averagePowerW', 'switchOns', 'serviceLevel'];

const Session = {
  night: null,
  calibration: null,
  lastReadingAt: 0,
  previousPir: { pirA: 0, pirB: 0 },
  previousBrightness: [0, 0, 0, 0, 0, 0],
};

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8'));
}

function localTime() {
  const now = new Date();
  return now.toLocaleString('sv');
}

function preciseTime() {
  const now = new Date();
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  return `${now.toLocaleString('sv')}.${milliseconds}`;
}

function csvRow(reading) {
  const cells = [preciseTime()];
  for (const column of COLUMNS.slice(1)) {
    const cell = reading[column];
    cells.push(Array.isArray(cell) ? cell.join(';') : cell);
  }
  return `${cells.join(',')}\n`;
}

function saveNight(night) {
  const nights = readJson(NIGHTS_FILE, []);
  nights.push(night);
  mkdirSync(DATA_FOLDER, { recursive: true });
  writeFileSync(NIGHTS_FILE, JSON.stringify(nights, null, 2));
}

function startNight(reading) {
  const startedAt = localTime();
  const file = `night_${startedAt.replace(/\D/g, '')}.csv`;
  Session.night = { source: 'maqueta', startedAt, file, strategy: reading.strategy, mixedStrategies: false, seconds: 0, energyWh: 0, people: 0, switchOns: 0 };
  mkdirSync(NIGHTS_FOLDER, { recursive: true });
  appendFileSync(new URL(file, NIGHTS_FOLDER), `${COLUMNS.join(',')}\n`);
}

function finishNight() {
  const night = Session.night;
  Session.night = null;
  if (night.seconds < MINIMUM_NIGHT_SECONDS) return;
  saveNight({ ...night, averagePowerW: (night.energyWh * 3600) / night.seconds });
}

function countDetections(reading) {
  let detections = 0;
  for (const sensor of ['pirA', 'pirB']) {
    if (reading[sensor] === 1 && Session.previousPir[sensor] === 0) detections += 1;
    Session.previousPir[sensor] = reading[sensor];
  }
  return detections;
}

function countSwitchOns(reading) {
  let switchOns = 0;
  for (let pole = 0; pole < reading.brightness.length; pole++) {
    if (reading.brightness[pole] >= 100 && Session.previousBrightness[pole] < 100) switchOns += 1;
    Session.previousBrightness[pole] = reading.brightness[pole];
  }
  return switchOns;
}

function addToNight(reading, seconds) {
  const night = Session.night;
  night.people += countDetections(reading);
  if (reading.strategy !== night.strategy) night.mixedStrategies = true;
  if (reading.mode === 'auto') {
    night.switchOns += countSwitchOns(reading);
    night.seconds += seconds;
    night.energyWh += (Energy.realScale(reading.powerMw) * seconds) / 3600;
  }
  appendFileSync(new URL(night.file, NIGHTS_FOLDER), csvRow(reading));
}

function addToCalibration(reading) {
  const level = reading.brightness[0];
  const point = Session.calibration[level] || { total: 0, count: 0 };
  Session.calibration[level] = { total: point.total + reading.powerMw, count: point.count + 1 };
}

function finishCalibration() {
  const points = [];
  for (const [level, point] of Object.entries(Session.calibration)) {
    points.push([Number(level), point.total / point.count]);
  }
  Session.calibration = null;
  writeFileSync(CALIBRATION_FILE, JSON.stringify({ date: localTime(), points }, null, 2));
}

function record(reading) {
  const now = Date.now();
  const seconds = Session.lastReadingAt > 0 ? Math.min((now - Session.lastReadingAt) / 1000, MAX_STEP_SECONDS) : 0;
  Session.lastReadingAt = now;
  if (reading.mode === 'calibration') {
    Session.calibration = Session.calibration || {};
    addToCalibration(reading);
  } else if (Session.calibration) {
    finishCalibration();
  }
  if (reading.isNight && !Session.night) startNight(reading);
  if (!reading.isNight && Session.night) finishNight();
  if (Session.night) addToNight(reading, seconds);
  return Session.night;
}

function recordSimulation(run) {
  saveNight({
    source: 'simulacion',
    startedAt: localTime(),
    strategy: run.strategy,
    scenario: run.scenario,
    people: run.people,
    seconds: 12 * 3600,
    energyWh: run.energyWh,
    averagePowerW: run.energyWh / 12,
    switchOns: run.switchOns,
    serviceLevel: run.serviceLevel,
    powerPerMinute: run.powerPerMinute,
  });
}

function nights() {
  return readJson(NIGHTS_FILE, []);
}

function calibration() {
  return readJson(CALIBRATION_FILE, { date: '', points: [] });
}

function summaryCsv() {
  const lines = [SUMMARY_COLUMNS.join(',')];
  for (const night of nights()) {
    const cells = [];
    for (const column of SUMMARY_COLUMNS) {
      cells.push(night[column] === undefined ? '' : night[column]);
    }
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

function readingsCsv() {
  const lines = [`night,${COLUMNS.join(',')}`];
  for (const night of nights()) {
    if (night.source !== 'maqueta') continue;
    const file = new URL(night.file, NIGHTS_FOLDER);
    if (!existsSync(file)) continue;
    const rows = readFileSync(file, 'utf8').split('\n');
    for (const row of rows.slice(1)) {
      if (row) lines.push(`${night.startedAt},${row}`);
    }
  }
  return lines.join('\n');
}

function calibrationCsv() {
  const lines = ['brightness,powerMw'];
  for (const [level, power] of calibration().points) {
    lines.push(`${level},${power.toFixed(2)}`);
  }
  return lines.join('\n');
}

function simulationCsv() {
  const runs = [];
  for (const night of nights()) {
    if (night.source === 'simulacion') runs.push(night);
  }
  const header = ['minute', 'clock'];
  for (let index = 0; index < runs.length; index++) {
    header.push(`${runs[index].strategy}_${runs[index].scenario}_${index + 1}`);
  }
  const lines = [header.join(',')];
  for (let minute = 0; minute < 720; minute++) {
    const row = [minute, NightSimulator.clock(minute * 60)];
    for (const run of runs) {
      row.push(run.powerPerMinute[minute].toFixed(2));
    }
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

const EXPORTS = { resumen_noches: summaryCsv, lecturas_maqueta: readingsCsv, calibracion: calibrationCsv, simulacion_por_minuto: simulationCsv };

function exportCsv(name) {
  const build = EXPORTS[name];
  return build ? build() : '';
}

const Recorder = { record, recordSimulation, nights, calibration, exportCsv };

export default Recorder;
