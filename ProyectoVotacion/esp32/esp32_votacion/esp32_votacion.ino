/*
#include <WiFi.h>
#include <PubSubClient.h>

const char* ssid = "UA-Alumnos";
const char* password = "41umn05WLC";
const char* mqtt_server = "broker.hivemq.com";

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
    Serial.begin(115200);
    setup_wifi();
    client.setServer(mqtt_server, 1883);
}

void setup_wifi() {
    delay(10);
    Serial.println("Conectando a WiFi...");
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("Conectado!");
}

void loop() {
    if (!client.connected()) {
        reconnect();
    }
    client.loop();
}

void enviarVoto(String candidato) {
    if (client.connected()) {
        client.publish("votacion/votos", candidato.c_str());
        Serial.println("Voto enviado!");
    }
}

void reconnect() {
    while (!client.connected()) {
        Serial.println("Intentando conexión MQTT...");
        if (client.connect("ESP32Client")) {
            Serial.println("Conectado a MQTT!");
        } else {
            delay(5000);
        }
    }
}
*/