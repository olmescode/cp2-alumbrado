import Config from '/shared/config.js';
import NightSimulator from '/shared/nightSimulator.js';
import Labels from '../labels.js';
import Store from '../services/store.js';

const cache = {};

const Comparison = {
  element: null,
  chart: null,
  drawn: '',

  start: () => {
    Comparison.element = document.getElementById('comparison');
    Comparison.element.innerHTML = `
      <h2>Comparación de estrategias</h2>
      <p class="hint" data-bind="hint"></p>
      <div class="table-scroll"><table data-bind="table"></table></div>
      <div class="chart"><canvas id="comparison-chart"></canvas></div>`;
    Comparison.chart = new Chart(document.getElementById('comparison-chart'), {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        animation: false,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } } },
        scales: { x: { ticks: { maxTicksLimit: 7 }, grid: { display: false } }, y: { beginAtZero: true, title: { display: true, text: 'W' } } },
      },
    });
    Store.subscribe(Comparison.render);
  },

  render: (state) => {
    const observedPermanent = state.observed.permanent;
    const signature = `${state.scenario}-${state.strategy}-${state.mode}-${JSON.stringify(state.observed)}`;
    if (signature === Comparison.drawn) return;
    Comparison.drawn = signature;
    cache[state.scenario] ||= NightSimulator.compare(Config.SCENARIOS[state.scenario]);
    const runs = cache[state.scenario];
    const highest = Math.max(...runs.map((run) => run.energyWh));
    const showObserved = state.mode === 'live';
    const observedSavings = (strategy) => {
      const observed = state.observed[strategy];
      if (!observed || !observedPermanent || observed.seconds < 5 || observedPermanent.seconds < 5) return 'Sin datos';
      const ratio = observed.energy / observed.seconds / (observedPermanent.energy / observedPermanent.seconds);
      return `${Labels.number(100 * (1 - ratio), 1)} %`;
    };
    const rows = runs.map((run) => `<tr data-highlight="${run.strategy === state.strategy}">
      <td><span class="swatch" style="background:${Labels.colors[run.strategy]}"></span>${Labels.strategies[run.strategy]}</td>
      <td class="number"><span class="level" style="width:${(60 * run.energyWh) / highest}px;background:${Labels.colors[run.strategy]}"></span>${Labels.number(run.energyWh, 0)} Wh</td>
      <td class="number">${Labels.number(run.savingsPercent, 1)} %</td>
      ${showObserved ? `<td class="number">${observedSavings(run.strategy)}</td>` : ''}
      <td class="number">${Labels.number(run.serviceLevel, 1)} %</td>
      <td class="number">${run.switchOns}</td>
    </tr>`);
    Comparison.element.querySelector('[data-bind="hint"]').textContent = `Una noche completa de 18:00 a 06:00 con ${Config.SCENARIOS[state.scenario]} personas (${Labels.scenarios[state.scenario].toLowerCase()}). Nivel de servicio: personas que encontraron cada poste de su recorrido al 100 %.${showObserved ? ' El ahorro observado compara la potencia media medida en la maqueta con cada estrategia.' : ''}`;
    Comparison.element.querySelector('[data-bind="table"]').innerHTML = `
      <thead><tr><th>Estrategia</th><th class="number">Energía</th><th class="number">Ahorro simulado</th>${showObserved ? '<th class="number">Ahorro observado</th>' : ''}<th class="number">Servicio</th><th class="number">Encendidos</th></tr></thead>
      <tbody>${rows.join('')}</tbody>`;
    const minutes = runs[0].powerPerMinute.map((_, minute) => Labels.clock(minute * 60));
    Comparison.chart.data.labels = minutes.filter((_, minute) => minute % 5 === 0);
    Comparison.chart.data.datasets = runs.map((run) => ({
      label: Labels.strategies[run.strategy],
      data: run.powerPerMinute.filter((_, minute) => minute % 5 === 0),
      borderColor: Labels.colors[run.strategy],
      borderWidth: run.strategy === state.strategy ? 2.5 : 1.5,
      pointRadius: 0,
      stepped: true,
    }));
    Comparison.chart.update();
  },
};

export default Comparison;
