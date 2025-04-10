#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Adafruit_Fingerprint.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>

// Configuración del sensor de huella AS608
#define RX_PIN 16
#define TX_PIN 17
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&Serial2);

// Configuración del OLED
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 32
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// Configuración de WiFi
const char* ssid = "Tu_SSID";
const char* password = "Tu_PASSWORD";

// Configuración de MQTT
const char* mqtt_server = "IP_PUBLICA_MQTT"; // IP pública del broker MQTT
const int mqtt_port = 1883;
const char* mqtt_username = "mqtt_user";     // Recomendado para seguridad
const char* mqtt_password = "mqtt_password"; // Recomendado para seguridad
const char* mqtt_client_id = "ESP32_Votacion";
const char* mqtt_topic = "votacion";

// API Backend
const char* api_server = "IP_PUBLICA_BACKEND";
const int api_port = 3000;

// Variables globales
WiFiClient espClient;
PubSubClient client(espClient);
bool puedeVotar = false;
unsigned long ultimaOperacion = 0;
bool esperandoVoto = false;

// Configuración de botones
#define BOTON_1 18
#define BOTON_2 19

void setup() {
    Serial.begin(115200);

    // Iniciar OLED primero para mostrar mensajes de estado
    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
        Serial.println("Error al iniciar el OLED.");
        while (1);
    }
    display.clearDisplay();
    mostrarMensaje("Iniciando sistema...");

    // Configuración del sensor de huellas
    Serial2.begin(57600, SERIAL_8N1, RX_PIN, TX_PIN);
    finger.begin(57600);
    if (finger.verifyPassword()) {
        Serial.println("Sensor de huellas detectado.");
        mostrarMensaje("Sensor de huella OK");
    } else {
        Serial.println("No se detectó el sensor de huellas.");
        mostrarMensaje("Error sensor huella");
        while (1);
    }

    // Configuración de botones
    pinMode(BOTON_1, INPUT_PULLUP);
    pinMode(BOTON_2, INPUT_PULLUP);

    // Configuración de WiFi
    conectarWiFi();

    // Configuración de MQTT
    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(callbackMQTT);

    delay(1000);
    mostrarMensaje("Sistema listo");
    delay(1000);
}

void loop() {
    // Verificar conexiones
    if (WiFi.status() != WL_CONNECTED) {
        conectarWiFi();
    }

    if (!client.connected()) {
        reconnectMQTT();
    }
    client.loop();

    // Estado normal: esperando huella
    if (!esperandoVoto) {
        // Cada 3 segundos actualizar mensaje
        if (millis() - ultimaOperacion > 3000) {
            mostrarMensaje("Coloque su huella\npara votar");
            ultimaOperacion = millis();
        }

        // Escanear huella
        int id = leerHuella();
        if (id > 0) {
            Serial.print("Huella detectada, ID: ");
            Serial.println(id);
            mostrarMensaje("Verificando...");

            // Verificar si ya votó
            puedeVotar = !verificarHuella(id);

            if (puedeVotar) {
                mostrarMensaje("Seleccione candidato:\nBtn1: Marco\nBtn2: Nacu");
                esperandoVoto = true;
                // Registrar que esta huella está votando
                registrarHuella(id);
            } else {
                mostrarMensaje("Ya ha votado\ncon esta huella");
                delay(3000);
            }
        }
    }
    // Estado de espera de voto
    else {
        if (digitalRead(BOTON_1) == LOW) {
            enviarVoto("Marco");
            esperandoVoto = false;
            delay(1000); // Evitar rebotes
        }

        if (digitalRead(BOTON_2) == LOW) {
            enviarVoto("Nacu");
            esperandoVoto = false;
            delay(1000); // Evitar rebotes
        }

        // Timeout para cancelar votación después de 30 segundos
        if (millis() - ultimaOperacion > 30000) {
            mostrarMensaje("Tiempo expirado");
            esperandoVoto = false;
            delay(2000);
        }
    }
}

void conectarWiFi() {
    mostrarMensaje("Conectando WiFi...");
    WiFi.begin(ssid, password);

    // Esperar conexión con timeout
    unsigned long startTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startTime < 20000) {
        delay(500);
        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi conectado");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
        mostrarMensaje("WiFi conectado");
    } else {
        Serial.println("\nError de conexión WiFi");
        mostrarMensaje("Error WiFi\nReintentando...");
    }
    delay(1000);
}

void reconnectMQTT() {
    int intentos = 0;
    while (!client.connected() && intentos < 5) {
        Serial.print("Conectando a MQTT...");
        mostrarMensaje("Conectando MQTT...");

        if (client.connect(mqtt_client_id, mqtt_username, mqtt_password)) {
            Serial.println("Conectado");
            mostrarMensaje("MQTT Conectado");
            client.subscribe(mqtt_topic);
        } else {
            Serial.print("Error, rc=");
            Serial.print(client.state());
            Serial.println(" Reintentando...");
            mostrarMensaje("Error MQTT");
            delay(2000);
        }
        intentos++;
    }
}

void callbackMQTT(char* topic, byte* payload, unsigned int length) {
    // Procesar mensajes MQTT recibidos si es necesario
    Serial.print("Mensaje recibido [");
    Serial.print(topic);
    Serial.print("]: ");
    for (int i = 0; i < length; i++) {
        Serial.print((char)payload[i]);
    }
    Serial.println();
}

int leerHuella() {
    int p = finger.getImage();
    if (p != FINGERPRINT_OK) return -1;

    p = finger.image2Tz();
    if (p != FINGERPRINT_OK) return -1;

    p = finger.fingerFastSearch();
    if (p != FINGERPRINT_OK) return -1;

    return finger.fingerID;
}

bool verificarHuella(int id) {
    HTTPClient http;
    String url = "http://" + String(api_server) + ":" + String(api_port) + "/verificar-huella";

    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["huella"] = String(id);

    String requestBody;
    serializeJson(doc, requestBody);

    int httpCode = http.POST(requestBody);
    bool yaVoto = false;

    if (httpCode > 0) {
        if (httpCode == HTTP_CODE_OK) {
            String payload = http.getString();
            StaticJsonDocument<200> responseDoc;
            deserializeJson(responseDoc, payload);
            yaVoto = responseDoc["registrado"];
        }
    } else {
        Serial.printf("Error HTTP: %s\n", http.errorToString(httpCode).c_str());
    }

    http.end();
    return yaVoto;
}

void registrarHuella(int id) {
    String mensaje = "{\"accion\":\"registro\",\"huella\":\"" + String(id) + "\"}";
    client.publish(mqtt_topic, mensaje.c_str());
    Serial.println("Huella registrada en MQTT");
    ultimaOperacion = millis();
}

void enviarVoto(String candidato) {
    String mensaje = "{\"accion\":\"voto\",\"candidato\":\"" + candidato + "\"}";
    if (client.publish(mqtt_topic, mensaje.c_str())) {
        Serial.println("Voto enviado: " + candidato);
        mostrarMensaje("Voto por " + candidato + "\nregistrado!");
    } else {
        Serial.println("Error al enviar voto");
        mostrarMensaje("Error al votar\nIntente de nuevo");
    }
    delay(3000);
    ultimaOperacion = millis();
}

void mostrarMensaje(String mensaje) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(WHITE);
    display.setCursor(0, 0);
    display.println(mensaje);
    display.display();
}
