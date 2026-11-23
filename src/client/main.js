import Alerts from './layers/alerts.js';
import Charts from './layers/charts.js';
import CityMap from './layers/cityMap.js';
import Comparison from './layers/comparison.js';
import Controls from './layers/controls.js';
import Dijkstra from './layers/dijkstra.js';
import Header from './layers/header.js';
import History from './layers/history.js';
import Metrics from './layers/metrics.js';
import PoleTable from './layers/poleTable.js';
import Regression from './layers/regression.js';
import Connection from './services/connection.js';
import LocalSimulation from './services/localSimulation.js';

LocalSimulation.start();
Connection.start();
for (const layer of [Header, CityMap, Controls, Metrics, Charts, Comparison, PoleTable, Dijkstra, Alerts, Regression, History]) layer.start();
