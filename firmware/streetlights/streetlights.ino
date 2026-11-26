#include <Adafruit_INA219.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <WiFi.h>
#include <Wire.h>

const char *WIFI_SSID = "TU_RED_WIFI";
const char *WIFI_PASS = "TU_CLAVE_WIFI";
const char *SERVER_IP = "192.168.1.104";
const uint16_t SERVER_PORT = 8080;

const int POLE_COUNT = 6;
const int LED_PINS[POLE_COUNT] = {13, 12, 14, 27, 26, 25};
const int PIR_PINS[2] = {35, 34};
const int PIR_ACTIVE_LEVEL = HIGH;
const int ENTRANCES[2] = {0, 5};
const int LDR_PIN = 36;
const int SDA_PIN = 33;
const int SCL_PIN = 32;
const int STREETS[5][3] = {{0, 1, 30}, {1, 2, 30}, {1, 3, 30}, {3, 4, 30}, {4, 5, 30}};

const float BASE_LEVEL = 0.2;
const float HOLD_TIME = 30;
const float ANTICIPATION_TIME = 10;
const float WALKING_SPEED = 1.4;
const float NIGHT_THRESHOLD = 30;
const float DAY_THRESHOLD = 40;
const float CLOCK_FACTOR = 720;
const float WAVE_FACTOR = 10;
const float HALF_DAY_SECONDS = 12 * 3600.0;
const unsigned long READING_INTERVAL_MS = 500;
const unsigned long LAMP_TEST_MS = 5000;
const unsigned long CALIBRATION_STEP_MS = 3000;
const unsigned long PIR_SIGNAL_MS = 2000;
const int MAX_PLANS = 8;

enum State { Off, Base, Hold, Active, Fixed };
const char *STATE_NAMES[] = {"Off", "Base", "Hold", "Active", "Fixed"};

struct Window {
  float activeFrom;
  float holdFrom;
  float baseAt;
};

struct Plan {
  Window windows[POLE_COUNT];
  bool used;
};

Adafruit_INA219 ina219;
WebSocketsClient socket;
Plan plans[MAX_PLANS];
float distances[2][POLE_COUNT];
String strategy = "adaptive";
String mode = "auto";
bool isNight = false;
bool inaReady = false;
int nextPlan = 0;
int previousPir[2] = {LOW, LOW};
unsigned long lastDetection[2] = {0, 0};
unsigned long phaseStartedAt = 0;
unsigned long modeStartedAt = 0;
unsigned long lastReadingAt = 0;

