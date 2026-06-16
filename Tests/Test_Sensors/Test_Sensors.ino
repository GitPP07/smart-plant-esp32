/*
  Test_Sensors.ino
  ------------------------------------------------
  Sketch di TEST per verificare i collegamenti
  dei 3 sensori di umidità e leggere i valori ADC.

  Procedura di test:
  1. Tieni i sensori in aria (suolo secco simulato)
     → annota i valori letti (dovrebbero essere alti, vicino a 4095)
  2. Immergi i sensori in un bicchiere d'acqua (suolo bagnato simulato)
     → annota i valori letti (dovrebbero essere bassi, vicino a 0)

  Questi valori serviranno per calibrare le soglie
  MOISTURE_THRESHOLD in config.h durante la Fase 3.
*/

#define SENSOR_1_PIN     32
#define SENSOR_2_PIN     33
#define SENSOR_3_PIN     34
#define SENSOR_POWER_PIN 25

void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_POWER_PIN, OUTPUT);
  digitalWrite(SENSOR_POWER_PIN, LOW); // sensori spenti di default
  Serial.println("Test sensori umidità avviato.");
  Serial.println("Lettura ogni 2 secondi.");
  Serial.println("------------------------------");
}

void loop() {
  // Accendi i sensori
  digitalWrite(SENSOR_POWER_PIN, HIGH);
  delay(10); // attendi stabilizzazione

  // Leggi i valori ADC
  int val1 = analogRead(SENSOR_1_PIN);
  int val2 = analogRead(SENSOR_2_PIN);
  int val3 = analogRead(SENSOR_3_PIN);

  // Spegni i sensori
  digitalWrite(SENSOR_POWER_PIN, LOW);

  // Stampa i valori
  Serial.printf("Sensore 1: %d | Sensore 2: %d | Sensore 3: %d\n", val1, val2, val3);

  delay(2000);
}
