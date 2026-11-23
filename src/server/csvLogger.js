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
    const key = `${reading.strategy}_${reading.mode}`;
    if (key !== CsvLogger.key) {
      const localTime = new Date().toLocaleString('sv');
      const stamp = localTime.replace(/\D/g, '');
      CsvLogger.key = key;
      CsvLogger.file = `test_${key}_${stamp}.csv`;
      mkdirSync(folder, { recursive: true });
      appendFileSync(new URL(CsvLogger.file, folder), `${COLUMNS.join(',')}\n`);
    }
    const cells = COLUMNS.map((column) => [reading[column]].flat().join(';'));
    appendFileSync(new URL(CsvLogger.file, folder), `${cells.join(',')}\n`);
  },

  list: () => {
    mkdirSync(folder, { recursive: true });
    const names = readdirSync(folder).filter((name) => name.endsWith('.csv'));
    return names.map((name) => ({ name, bytes: statSync(new URL(name, folder)).size })).reverse();
  },
};

export default CsvLogger;
