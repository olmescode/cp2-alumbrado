import Labels from '../labels.js';
import Store from '../services/store.js';

const REFRESH_MS = 10000;
const MODES = { live: 'En vivo', night: 'Noche acelerada', sweep: 'Barrido de brillo' };

const describe = (name) => {
  const [, strategy, mode, stamp] = name.replace('.csv', '').split('_');
  const date = `${stamp.slice(6, 8)}/${stamp.slice(4, 6)} ${stamp.slice(8, 10)}:${stamp.slice(10, 12)}`;
  return { strategy: Labels.strategies[strategy] || strategy, mode: MODES[mode] || mode, date };
};

const History = {
  start: () => {
    History.refresh();
    setInterval(() => Store.state.mode === 'live' && History.refresh(), REFRESH_MS);
  },

  refresh: async () => {
    const response = await fetch('/api/logs');
    const logs = await response.json();
    const rows = logs.map(({ name, bytes }) => {
      const test = describe(name);
      return `<tr><td>${test.date}</td><td>${test.strategy}</td><td>${test.mode}</td><td class="number">${Labels.number(bytes / 1024, 1)} KB</td><td><a href="/logs/${name}" download>Descargar CSV</a></td></tr>`;
    });
    const body = rows.length > 0 ? rows.join('') : '<tr><td colspan="5">Aún no hay pruebas. Cada prueba con la placa o el emulador se guarda aquí automáticamente.</td></tr>';
    document.getElementById('history').innerHTML = `
      <h2>Histórico de pruebas</h2>
      <div class="table-scroll"><table>
        <thead><tr><th>Fecha</th><th>Estrategia</th><th>Prueba</th><th class="number">Tamaño</th><th></th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>`;
  },
};

export default History;
