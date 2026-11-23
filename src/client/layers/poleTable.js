import Config from '/shared/config.js';
import Labels from '../labels.js';
import Store from '../services/store.js';

const PoleTable = {
  start: () => Store.subscribe(PoleTable.render),

  render: (state) => {
    const rows = state.poles.map((pole, index) => `<tr>
      <td><strong>${Config.POLES[index]}</strong></td>
      <td>${Labels.states[pole.state]}</td>
      <td class="number"><span class="level" style="width:${pole.brightness * 60}px"></span>${Math.round(pole.brightness * 100)} %</td>
    </tr>`);
    document.getElementById('pole-table').innerHTML = `
      <h2>Estado de cada poste</h2>
      <p class="hint">Apagada de día, Base al 20 % de noche, Activa al 100 % antes de que llegue la persona y Retención al 100 % durante ${Config.HOLD_TIME} s después.</p>
      <div class="table-scroll"><table>
        <thead><tr><th>Poste</th><th>Estado</th><th class="number">Brillo</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table></div>`;
  },
};

export default PoleTable;
