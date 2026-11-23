import Config from './config.js';

function buildGraph() {
  const graph = {};
  for (const pole of Config.POLES) {
    graph[pole] = {};
  }
  for (const [from, to, meters] of Config.STREETS) {
    graph[from][to] = meters;
    graph[to][from] = meters;
  }
  return graph;
}

function closestPending(distances, visited) {
  let closest = '';
  for (const node of Object.keys(distances)) {
    if (visited.includes(node)) continue;
    if (closest === '' || distances[node] < distances[closest]) closest = node;
  }
  return closest;
}

function dijkstra(graph, origin) {
  const distances = {};
  const predecessors = {};
  for (const node of Object.keys(graph)) {
    distances[node] = node === origin ? 0 : Infinity;
    predecessors[node] = '';
  }
  const visited = [];
  const iterations = [];
  while (visited.length < Object.keys(graph).length) {
    const current = closestPending(distances, visited);
    visited.push(current);
    for (const [neighbor, meters] of Object.entries(graph[current])) {
      if (visited.includes(neighbor)) continue;
      if (distances[current] + meters >= distances[neighbor]) continue;
      distances[neighbor] = distances[current] + meters;
      predecessors[neighbor] = current;
    }
    iterations.push({ visited: current, distances: { ...distances } });
  }
  return { distances, predecessors, iterations };
}

function lightWavePlan(origin, startTime, speed = Config.WALKING_SPEED) {
  const { distances } = dijkstra(StreetGraph.graph, origin);
  const plan = {};
  for (const pole of Config.POLES) {
    const arrival = startTime + distances[pole] / speed;
    plan[pole] = {
      activeFrom: Math.max(startTime, arrival - Config.ANTICIPATION_TIME),
      holdFrom: arrival,
      baseAt: arrival + Config.HOLD_TIME,
    };
  }
  return plan;
}

function routeArrivals(route, startTime, speed = Config.WALKING_SPEED) {
  const arrivals = [];
  let meters = 0;
  for (let index = 0; index < route.length; index++) {
    if (index > 0) meters += StreetGraph.graph[route[index - 1]][route[index]];
    arrivals.push({ pole: route[index], time: startTime + meters / speed });
  }
  return arrivals;
}

const StreetGraph = { graph: buildGraph(), dijkstra, lightWavePlan, routeArrivals };

export default StreetGraph;
