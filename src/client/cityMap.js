import Config from '/shared/config.js';
import StreetGraph from '/shared/streetGraph.js';

const ROAD_POINTS = { A1: [95, 134], A2: [245, 134], A3: [410, 134], B1: [245, 200], B2: [245, 300], B3: [245, 380] };
const LAMPS = { A1: [95, 104], A2: [245, 104], A3: [410, 104], B1: [280, 200], B2: [280, 300], B3: [280, 380] };
const SENSORS = { pirA: [18, 74, 'PIR A'], pirB: [300, 334, 'PIR B'] };
const HOUSES = [
  [150, 38, 60, 46, '#e08a76'], [300, 44, 76, 40, '#f4f4f2'], [446, 36, 56, 50, '#9fb8cc'],
  [28, 186, 56, 52, '#9cb57f'], [94, 182, 58, 58, '#e08a76'], [116, 300, 62, 80, '#9fb8cc'],
  [336, 182, 52, 50, '#9cb57f'], [398, 176, 58, 58, '#e08a76'],
];
const TREES = [[40, 290], [70, 284], [48, 324], [80, 336], [58, 360]];

function crosswalk(x, y, width, height, vertical) {
  let stripes = '';
  for (let offset = 0; offset < (vertical ? width : height); offset += 7) {
    stripes += vertical
      ? `<rect x="${x + offset}" y="${y}" width="3.5" height="${height}" fill="#ffffff"/>`
      : `<rect x="${x}" y="${y + offset}" width="${width}" height="3.5" fill="#ffffff"/>`;
  }
  return stripes;
}

function scenery() {
  let houses = '';
  for (const [x, y, width, height, roof] of HOUSES) {
    houses += `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" fill="${roof}" stroke="rgb(0 0 0 / 0.12)"/>`;
  }
  let trees = '';
  for (const [x, y] of TREES) {
    trees += `<circle cx="${x}" cy="${y}" r="10" fill="#6f9a5c"/>`;
  }
  return `
    <rect width="520" height="100" fill="#dfe8d6"/>
    <rect y="166" width="212" height="234" fill="#d3e2c5"/>
    <rect x="278" y="166" width="242" height="234" fill="#d3e2c5"/>
    <rect x="24" y="270" width="80" height="100" rx="8" fill="#b9d3a4"/>
    ${houses}${trees}
    <rect x="356" y="286" width="68" height="64" rx="4" fill="#fbfbfa" stroke="rgb(0 0 0 / 0.15)"/>
    <text x="390" y="323" class="tag-text dark">LDR</text>
    <rect y="100" width="520" height="12" fill="#f3f3ef"/>
    <rect y="156" width="520" height="10" fill="#f3f3ef"/>
    <rect y="112" width="520" height="44" fill="#8d9297"/>
    <rect x="222" y="156" width="46" height="244" fill="#8d9297"/>
    <line x1="0" y1="134" x2="520" y2="134" stroke="#ffffff" stroke-width="2" stroke-dasharray="12 10"/>
    <line x1="245" y1="166" x2="245" y2="400" stroke="#ffffff" stroke-width="2" stroke-dasharray="12 10"/>
    ${crosswalk(176, 114, 28, 40, true)}${crosswalk(224, 226, 42, 22, false)}`;
}

function lampMarkup(pole) {
  const [x, y] = LAMPS[pole];
  const onAvenue = pole[0] === 'A';
  const tagX = onAvenue ? x - 22 : x + 12;
  const tagY = onAvenue ? y - 40 : y - 15;
  return `<g data-pole="${pole}">
    <circle class="halo" cx="${x}" cy="${y}" r="0" fill="url(#glow)"/>
    <circle class="lamp" cx="${x}" cy="${y}" r="6"/>
    <rect x="${tagX}" y="${tagY}" width="44" height="30" rx="7" fill="#1f2933"/>
    <text x="${tagX + 22}" y="${tagY + 13}" class="tag-text">${pole}</text>
    <text x="${tagX + 22}" y="${tagY + 25}" class="tag-level"></text>
  </g>`;
}

function sensorMarkup(sensor) {
  const [x, y, label] = SENSORS[sensor];
  return `<g data-sensor="${sensor}">
    <rect class="sensor" x="${x}" y="${y}" width="48" height="22" rx="6"/>
    <text x="${x + 24}" y="${y + 15}" class="tag-text dark">${label}</text>
  </g>`;
}

function template() {
  let lamps = '';
  for (const pole of Config.POLES) {
    lamps += lampMarkup(pole);
  }
  return `<svg viewBox="0 0 520 400" role="img" aria-label="Maqueta vista desde arriba">
    <defs>
      <radialGradient id="glow">
        <stop offset="0" stop-color="#ffe2a8" stop-opacity="0.95"/>
        <stop offset="0.4" stop-color="#ffb340" stop-opacity="0.45"/>
        <stop offset="1" stop-color="#ffb340" stop-opacity="0"/>
      </radialGradient>
    </defs>
    ${scenery()}
    <rect class="night" width="520" height="400" fill="#0a1430"/>
    <g class="walkers"></g>
    ${sensorMarkup('pirA')}${sensorMarkup('pirB')}${lamps}
  </svg>
  <div class="map-message" hidden><strong></strong></div>`;
}

function pointOnRoute(route, meters) {
  const arrivals = StreetGraph.routeArrivals(route, 0, 1);
  let segment = 1;
  while (segment < arrivals.length - 1 && arrivals[segment].time < meters) segment += 1;
  const from = arrivals[segment - 1];
  const to = arrivals[segment];
  const progress = Math.min((meters - from.time) / (to.time - from.time), 1);
  const [startX, startY] = ROAD_POINTS[from.pole];
  const [endX, endY] = ROAD_POINTS[to.pole];
  return [startX + (endX - startX) * progress, startY + (endY - startY) * progress];
}

class CityMap {
  constructor(container) {
    this.container = container;
    container.classList.add('map');
    container.innerHTML = template();
    this.night = container.querySelector('.night');
    this.walkers = container.querySelector('.walkers');
    this.message = container.querySelector('.map-message');
  }

  update(view) {
    this.night.style.opacity = view.isNight ? '0.78' : '0';
    for (let index = 0; index < Config.POLES.length; index++) {
      const group = this.container.querySelector(`[data-pole="${Config.POLES[index]}"]`);
      const brightness = view.poles[index].brightness;
      group.querySelector('.halo').setAttribute('r', String(brightness * 62));
      group.querySelector('.lamp').dataset.on = String(brightness > 0);
      group.querySelector('.tag-level').textContent = `${Math.round(brightness * 100)} %`;
    }
    for (const sensor of Object.keys(SENSORS)) {
      const group = this.container.querySelector(`[data-sensor="${sensor}"]`);
      group.dataset.active = String(view.sensors[sensor] > 0);
    }
    let dots = '';
    for (const walker of view.walkers) {
      const [x, y] = pointOnRoute(walker.route, walker.meters);
      dots += `<circle class="walker" cx="${x}" cy="${y}" r="6"/>`;
    }
    this.walkers.innerHTML = dots;
  }

  showMessage(title) {
    this.message.hidden = !title;
    this.message.querySelector('strong').textContent = title;
  }

  destroy() {
    this.container.innerHTML = '';
  }
}

export default CityMap;
