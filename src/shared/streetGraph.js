import Config from './config.js';

const buildGraph = (streets) => {
  const graph = Object.fromEntries(Config.POLES.map((pole) => [pole, {}]));
  for (const [from, to, meters] of streets) {
    graph[from][to] = meters;
    graph[to][from] = meters;
  }
  return graph;
};

const StreetGraph = {
  graph: buildGraph(Config.STREETS),

  dijkstra: (graph, origin) => {
    const nodes = Object.keys(graph);
    const distances = Object.fromEntries(nodes.map((node) => [node, node === origin ? 0 : Infinity]));
    const predecessors = Object.fromEntries(nodes.map((node) => [node, '']));
    const visited = [];
    const iterations = [];
    while (visited.length < nodes.length) {
      const pending = nodes.filter((node) => !visited.includes(node));
      const current = pending.reduce((best, node) => (distances[node] < distances[best] ? node : best));
      visited.push(current);
      for (const [neighbor, meters] of Object.entries(graph[current])) {
        if (visited.includes(neighbor) || distances[current] + meters >= distances[neighbor]) continue;
        distances[neighbor] = distances[current] + meters;
        predecessors[neighbor] = current;
      }
      iterations.push({ visited: current, distances: { ...distances } });
    }
    return { distances, predecessors, iterations };
  },

  lightWavePlan: (origin, startTime, speed = Config.WALKING_SPEED) => {
    const { distances } = StreetGraph.dijkstra(StreetGraph.graph, origin);
    const plan = {};
    for (const pole of Config.POLES) {
      const arrival = startTime + distances[pole] / speed;
      plan[pole] = { activeFrom: Math.max(startTime, arrival - Config.ANTICIPATION_TIME), holdFrom: arrival, baseAt: arrival + Config.HOLD_TIME };
    }
    return plan;
  },

  routeArrivals: (route, startTime, speed = Config.WALKING_SPEED) => {
    let meters = 0;
    return route.map((pole, index) => {
      meters += index > 0 ? StreetGraph.graph[route[index - 1]][pole] : 0;
      return { pole, time: startTime + meters / speed };
    });
  },
};

export default StreetGraph;
