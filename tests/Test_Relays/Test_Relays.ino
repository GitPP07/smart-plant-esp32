/*
  Test_Relays.ino
  ------------------------------------------------
  Sketch di TEST per verificare i collegamenti
  ESP32 -> Modulo relè (IN1, IN2, IN3).

  NON collegare ancora le pompe per questo test:
  vogliamo solo sentire il "click" del relè e
  vedere il LED sul modulo accendersi/spegnersi.

  Relè Low-Level-Trigger:
    LOW  = relè attivato (click, LED acceso)
    HIGH = relè disattivato (riposo)
*/

#define RELAY_PUMP_1_PIN 26  // IN1
#define RELAY_PUMP_2_PIN 27  // IN2
#define RELAY_PUMP_3_PIN 14  // IN3

void setup() {
  Serial.begin(115200);

  pinMode(RELAY_PUMP_1_PIN, OUTPUT);
  pinMode(RELAY_PUMP_2_PIN, OUTPUT);
  pinMode(RELAY_PUMP_3_PIN, OUTPUT);

  // Stato di riposo: tutti i relè disattivati (HIGH)
  digitalWrite(RELAY_PUMP_1_PIN, HIGH);
  digitalWrite(RELAY_PUMP_2_PIN, HIGH);
  digitalWrite(RELAY_PUMP_3_PIN, HIGH);

  Serial.println("Test relè avviato. Ogni relè verrà attivato per 1 secondo, uno alla volta.");
  delay(1000);
}

void loop() {
 
}
