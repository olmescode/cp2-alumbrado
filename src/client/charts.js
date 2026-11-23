const AXIS_COLOR = 'rgb(235 235 245 / 0.55)';
const GRID_COLOR = 'rgb(235 235 245 / 0.08)';

function applyTheme() {
  Chart.defaults.font.family = getComputedStyle(document.documentElement).fontFamily;
  Chart.defaults.color = AXIS_COLOR;
  Chart.defaults.borderColor = GRID_COLOR;
}

function baseOptions(yTitle, showLegend) {
  return {
    animation: false,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: { legend: { display: showLegend, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } } },
    scales: {
      x: { ticks: { maxTicksLimit: 6 }, grid: { display: false } },
      y: { beginAtZero: true, title: { display: true, text: yTitle } },
    },
  };
}

function lineChart(canvas, yTitle, showLegend = false) {
  return new Chart(canvas, { type: 'line', data: { labels: [], datasets: [] }, options: baseOptions(yTitle, showLegend) });
}

function scatterChart(canvas, xTitle, yTitle) {
  const options = baseOptions(yTitle, true);
  options.scales.x = { min: 0, max: 100, title: { display: true, text: xTitle } };
  options.interaction = { intersect: true, mode: 'nearest' };
  return new Chart(canvas, { type: 'scatter', data: { datasets: [] }, options });
}

function barChart(canvas, yTitle) {
  const options = baseOptions(yTitle, true);
  options.interaction = { intersect: false, mode: 'index' };
  return new Chart(canvas, { type: 'bar', data: { labels: [], datasets: [] }, options });
}

function series(label, values, color, extra = {}) {
  return { label, data: values, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 0, ...extra };
}

const Charts = { applyTheme, lineChart, scatterChart, barChart, series };

export default Charts;
