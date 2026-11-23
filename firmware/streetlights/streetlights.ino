#include <Adafruit_INA219.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <WiFi.h>

const char *WIFI_SSID = "TU_RED_WIFI";
const char *WIFI_PASS = "TU_CLAVE_WIFI";
const char *SERVER_IP = "192.168.1.104";
const uint16_t SERVER_PORT = 8080;

const int POLE_COUNT = 6;
const char *POLES[POLE_COUNT] = {"A1", "A2", "A3", "B1", "B2", "B3"};
const int LED_PINS[POLE_COUNT] = {13, 14, 16, 17, 18, 19};
const int PIR_A_PIN = 27;
const int PIR_B_PIN = 26;
const int PIR_ACTIVE_LEVEL = HIGH;
const int LDR_PIN = 34;
const int STREETS[5][3] = {{0, 1, 30}, {1, 2, 30}, {1, 3, 30}, {3, 4, 30}, {4, 5, 30}};
const int ENTRANCE_A = 0;
const int ENTRANCE_B = 5;

const float BASE_LEVEL = 0.2;
const float HOLD_TIME = 30;
const float ANTICIPATION_TIME = 10;
const float WALKING_SPEED = 1.4;
const float NIGHT_THRESHOLD = 30;
const float DAY_THRESHOLD = 40;
const float DEFAULT_TIME_FACTOR = 10;
const float NIGHT_SECONDS = 12 * 3600.0;
const unsigned long READING_INTERVAL_MS = 500;
const unsigned long SWEEP_STEP_MS = 3000;
const int MAX_PLANS = 8;

struct Window {
  float activeFrom;
  float holdFrom;
  float baseAt;
};

struct Plan {
  Window windows[POLE_COUNT];
  bool used;
};

enum State { Off, Base, Hold, Active };
const char *STATE_NAMES[] = {"Off", "Base", "Hold", "Active"};

Adafruit_INA219 ina219;
WebSocketsClient socket;
Plan plans[MAX_PLANS];
float distances[2][POLE_COUNT];
String strategy = "adaptive";
String mode = "live";
float timeFactor = DEFAULT_TIME_FACTOR;
unsigned long startedAt = 0;
unsigned long sweepStartedAt = 0;
unsigned long lastReadingAt = 0;
unsigned long lastDetection[2] = {0, 0};
int previousPir[2] = {LOW, LOW};
int nextPlan = 0;
bool isNight = true;
bool inaReady = false;

void dijkstra(int origin, float *result) {
  float graph[POLE_COUNT][POLE_COUNT] = {};
  for (auto &street : STREETS) graph[street[0]][street[1]] = graph[street[1]][street[0]] = street[2];
  bool visited[POLE_COUNT] = {};
  for (int node = 0; node < POLE_COUNT; node++) result[node] = node == origin ? 0 : INFINITY;
  for (int step = 0; step < POLE_COUNT; step++) {
    int current = -1;
    for (int node = 0; node < POLE_COUNT; node++) {
      if (!visited[node] && (current < 0 || result[node] < result[current])) current = node;
    }
    visited[current] = true;
    for (int neighbor = 0; neighbor < POLE_COUNT; neighbor++) {
      if (graph[current][neighbor] > 0 && !visited[neighbor]) result[neighbor] = min(result[neighbor], result[current] + graph[current][neighbor]);
    }
  }
}

float nightTime() {
  return fmod((millis() - startedAt) / 1000.0 * timeFactor, 24 * 3600.0);
}

void lightWavePlan(int entrance, float startTime) {
  Plan &plan = plans[nextPlan];
  nextPlan = (nextPlan + 1) % MAX_PLANS;
  for (int pole = 0; pole < POLE_COUNT; pole++) {
    float arrival = startTime + distances[entrance][pole] / WALKING_SPEED;
    plan.windows[pole] = {max(startTime, arrival - ANTICIPATION_TIME), arrival, arrival + HOLD_TIME};
  }
  plan.used = true;
}

State stateAt(int pole, float time) {
  if (!isNight) return Off;
  State strongest = Base;
  for (auto &plan : plans) {
    if (!plan.used) continue;
    Window &window = plan.windows[pole];
    State windowState = time < window.activeFrom || time >= window.baseAt ? Base : time < window.holdFrom ? Active : Hold;
    strongest = max(strongest, windowState);
  }
  return strongest;
}

float scheduledLevel(float time) {
  int hour = (18 + int(time / 3600)) % 24;
  return hour >= 23 || hour < 5 ? 0.5 : 1;
}

