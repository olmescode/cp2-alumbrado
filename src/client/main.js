import Charts from './charts.js';
import Connection from './connection.js';
import Analysis from './screens/analysis.js';
import Monitor from './screens/monitor.js';
import Simulation from './screens/simulation.js';

const SCREENS = { monitor: Monitor, analysis: Analysis, simulation: Simulation };

const menuButton = document.getElementById('menu-button');
const menuPanel = document.getElementById('menu-panel');

function showScreen(name) {
  for (const screen of document.querySelectorAll('.screen')) {
    screen.dataset.active = String(screen.id === name);
  }
  for (const tab of document.querySelectorAll('.tabbar button')) {
    if (tab.dataset.screen === name) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  document.getElementById('board-status').hidden = name !== 'monitor';
  SCREENS[name].show();
  window.scrollTo({ top: 0 });
}

function onTabClick(event) {
  const tab = event.target.closest('button');
  if (tab) showScreen(tab.dataset.screen);
}

function setMenuOpen(open) {
  menuPanel.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
}

function onDocumentClick(event) {
  if (menuButton.contains(event.target)) {
    setMenuOpen(menuPanel.hidden);
    return;
  }
  setMenuOpen(false);
}

Charts.applyTheme();
Connection.start();
for (const screen of Object.values(SCREENS)) {
  screen.start();
}
document.querySelector('.tabbar').addEventListener('click', onTabClick);
document.addEventListener('click', onDocumentClick);
showScreen('monitor');
