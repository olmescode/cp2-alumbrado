import Labels from './labels.js';

function template(parts) {
  return `
    <div class="columns">
      <article class="card glass">
        <div class="hero">
          <div><span class="phase" data-bind="phase">${parts.phase}</span><strong data-bind="clock">--:--</strong></div>
          <span data-bind="info"></span>
        </div>
        <div data-bind="map"></div>
      </article>
      <div class="stack">
        <article class="card glass">
          <h2>Ahora</h2>
          <div class="stats">
            <div class="stat"><strong data-bind="power">0 ${parts.unit}</strong><span>Potencia</span></div>
            <div class="stat"><strong data-bind="energy">0 ${parts.unit}h</strong><span>Energía de la noche</span></div>
            <div class="stat"><strong data-bind="people">0</strong><span>Personas en la noche</span></div>
            <div class="stat"><strong data-bind="lit">0 de 6</strong><span>Postes al 100 %</span></div>
          </div>
          <p class="hint">${parts.nowHint}</p>
          <div class="stack" data-bind="alerts"></div>
        </article>
        <article class="card glass">
          <h2>${parts.controlsTitle}</h2>
          ${parts.controls}
          <p class="hint" data-bind="status">${parts.status}</p>
        </article>
      </div>
    </div>
    <article class="card glass">
      <h2>Potencia durante la noche</h2>
      <p class="hint">${parts.chartHint}</p>
      <div class="chart"><canvas data-bind="chart"></canvas></div>
    </article>`;
}

function bind(container, name) {
  return container.querySelector(`[data-bind="${name}"]`);
}

function renderNow(container, now) {
  let lit = 0;
  for (const pole of now.poles) {
    if (pole.brightness >= 1) lit += 1;
  }
  bind(container, 'power').textContent = `${Labels.number(now.power, 0)} ${now.unit}`;
  bind(container, 'energy').textContent = `${Labels.number(now.energy, 1)} ${now.unit}h`;
  bind(container, 'people').textContent = String(now.people);
  bind(container, 'lit').textContent = `${lit} de 6`;
}

const ScreenLayout = { template, bind, renderNow };

export default ScreenLayout;
