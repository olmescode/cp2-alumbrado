import Charts from './charts.js';
import Connection from './connection.js';
import Analysis from './screens/analysis.js';
import Monitor from './screens/monitor.js';
import Simulation from './screens/simulation.js';

const SCREENS = { monitor: Monitor, analysis: Analysis, simulation: Simulation };

function showScreen(name) {
  for (const screen of document.querySelectorAll('.screen')) {
    screen.dataset.active = String(screen.id === name);
  }
  for (const tab of document.querySelectorAll('.tabbar button')) {
    if (tab.dataset.screen === name) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  SCREENS[name].show();
  window.scrollTo({ top: 0 });
}

function onTabClick(event) {
  const tab = event.target.closest('button');
  if (tab) showScreen(tab.dataset.screen);
}

Charts.applyTheme();
Connection.start();
for (const screen of Object.values(SCREENS)) {
  screen.start();
}
document.querySelector('.tabbar').addEventListener('click', onTabClick);
showScreen('monitor');
