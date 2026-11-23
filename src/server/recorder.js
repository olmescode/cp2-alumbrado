import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const DATA_FOLDER = new URL('../../data/', import.meta.url);
const NIGHTS_FOLDER = new URL('nights/', DATA_FOLDER);
const NIGHTS_FILE = new URL('nights.json', DATA_FOLDER);
const CALIBRATION_FILE = new URL('calibration.json', DATA_FOLDER);
const MAX_STEP_SECONDS = 2;
const MINIMUM_NIGHT_SECONDS = 5;
const COLUMNS = ['time', 'clock', 'strategy', 'mode', 'ldrPercent', 'pirA', 'pirB', 'brightness', 'states', 'currentMa', 'voltage', 'powerMw'];

const Session = {
  night: null,
  calibration: null,
  lastReadingAt: 0,
  previousPir: { pirA: 0, pirB: 0 },
};

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8'));
}

function localTime() {
  const now = new Date();
  return now.toLocaleString('sv');
}

function csvRow(reading) {
  const cells = [localTime()];
  for (const column of COLUMNS.slice(1)) {
    const cell = reading[column];
    cells.push(Array.isArray(cell) ? cell.join(';') : cell);
  }
  return `${cells.join(',')}\n`;
}

function startNight(reading) {
  const startedAt = localTime();
  const file = `night_${startedAt.replace(/\D/g, '')}.csv`;
  Session.night = { startedAt, file, strategy: reading.strategy, mixedStrategies: false, seconds: 0, energyMwh: 0, people: 0 };
  mkdirSync(NIGHTS_FOLDER, { recursive: true });
  appendFileSync(new URL(file, NIGHTS_FOLDER), `${COLUMNS.join(',')}\n`);
}

function finishNight() {
  const night = Session.night;
  Session.night = null;
  if (night.seconds < MINIMUM_NIGHT_SECONDS) return;
  const nights = readJson(NIGHTS_FILE, []);
  nights.push({ ...night, averagePowerMw: (night.energyMwh * 3600) / night.seconds });
  writeFileSync(NIGHTS_FILE, JSON.stringify(nights, null, 2));
}

function countDetections(reading) {
  let detections = 0;
  for (const sensor of ['pirA', 'pirB']) {
    if (reading[sensor] === 1 && Session.previousPir[sensor] === 0) detections += 1;
    Session.previousPir[sensor] = reading[sensor];
  }
  return detections;
}

function addToNight(reading, seconds) {
  const night = Session.night;
  night.people += countDetections(reading);
  if (reading.strategy !== night.strategy) night.mixedStrategies = true;
  if (reading.mode === 'auto') {
    night.seconds += seconds;
    night.energyMwh += (reading.powerMw * seconds) / 3600;
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

function nights() {
  return readJson(NIGHTS_FILE, []);
}

function calibration() {
  return readJson(CALIBRATION_FILE, { date: '', points: [] });
}

const Recorder = { record, nights, calibration };

export default Recorder;
