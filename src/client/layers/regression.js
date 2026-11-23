import Energy from '/shared/energy.js';
import Labels from '../labels.js';
import Store from '../services/store.js';

const Regression = {
  element: null,
  chart: null,
  drawn: '',

  start: () => {
    Regression.element = document.getElementById('regression');
    Regression.element.innerHTML = `
      <h2>Regresión del consumo</h2>
      <p class="hint">Pulsa Barrido de brillo: los LEDs suben de 0 a 100 % en pasos de 10 % y se ajusta la recta potencia = a + b · brillo por mínimos cuadrados.</p>
      <div class="figures" data-bind="figures"></div>
      <div class="chart"><canvas id="regression-chart"></canvas></div>`;
    Regression.chart = new Chart(document.getElementById('regression-chart'), {
      type: 'scatter',
      data: { datasets: [
        { label: 'Medido', data: [], backgroundColor: '#ffb340', pointRadius: 5 },
        { label: 'Recta ajustada', data: [], type: 'line', borderColor: '#5e5ce6', borderWidth: 2, pointRadius: 0 },
      ] },
      options: {
        animation: false,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } } },
        scales: { x: { min: 0, max: 100, title: { display: true, text: 'Brillo (%)' } }, y: { beginAtZero: true, title: { display: true, text: 'Potencia (mW)' } } },
      },
    });
    Store.subscribe(Regression.render);
  },

  render: (state) => {
    const points = Object.entries(state.sweep).map(([level, point]) => [Number(level), point.total / point.count]);
    const signature = JSON.stringify(points);
    if (signature === Regression.drawn) return;
    Regression.drawn = signature;
    const figures = Regression.element.querySelector('[data-bind="figures"]');
    Regression.chart.data.datasets[0].data = points.map(([x, y]) => ({ x, y }));
    if (points.length < 3) {
      figures.innerHTML = '<div><span>Faltan puntos: se necesitan al menos 3 niveles de brillo.</span></div>';
      Regression.chart.data.datasets[1].data = [];
      Regression.chart.update();
      return;
    }
    const fit = Energy.linearRegression(points);
    const figureList = [['a', `${Labels.number(fit.intercept, 2)} mW`], ['b', `${Labels.number(fit.slope, 3)} mW/%`], ['R²', Labels.number(fit.r2, 4)]];
    const cells = figureList.map(([name, figure]) => `<div><strong>${figure}</strong><span>${name}</span></div>`);
    figures.innerHTML = cells.join('');
    Regression.chart.data.datasets[1].data = [{ x: 0, y: fit.intercept }, { x: 100, y: fit.intercept + fit.slope * 100 }];
    Regression.chart.update();
  },
};

export default Regression;
