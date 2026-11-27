import Config from '/shared/config.js';
import Energy from '/shared/energy.js';
import StreetGraph from '/shared/streetGraph.js';
import Charts from '../charts.js';
import Connection from '../connection.js';
import Labels from '../labels.js';

const SOURCES = { simulacion: 'Simulación', maqueta: 'Maqueta' };
const SOURCE_COLORS = { simulacion: '#5e5ce6', maqueta: '#ffb340' };

const view = { element: null, savingsChart: null, regressionChart: null, origin: 'A1' };

function template() {
  return `
    <article class="card glass">
      <h2>Comparación de estrategias</h2>
      <div class="chart"><canvas data-bind="savings-chart"></canvas></div>
      <div class="table-scroll"><table data-bind="savings-table"></table></div>
    </article>
    <article class="card glass">
      <h2>Noches registradas</h2>
      <div data-bind="nights"></div>
    </article>
    <div class="columns even">
      <article class="card glass">
        <h2>Modelo de consumo</h2>
        <div class="figures" data-bind="figures"></div>
        <div class="chart"><canvas data-bind="regression-chart"></canvas></div>
      </article>
      <article class="card glass" data-bind="dijkstra"></article>
    </div>`;
}

function bind(name) {
  return view.element.querySelector(`[data-bind="${name}"]`);
}

function groupBySource(nights) {
  const groups = { simulacion: {}, maqueta: {} };
  for (const night of nights) {
    if (night.mixedStrategies) continue;
    const group = groups[night.source];
    const totals = group[night.strategy] || { power: 0, service: 0, count: 0 };
    group[night.strategy] = { power: totals.power + night.averagePowerW, service: totals.service + (night.serviceLevel || 0), count: totals.count + 1 };
  }
  return groups;
}

function savings(group, strategy) {
  if (!group[strategy] || !group.permanent) return NaN;
  const average = group[strategy].power / group[strategy].count;
  const permanent = group.permanent.power / group.permanent.count;
  return 100 * (1 - average / permanent);
}

function percentText(percent) {
  return Number.isNaN(percent) ? '—' : `${Labels.number(percent, 1)} %`;
}

function renderSavings(nights) {
  const groups = groupBySource(nights);
  const labels = [];
  for (const strategy of Config.STRATEGIES) {
    labels.push(Labels.STRATEGIES[strategy]);
  }
  const datasets = [];
  for (const source of Object.keys(SOURCES)) {
    const values = [];
    for (const strategy of Config.STRATEGIES) {
      values.push(savings(groups[source], strategy) || 0);
    }
    datasets.push({ label: SOURCES[source], data: values, backgroundColor: SOURCE_COLORS[source], borderRadius: 8 });
  }
  view.savingsChart.data.labels = labels;
  view.savingsChart.data.datasets = datasets;
  view.savingsChart.update();
  let rows = '';
  for (const strategy of Config.STRATEGIES) {
    const simulated = groups.simulacion[strategy];
    const service = simulated ? `${Labels.number(simulated.service / simulated.count, 1)} %` : '—';
    const counts = `${simulated ? simulated.count : 0} / ${groups.maqueta[strategy] ? groups.maqueta[strategy].count : 0}`;
    rows += `<tr><td><span class="swatch" style="background:${Labels.COLORS[strategy]}"></span>${Labels.STRATEGIES[strategy]}</td>
      <td class="number">${percentText(savings(groups.simulacion, strategy))}</td><td class="number">${percentText(savings(groups.maqueta, strategy))}</td>
      <td class="number">${service}</td><td class="number">${counts}</td></tr>`;
  }
  bind('savings-table').innerHTML = `<thead><tr><th>Estrategia</th><th class="number">Ahorro simulado</th><th class="number">Ahorro maqueta</th><th class="number">Servicio</th><th class="number">Noches</th></tr></thead><tbody>${rows}</tbody>`;
}

