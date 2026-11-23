import Config from '/shared/config.js';
import StreetGraph from '/shared/streetGraph.js';
import Labels from '../labels.js';
import Store from '../services/store.js';

const NODES = { A1: [110, 120], A2: [330, 120], A3: [550, 120], B1: [330, 225], B2: [330, 330], B3: [330, 435] };
const LAMP_OFFSET = { A: [0, -34], B: [34, 0] };
const SENSORS = { pirA: ['A1', 'PIR A', [-62, 0]], pirB: ['B3', 'PIR B', [0, 34]] };
const HOUSES = [
  [40, 20, 70, 44], [150, 26, 56, 38], [400, 18, 90, 46], [520, 30, 60, 34],
  [60, 170, 80, 60], [180, 180, 100, 90], [60, 290, 110, 70], [200, 320, 80, 110],
  [400, 175, 70, 70], [500, 170, 110, 50], [410, 290, 90, 60], [430, 390, 120, 60],
];

const lampPosition = (pole) => {
  const [x, y] = NODES[pole];
  const [offsetX, offsetY] = LAMP_OFFSET[pole[0]];
  return [x + offsetX, y + offsetY];
};

const pointOnRoute = (route, meters) => {
  const arrivals = StreetGraph.routeArrivals(route, 0, 1);
  const segment = Math.max(arrivals.findIndex((arrival) => arrival.time > meters), 1);
  const [from, to] = [arrivals[segment - 1], arrivals[segment]];
  const progress = (meters - from.time) / (to.time - from.time);
  const [startX, startY] = NODES[from.pole];
  const [endX, endY] = NODES[to.pole];
  return [startX + (endX - startX) * progress, startY + (endY - startY) * progress];
};

const template = () => {
  const roads = Config.STREETS.map(([from, to, meters]) => {
    const [x1, y1] = NODES[from];
    const [x2, y2] = NODES[to];
    return `<line class="road" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
      <text class="distance" x="${(x1 + x2) / 2 + (x1 === x2 ? -40 : 0)}" y="${(y1 + y2) / 2 + (y1 === y2 ? 32 : 4)}">${meters} m</text>`;
  });
  const houses = HOUSES.map(([x, y, width, height]) => `<rect class="house" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>`);
  const lamps = Config.POLES.map((pole) => {
    const [x, y] = lampPosition(pole);
    return `<g data-pole="${pole}">
      <circle class="halo" cx="${x}" cy="${y}" r="0" fill="url(#glow)"/>
      <circle class="lamp" cx="${x}" cy="${y}" r="7"/>
      <text class="pole-name" x="${x + (pole[0] === 'A' ? 0 : 20)}" y="${y + (pole[0] === 'A' ? -34 : -4)}">${pole}</text>
      <text class="pole-state" x="${x + (pole[0] === 'A' ? 0 : 20)}" y="${y + (pole[0] === 'A' ? -19 : 11)}"></text>
    </g>`;
  });
  const sensorEntries = Object.entries(SENSORS);
  const sensors = sensorEntries.map(([sensor, [pole, label, [offsetX, offsetY]]]) => {
    const [x, y] = NODES[pole];
    return `<g data-sensor="${sensor}"><circle class="sensor" cx="${x + offsetX}" cy="${y + offsetY}" r="9"/><text class="sensor-name" x="${x + offsetX}" y="${y + offsetY + 26}">${label}</text></g>`;
  });
  return `<svg viewBox="0 0 660 500" role="img" aria-label="Mapa de la maqueta con las seis luminarias">
    <defs><radialGradient id="glow"><stop offset="0" stop-color="#ffcf7a" stop-opacity="0.95"/><stop offset="0.35" stop-color="#ffb340" stop-opacity="0.45"/><stop offset="1" stop-color="#ffb340" stop-opacity="0"/></radialGradient></defs>
    ${houses.join('')}${roads.join('')}<g id="walkers"></g>${sensors.join('')}${lamps.join('')}
  </svg><figcaption></figcaption>`;
};

const CityMap = {
  element: null,

  start: () => {
    CityMap.element = document.getElementById('city-map');
    CityMap.element.innerHTML = template();
    Store.subscribe(CityMap.render);
  },

  render: (state) => {
    const element = CityMap.element;
    element.dataset.day = String(!state.isNight);
    state.poles.forEach((pole, index) => {
      const group = element.querySelector(`[data-pole="${Config.POLES[index]}"]`);
      const halo = group.querySelector('.halo');
      halo.setAttribute('r', String(pole.brightness * 70));
      group.querySelector('.lamp').style.fill = pole.brightness > 0 ? `color-mix(in srgb, #ffb340 ${40 + pole.brightness * 60}%, #3a4658)` : '';
      group.querySelector('.pole-state').textContent = `${Labels.states[pole.state]} ${Math.round(pole.brightness * 100)} %`;
    });
    for (const sensor of Object.keys(SENSORS)) element.querySelector(`[data-sensor="${sensor}"]`).classList.toggle('active', state[sensor] > 0);
    const dots = state.walkers.map(({ route, meters }) => {
      const [x, y] = pointOnRoute(route, meters);
      return `<circle class="walker" cx="${x}" cy="${y}" r="6"/>`;
    });
    element.querySelector('#walkers').innerHTML = dots.join('');
    const people = state.walkers.length === 1 ? '1 persona caminando' : `${state.walkers.length} personas caminando`;
    element.querySelector('figcaption').textContent = `${state.isNight ? 'Noche' : 'Día'}, ${people}`;
  },
};

export default CityMap;