void dijkstra(int origin, float *result) {
  float graph[POLE_COUNT][POLE_COUNT] = {};
  for (auto &street : STREETS) {
    graph[street[0]][street[1]] = street[2];
    graph[street[1]][street[0]] = street[2];
  }
  bool visited[POLE_COUNT] = {};
  for (int node = 0; node < POLE_COUNT; node++) {
    result[node] = node == origin ? 0 : INFINITY;
  }
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

float waveTime() {
  return millis() / 1000.0 * WAVE_FACTOR;
}

float phaseSeconds() {
  return min((millis() - phaseStartedAt) / 1000.0f * CLOCK_FACTOR, HALF_DAY_SECONDS);
}

String clockText() {
  int minutes = int(phaseSeconds() / 60);
  int hour = ((isNight ? 18 : 6) + minutes / 60) % 24;
  char text[6];
  snprintf(text, sizeof(text), "%02d:%02d", hour, minutes % 60);
  return String(text);
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

State windowState(Window &window, float time) {
  if (time < window.activeFrom || time >= window.baseAt) return Base;
  if (time < window.holdFrom) return Active;
  return Hold;
}

State stateAt(int pole, float time) {
  if (!isNight) return Off;
  State strongest = Base;
  for (auto &plan : plans) {
    if (plan.used) strongest = max(strongest, windowState(plan.windows[pole], time));
  }
  return strongest;
}

float scheduledLevel() {
  int hour = (18 + int(phaseSeconds() / 3600)) % 24;
  if (hour >= 23 || hour < 5) return 0.5;
  return 1;
}

float strategyLevel(State state) {
  if (!isNight) return 0;
  if (strategy == "permanent") return 1;
  if (strategy == "scheduled") return scheduledLevel();
  if (state == Base) return BASE_LEVEL;
  return 1;
}

float poleLevel(int pole, State &state) {
  state = stateAt(pole, waveTime());
  if (mode == "lampTest") {
    state = Fixed;
    return 1;
  }
  if (mode == "calibration") {
    state = Fixed;
    return min((millis() - modeStartedAt) / CALIBRATION_STEP_MS, 10UL) / 10.0;
  }
  float level = strategyLevel(state);
  if (strategy != "adaptive") state = level > 0 ? Fixed : Off;
  return level;
}

void updateMode() {
  unsigned long elapsed = millis() - modeStartedAt;
  if (mode == "lampTest" && elapsed > LAMP_TEST_MS) mode = "auto";
  if (mode == "calibration" && elapsed > CALIBRATION_STEP_MS * 11) mode = "auto";
}

void updateNight(float ldrPercent) {
  bool night = isNight ? ldrPercent <= DAY_THRESHOLD : ldrPercent < NIGHT_THRESHOLD;
  if (night == isNight) return;
  isNight = night;
  phaseStartedAt = millis();
}

void readPirs() {
  for (int sensor = 0; sensor < 2; sensor++) {
    int level = digitalRead(PIR_PINS[sensor]);
    if (level == PIR_ACTIVE_LEVEL && previousPir[sensor] != PIR_ACTIVE_LEVEL) {
      lastDetection[sensor] = millis();
      lightWavePlan(ENTRANCES[sensor], waveTime());
    }
    previousPir[sensor] = level;
  }
}

void startMode(const char *name) {
  mode = name;
  modeStartedAt = millis();
}

void onCommand(uint8_t *payload, size_t length) {
  JsonDocument command;
  if (deserializeJson(command, payload, length)) return;
  if (command["type"] != "command") return;
  String name = command["name"].as<String>();
  if (name == "setStrategy") strategy = command["value"].as<String>();
  if (name == "lampTest") startMode("lampTest");
  if (name == "calibrate") startMode("calibration");
}

void onSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  if (type == WStype_TEXT) onCommand(payload, length);
}

void sendReading(int ldrRaw, float ldrPercent, float *levels, State *states) {
  JsonDocument reading;
  reading["type"] = "reading";
  reading["strategy"] = strategy;
  reading["mode"] = mode;
  reading["isNight"] = isNight;
  reading["clock"] = clockText();
  reading["ldrRaw"] = ldrRaw;
  reading["ldrPercent"] = round(ldrPercent * 10) / 10.0;
  reading["pirA"] = millis() - lastDetection[0] < PIR_SIGNAL_MS ? 1 : 0;
  reading["pirB"] = millis() - lastDetection[1] < PIR_SIGNAL_MS ? 1 : 0;
  for (int pole = 0; pole < POLE_COUNT; pole++) {
    reading["brightness"].add(int(round(levels[pole] * 100)));
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
  for (int pole = 0; pole < POLE_COUNT; pole++) {
    ledcAttach(LED_PINS[pole], 5000, 8);
  }
  pinMode(PIR_PINS[0], INPUT);
  pinMode(PIR_PINS[1], INPUT);
  dijkstra(ENTRANCES[0], distances[0]);
  dijkstra(ENTRANCES[1], distances[1]);
  Wire.setPins(SDA_PIN, SCL_PIN);
  inaReady = ina219.begin();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  socket.begin(SERVER_IP, SERVER_PORT, "/esp32");
  socket.onEvent(onSocketEvent);
  socket.setReconnectInterval(2000);
}

void loop() {
  socket.loop();
  int ldrRaw = analogRead(LDR_PIN);
  float ldrPercent = ldrRaw / 4095.0 * 100;
  updateNight(ldrPercent);
  updateMode();
  readPirs();
  float levels[POLE_COUNT];
  State states[POLE_COUNT];
  for (int pole = 0; pole < POLE_COUNT; pole++) {
    levels[pole] = poleLevel(pole, states[pole]);
    ledcWrite(LED_PINS[pole], int(levels[pole] * 255));
  }
  if (millis() - lastReadingAt < READING_INTERVAL_MS) return;
  lastReadingAt = millis();
  if (socket.isConnected()) sendReading(ldrRaw, ldrPercent, levels, states);
}