float brightnessOf(int pole, float time, State &state) {
  state = stateAt(pole, time);
  if (mode == "sweep") return min((millis() - sweepStartedAt) / SWEEP_STEP_MS, 10UL) / 10.0;
  if (strategy == "permanent") return isNight ? 1 : 0;
  if (strategy == "scheduled") return isNight ? scheduledLevel(time) : 0;
  return state == Off ? 0 : state == Base ? BASE_LEVEL : 1;
}

String clockText(float time) {
  int minutes = int(time / 60);
  char text[6];
  snprintf(text, sizeof(text), "%02d:%02d", (18 + minutes / 60) % 24, minutes % 60);
  return String(text);
}

void detect(int sensor, float time) {
  lastDetection[sensor] = millis();
  lightWavePlan(sensor == 0 ? ENTRANCE_A : ENTRANCE_B, time);
}

void readPirs(float time) {
  const int pins[2] = {PIR_A_PIN, PIR_B_PIN};
  for (int sensor = 0; sensor < 2; sensor++) {
    int level = digitalRead(pins[sensor]);
    if (level == PIR_ACTIVE_LEVEL && previousPir[sensor] != PIR_ACTIVE_LEVEL) detect(sensor, time);
    previousPir[sensor] = level;
  }
}

void onCommand(uint8_t *payload, size_t length) {
  JsonDocument command;
  if (deserializeJson(command, payload, length) || command["type"] != "command") return;
  String name = command["name"].as<String>();
  if (name == "setStrategy") strategy = command["value"].as<String>();
  if (name == "startNight") {
    timeFactor = command["factor"] | 60;
    startedAt = millis();
    mode = "night";
    for (auto &plan : plans) plan.used = false;
  }
  if (name == "brightnessSweep") {
    mode = "sweep";
    sweepStartedAt = millis();
  }
  if (name == "simulatePerson") detect(command["entrance"] == "B3" ? 1 : 0, nightTime());
}

void onSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  if (type == WStype_TEXT) onCommand(payload, length);
}

void sendReading(float time, int ldrRaw, float ldrPercent, float *brightness, State *states) {
  JsonDocument reading;
  reading["type"] = "reading";
  reading["source"] = "esp32";
  reading["timeMs"] = millis() - startedAt;
  reading["clock"] = clockText(time);
  reading["strategy"] = strategy;
  reading["mode"] = mode;
  reading["ldrRaw"] = ldrRaw;
  reading["ldrPercent"] = round(ldrPercent * 10) / 10.0;
  reading["isNight"] = isNight;
  reading["pirA"] = millis() - lastDetection[0] < 2000 ? 1 : 0;
  reading["pirB"] = millis() - lastDetection[1] < 2000 ? 1 : 0;
  for (int pole = 0; pole < POLE_COUNT; pole++) {
    reading["brightness"].add(int(round(brightness[pole] * 100)));
    reading["states"].add(STATE_NAMES[states[pole]]);
  }
  reading["currentMa"] = inaReady ? ina219.getCurrent_mA() : 0;
  reading["voltage"] = inaReady ? ina219.getBusVoltage_V() : 0;
  reading["powerMw"] = inaReady ? ina219.getPower_mW() : 0;
  String message;
  serializeJson(reading, message);
  socket.sendTXT(message);
}

void setup() {
  Serial.begin(115200);
  for (int pole = 0; pole < POLE_COUNT; pole++) ledcAttach(LED_PINS[pole], 5000, 8);
  pinMode(PIR_A_PIN, INPUT);
  pinMode(PIR_B_PIN, INPUT);
  dijkstra(ENTRANCE_A, distances[0]);
  dijkstra(ENTRANCE_B, distances[1]);
  inaReady = ina219.begin();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  socket.begin(SERVER_IP, SERVER_PORT, "/esp32");
  socket.onEvent(onSocketEvent);
  socket.setReconnectInterval(2000);
  startedAt = millis();
}

void loop() {
  socket.loop();
  float time = nightTime();
  int ldrRaw = analogRead(LDR_PIN);
  float ldrPercent = ldrRaw / 4095.0 * 100;
  isNight = isNight ? ldrPercent <= DAY_THRESHOLD : ldrPercent < NIGHT_THRESHOLD;
  readPirs(time);
  if (mode == "sweep" && millis() - sweepStartedAt > SWEEP_STEP_MS * 11) mode = "live";
  float brightness[POLE_COUNT];
  State states[POLE_COUNT];
  for (int pole = 0; pole < POLE_COUNT; pole++) {
    brightness[pole] = brightnessOf(pole, time, states[pole]);
    ledcWrite(LED_PINS[pole], int(brightness[pole] * 255));
  }
  if (millis() - lastReadingAt < READING_INTERVAL_MS) return;
  lastReadingAt = millis();
  if (socket.isConnected()) sendReading(time, ldrRaw, ldrPercent, brightness, states);
}
