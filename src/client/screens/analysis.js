import Config from '/shared/config.js';
import Energy from '/shared/energy.js';
import NightSimulator from '/shared/nightSimulator.js';
import Charts from '../charts.js';
import Labels from '../labels.js';

const view = { element: null, chart: null, simulated: null };

function template() {
  return `
    <article class="card glass">
      <h2>Ahorro frente a la iluminación permanente</h2>
      <p class="hint">Observado: potencia media de las noches registradas con cada estrategia, comparada con las noches en modo permanente. Simulado: una noche completa de 12 h con 20 personas. El observado depende de cuántas personas pasaron en cada prueba.</p>
      <div class="bars" data-bind="savings"></div>
    </article>
    <div class="columns">
      <article class="card glass">
        <h2>Noches registradas</h2>
        <p class="hint">Cada vez que se tapa el LDR empieza una noche y se registra hasta que se destapa. La energía es la integral de la potencia medida (E = Σ P · Δt).</p>
        <div data-bind="nights"></div>
      </article>
      <article class="card glass">
        <h2>Consumo de las luminarias</h2>
        <p class="hint">Recta potencia = a + b · brillo ajustada por mínimos cuadrados con los puntos de la última calibración.</p>
        <div class="figures" data-bind="figures"></div>
        <div class="chart"><canvas data-bind="chart"></canvas></div>
      </article>
    </div>`;
}

function bind(name) {
  return view.element.querySelector(`[data-bind="${name}"]`);
}

function averagePowerByStrategy(nights) {
  const totals = {};
  for (const night of nights) {
    if (night.mixedStrategies) continue;
    const total = totals[night.strategy] || { power: 0, count: 0 };
    totals[night.strategy] = { power: total.power + night.averagePowerMw, count: total.count + 1 };
  }
  const averages = {};
  for (const [strategy, total] of Object.entries(totals)) {
    averages[strategy] = total.power / total.count;
  }
  return averages;
}

function bar(percent, color, label) {
  return `<div class="bar" style="width:${Math.max(percent, 0)}%;background:${color}"></div><span class="bar-label">${label}</span>`;
}

function renderSavings(nights) {
  const averages = averagePowerByStrategy(nights);
  let rows = '';
  for (const run of view.simulated) {
    const color = Labels.COLORS[run.strategy];
    const hasObserved = averages[run.strategy] && averages.permanent;
    const observed = hasObserved ? 100 * (1 - averages[run.strategy] / averages.permanent) : 0;
    const observedLabel = hasObserved ? `Observado ${Labels.number(observed, 1)} %` : 'Observado: sin noches registradas';
    rows += `<div class="bar-row"><span>${Labels.STRATEGIES[run.strategy]}</span><div class="bar-track">
      ${bar(observed, color, observedLabel)}
      ${bar(run.savingsPercent, `${color}66`, `Simulado ${Labels.number(run.savingsPercent, 1)} %`)}
    </div></div>`;
  }
  bind('savings').innerHTML = rows;
}

function renderNights(nights) {
  if (nights.length === 0) {
    bind('nights').innerHTML = '<p class="empty">Aún no hay noches. Conecta la maqueta, tapa el LDR durante un minuto y pasa el muñeco frente a los sensores.</p>';
    return;
  }
  let rows = '';
  for (const night of [...nights].reverse()) {
    const strategy = night.mixedStrategies ? 'Mixta' : Labels.STRATEGIES[night.strategy];
    rows += `<tr><td>${night.startedAt.slice(5, 16)}</td><td>${strategy}</td>
      <td class="number">${Labels.number(night.seconds, 0)} s</td><td class="number">${night.people}</td>
      <td class="number">${Labels.number(night.energyMwh, 2)}</td><td class="number">${Labels.number(night.averagePowerMw, 0)}</td>
      <td><a href="/data/nights/${night.file}" download>CSV</a></td></tr>`;
  }
  bind('nights').innerHTML = `<div class="table-scroll"><table>
    <thead><tr><th>Inicio</th><th>Estrategia</th><th class="number">Duración</th><th class="number">Personas</th><th class="number">mWh</th><th class="number">mW medios</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function renderCalibration(calibration) {
  const points = calibration.points;
  if (points.length < 3) {
    bind('figures').innerHTML = '<p class="empty">Sin calibración. En Monitoreo, pulsa Calibrar consumo con la maqueta conectada.</p>';
    view.chart.data.datasets = [];
    view.chart.update();
    return;
  }
  const fit = Energy.linearRegression(points);
  bind('figures').innerHTML = `
    <div><strong>${Labels.number(fit.intercept, 2)} mW</strong><span>a (consumo con brillo 0)</span></div>
    <div><strong>${Labels.number(fit.slope, 3)} mW/%</strong><span>b (por cada % de brillo)</span></div>
    <div><strong>${Labels.number(fit.r2, 4)}</strong><span>R²</span></div>`;
  const measured = [];
  for (const [x, y] of points) {
    measured.push({ x, y });
  }
  view.chart.data.datasets = [
    { label: 'Medido', data: measured, backgroundColor: '#ffb340', pointRadius: 5 },
    Charts.series('Recta ajustada', [{ x: 0, y: fit.intercept }, { x: 100, y: fit.intercept + fit.slope * 100 }], '#5e5ce6', { type: 'line' }),
  ];
  view.chart.update();
}

async function show() {
  view.simulated = view.simulated || NightSimulator.compare(Config.SCENARIOS.normal);
  const nightsResponse = await fetch('/api/nights');
  const calibrationResponse = await fetch('/api/calibration');
  const nights = await nightsResponse.json();
  renderSavings(nights);
  renderNights(nights);
  renderCalibration(await calibrationResponse.json());
}

function start() {
  view.element = document.getElementById('analysis');
  view.element.innerHTML = template();
  view.chart = Charts.scatterChart(bind('chart'), 'Brillo (%)', 'Potencia (mW)');
}

const Analysis = { start, show };

export default Analysis;
