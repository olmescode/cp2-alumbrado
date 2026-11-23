import Config from '/shared/config.js';
import StreetGraph from '/shared/streetGraph.js';
import Labels from '../labels.js';

const Dijkstra = {
  origin: 'A1',

  start: () => {
    const element = document.getElementById('dijkstra');
    element.addEventListener('click', (event) => {
      const origin = event.target.dataset.origin;
      if (!origin) return;
      Dijkstra.origin = origin;
      Dijkstra.render();
    });
    Dijkstra.render();
  },

  render: () => {
    const { iterations, distances } = StreetGraph.dijkstra(StreetGraph.graph, Dijkstra.origin);
    const visited = [];
    const rows = iterations.map((iteration, index) => {
      visited.push(iteration.visited);
      const cells = Config.POLES.map((pole) => {
        const distance = iteration.distances[pole];
        return `<td class="number">${visited.includes(pole) ? '✔ ' : ''}${distance === Infinity ? '∞' : distance}</td>`;
      });
      return `<tr><td>${index + 1}</td><td><strong>${iteration.visited}</strong></td>${cells.join('')}</tr>`;
    });
    const arrivals = Config.POLES.map((pole) => `<td class="number">${Labels.number(distances[pole] / Config.WALKING_SPEED, 1)} s</td>`);
    const options = ['A1', 'B3'].map((origin) => `<button data-origin="${origin}" aria-selected="${origin === Dijkstra.origin}">Entra por ${origin}</button>`);
    const headers = Config.POLES.map((pole) => `<th class="number">${pole}</th>`);
    document.getElementById('dijkstra').innerHTML = `
      <h2>Ruta más corta (Dijkstra)</h2>
      <p class="hint">Distancias en metros desde la entrada. Con ellas se calcula cuándo llega la persona a cada poste a 1,4 m/s, y el poste se enciende ${Config.ANTICIPATION_TIME} s antes.</p>
      <div class="segmented">${options.join('')}</div>
      <div class="table-scroll"><table>
        <thead><tr><th>Paso</th><th>Visitado</th>${headers.join('')}</tr></thead>
        <tbody>${rows.join('')}<tr><td colspan="2">Llegada</td>${arrivals.join('')}</tr></tbody>
      </table></div>`;
  },
};

export default Dijkstra;