function renderNights(nights) {
  if (nights.length === 0) {
    bind('nights').innerHTML = '<p class="empty">Sin noches registradas</p>';
    return;
  }
  let rows = '';
  for (const night of [...nights].reverse()) {
    const strategy = night.mixedStrategies ? 'Mixta' : Labels.STRATEGIES[night.strategy];
    const duration = night.source === 'maqueta' ? `${Labels.number(night.seconds, 0)} s` : '12 h';
    const download = night.file ? `<a href="/data/nights/${night.file}" download>CSV</a>` : '';
    const source = night.synthetic ? `${SOURCES[night.source]} (prueba)` : night.estimatedPower ? `${SOURCES[night.source]} (consumo estimado)` : SOURCES[night.source];
    rows += `<tr><td>${source}</td><td>${night.startedAt.slice(5, 16)}</td><td>${strategy}</td>
      <td class="number">${night.people}</td><td class="number">${duration}</td>
      <td class="number">${Labels.number(night.energyWh, 1)} Wh</td><td class="number">${Labels.number(night.averagePowerW, 1)} W</td>
      <td class="number">${night.switchOns}</td><td>${download}</td></tr>`;
  }
  bind('nights').innerHTML = `<div class="table-scroll"><table>
    <thead><tr><th>Fuente</th><th>Inicio</th><th>Estrategia</th><th class="number">Personas</th><th class="number">Duración</th><th class="number">Energía</th><th class="number">Potencia media</th><th class="number">Encendidos</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function renderCalibration(calibration) {
  const points = calibration.points;
  if (points.length < 3) {
    bind('figures').innerHTML = '<p class="empty">Sin calibración</p>';
    view.regressionChart.data.datasets = [];
    view.regressionChart.update();
    return;
  }
  const fit = Energy.linearRegression(points);
  bind('figures').innerHTML = `
    <div><strong>${Labels.number(fit.intercept, 2)} mW</strong><span>a</span></div>
    <div><strong>${Labels.number(fit.slope, 3)} mW/%</strong><span>b</span></div>
    <div><strong>${Labels.number(fit.r2, 4)}</strong><span>R²</span></div>
    ${calibration.synthetic ? '<div><strong>Prueba</strong><span>Datos</span></div>' : ''}`;
  const measured = [];
  for (const [x, y] of points) {
    measured.push({ x, y });
  }
  view.regressionChart.data.datasets = [
    { label: 'Medido', data: measured, backgroundColor: '#ffb340', pointRadius: 5 },
    Charts.series('Recta ajustada', [{ x: 0, y: fit.intercept }, { x: 100, y: fit.intercept + fit.slope * 100 }], '#5e5ce6', { type: 'line' }),
  ];
  view.regressionChart.update();
}

function renderDijkstra() {
  const { iterations, distances } = StreetGraph.dijkstra(StreetGraph.graph, view.origin);
  const visited = [];
  let header = '';
  for (const pole of Config.POLES) {
    header += `<th class="number">${pole}</th>`;
  }
  let rows = '';
  for (let step = 0; step < iterations.length; step++) {
    visited.push(iterations[step].visited);
    let cells = '';
    for (const pole of Config.POLES) {
      const distance = iterations[step].distances[pole];
      cells += `<td class="number">${visited.includes(pole) ? '✓ ' : ''}${distance === Infinity ? '∞' : distance}</td>`;
    }
    rows += `<tr><td>${step + 1}</td><td><strong>${iterations[step].visited}</strong></td>${cells}</tr>`;
  }
  let arrivals = '';
  for (const pole of Config.POLES) {
    arrivals += `<td class="number">${Labels.number(distances[pole] / Config.WALKING_SPEED, 1)} s</td>`;
  }
  bind('dijkstra').innerHTML = `
    <h2>Modelo del grafo</h2>
    ${Labels.segmented('origin', { A1: 'Desde A1', B3: 'Desde B3' }, view.origin)}
    <div class="table-scroll"><table>
      <thead><tr><th>Paso</th><th>Visitado</th>${header}</tr></thead>
      <tbody>${rows}<tr><td colspan="2">Llegada</td>${arrivals}</tr></tbody>
    </table></div>`;
}

function onClick(event) {
  const button = event.target.closest('[data-group="origin"]');
  if (!button) return;
  view.origin = button.dataset.key;
  renderDijkstra();
}

async function show() {
  const nightsResponse = await fetch('/api/nights');
  const calibrationResponse = await fetch('/api/calibration');
  const nights = await nightsResponse.json();
  renderSavings(nights);
  renderNights(nights);
  renderCalibration(await calibrationResponse.json());
}

function onMessage(message) {
  if (message.type === 'nightSaved' && view.element.dataset.active === 'true') show();
}

function start() {
  view.element = document.getElementById('analysis');
  view.element.innerHTML = template();
  view.savingsChart = Charts.barChart(bind('savings-chart'), 'Ahorro (%)');
  view.regressionChart = Charts.scatterChart(bind('regression-chart'), 'Brillo (%)', 'Potencia (mW)');
  view.element.addEventListener('click', onClick);
  Connection.subscribe(onMessage);
  renderDijkstra();
}

const Analysis = { start, show };

export default Analysis;
