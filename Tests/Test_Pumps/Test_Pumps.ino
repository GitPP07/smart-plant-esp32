/*
  Test_Pumps.ino
  ------------------------------------------------
  Sketch di TEST per verificare il funzionamento
  delle 3 pompe tramite il modulo relè.

  ATTENZIONE: metti le pompe in acqua prima di
  avviare questo sketch — non farle girare a secco!

  Ogni pompa si attiva per 3 secondi, poi si spegne.
  Poi passa alla successiva.
*/

#define RELAY_PUMP_1_PIN 26
#define RELAY_PUMP_2_PIN 27
#define RELAY_PUMP_3_PIN 14

void setup() {
  Serial.begin(115200);

  pinMode(RELAY_PUMP_1_PIN, OUTPUT);
  pinMode(RELAY_PUMP_2_PIN, OUTPUT);
  pinMode(RELAY_PUMP_3_PIN, OUTPUT);

  // Tutte le pompe spente (HIGH = relè disattivato)
  digitalWrite(RELAY_PUMP_1_PIN, HIGH);
  digitalWrite(RELAY_PUMP_2_PIN, HIGH);
  digitalWrite(RELAY_PUMP_3_PIN, HIGH);

  Serial.println("Test pompe avviato.");
  Serial.println("Assicurati che le pompe siano in acqua!");
  delay(3000); // 3 secondi per prepararsi
}

void loop() {
  Serial.println("--- Attivo Pompa 1 per 3 secondi ---");
  digitalWrite(RELAY_PUMP_1_PIN, LOW);
  delay(3000);
  digitalWrite(RELAY_PUMP_1_PIN, HIGH);
  Serial.println("Pompa 1 spenta.");
  delay(2000);

  Serial.println("--- Attivo Pompa 2 per 3 secondi ---");
  digitalWrite(RELAY_PUMP_2_PIN, LOW);
  delay(3000);
  digitalWrite(RELAY_PUMP_2_PIN, HIGH);
  Serial.println("Pompa 2 spenta.");
  delay(2000);

  Serial.println("--- Attivo Pompa 3 per 3 secondi ---");
  digitalWrite(RELAY_PUMP_3_PIN, LOW);
  delay(3000);
  digitalWrite(RELAY_PUMP_3_PIN, HIGH);
  Serial.println("Pompa 3 spenta.");
  delay(2000);

  Serial.println("Ciclo completato. Ricomincio...");
  delay(3000);
}
