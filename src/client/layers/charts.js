import Labels from '../labels.js';
import Store from '../services/store.js';

const style = getComputedStyle(document.documentElement);
Chart.defaults.font.family = style.fontFamily;
Chart.defaults.color = style.getPropertyValue('--muted');
Chart.defaults.borderColor = style.getPropertyValue('--line');

const lineChart = (canvasId, fill) =>
  new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: { labels: [], datasets: [{ data: [], borderWidth: 2, pointRadius: 0, stepped: !fill, fill }] },
    options: {
      animation: false,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { maxTicksLimit: 7 }, grid: { display: false } }, y: { beginAtZero: true } },
    },
  });

const Charts = {
  power: null,
  energy: null,
  drawn: null,

  start: () => {
    Charts.power = lineChart('power-chart', false);
    Charts.energy = lineChart('energy-chart', 'origin');
    Store.subscribe(Charts.render);
  },

  render: (state) => {
    const color = Labels.colors[state.strategy];
    const signature = `${state.samples.length}-${state.strategy}-${state.unit}-${state.samples.at(-1)?.label}`;
    document.getElementById('power-hint').textContent = state.unit === 'W'
      ? 'Suma de los 6 postes a escala real (100 W por luminaria al 100 %), un punto por minuto de la noche.'
      : 'Medida por el INA219 en la línea de los LEDs, un punto por lectura.';
    document.getElementById('energy-hint').textContent = `Integral de la potencia en el tiempo (método de Euler, E = Σ P · Δt), en ${state.unit === 'W' ? 'Wh' : 'mWh'}.`;
    if (signature === Charts.drawn) return;
    Charts.drawn = signature;
    for (const [chart, key] of [[Charts.power, 'power'], [Charts.energy, 'energy']]) {
      const dataset = chart.data.datasets[0];
      chart.data.labels = state.samples.map((sample) => sample.label);
      dataset.data = state.samples.map((sample) => sample[key]);
      dataset.borderColor = color;
      dataset.backgroundColor = `${color}33`;
      chart.update();
    }
  },
};

export default Charts;
