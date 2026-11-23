import { appendFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';

const folder = new URL('../../data/logs/', import.meta.url);
const COLUMNS = ['timeMs', 'clock', 'source', 'strategy', 'mode', 'ldrRaw', 'ldrPercent', 'isNight', 'pirA', 'pirB', 'brightness', 'states', 'currentMa', 'voltage', 'powerMw'];

const CsvLogger = {
  folder,
  file: '',
  key: '',

  reset: () => {
    CsvLogger.key = '';
  },

  write: (reading) => {
    const key = `${reading.source}_${reading.strategy}_${reading.mode}`;
    if (key !== CsvLogger.key) {
      const now = new Date();
      const localTime = now.toLocaleString('sv');
      const stamp = localTime.replace(/\D/g, '');
      CsvLogger.key = key;
      CsvLogger.file = `test_${key}_${stamp}.csv`;
      mkdirSync(folder, { recursive: true });
      appendFileSync(new URL(CsvLogger.file, folder), `${COLUMNS.join(',')}\n`);
    }
    const cells = COLUMNS.map((column) => (Array.isArray(reading[column]) ? reading[column].join(';') : reading[column]));
    appendFileSync(new URL(CsvLogger.file, folder), `${cells.join(',')}\n`);
  },

  list: () => {
    mkdirSync(folder, { recursive: true });
    const files = readdirSync(folder);
    const names = files.filter((name) => name.endsWith('.csv'));
    const logs = names.map((name) => ({ name, bytes: statSync(new URL(name, folder)).size }));
    return logs.reverse();
  },
};

export default CsvLogger;
