#include <WiFi.h>
#include <PubSubClient.h>
#include <Adafruit_Fingerprint.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

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
const char* mqtt_server = "IP_PRIVADA_MQTT";
WiFiClient espClient;
PubSubClient client(espClient);

// Configuración de botones
#define BOTON_1 18
#define BOTON_2 19

void setup() {
    Serial.begin(115200);
    
    // Configuración del sensor de huellas
    Serial2.begin(57600, SERIAL_8N1, RX_PIN, TX_PIN);
    finger.begin(57600);
    if (finger.verifyPassword()) {
        Serial.println("Sensor de huellas detectado.");
    } else {
        Serial.println("No se detectó el sensor de huellas.");
        while (1);
    }

    // Configuración del OLED
    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
        Serial.println("Error al iniciar el OLED.");
        while (1);
    }
    display.clearDisplay();
    
    // Configuración de WiFi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("WiFi conectado");

    // Configuración de MQTT
    client.setServer(mqtt_server, 1883);

    // Configuración de botones
    pinMode(BOTON_1, INPUT_PULLUP);
    pinMode(BOTON_2, INPUT_PULLUP);
}

void loop() {
    if (!client.connected()) {
        reconnectMQTT();
    }
    client.loop();

    // Mensaje en OLED
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(WHITE);
    display.setCursor(0, 10);
    display.println("Verifique si puede votar");
    display.display();

    // Escanea la huella
    int id = leerHuella();
    if (id == -1) {
        return;
    }

    // Verificar en la base de datos
    if (verificarHuella(id)) {
        mostrarMensaje("Usted no puede votar");
    } else {
        registrarHuella(id);
        mostrarMensaje("Botón 1 -> Marco\nBotón 2 -> Nacu");

        // Esperar voto
        while (true) {
            if (digitalRead(BOTON_1) == LOW) {
                enviarVoto("Marco");
                break;
            }
            if (digitalRead(BOTON_2) == LOW) {
                enviarVoto("Nacu");
                break;
            }
        }
    }

    delay(2000);
}

int leerHuella() {
    int p = finger.getImage();
    if (p != FINGERPRINT_OK) return -1;

    p = finger.image2Tz();
    if (p != FINGERPRINT_OK) return -1;

    p = finger.fingerFastSearch();
    if (p != FINGERPRINT_OK) return -1;

    Serial.print("Huella detectada, ID: ");
    Serial.println(finger.fingerID);
    return finger.fingerID;
}

bool verificarHuella(int id) {
    // Enviar solicitud HTTP al backend para verificar si la huella está en la base de datos
    WiFiClient clientHttp;
    if (!clientHttp.connect("IP_PRIVADA_DATABASE", 3000)) {
        Serial.println("Error de conexión con el servidor");
        return false;
    }
    
    String request = String("POST /verificar-huella HTTP/1.1\r\n") +
                     "Host: IP_PRIVADA_DATABASE\r\n" +
                     "Content-Type: application/json\r\n" +
                     "Content-Length: " + String(String("{\"huella\":\"" + String(id) + "\"}").length()) + "\r\n\r\n" +
                     "{\"huella\":\"" + String(id) + "\"}";
    
    clientHttp.print(request);
    delay(500);
    
    while (clientHttp.available()) {
        String response = clientHttp.readString();
        if (response.indexOf("\"registrado\":true") > 0) {
            return true;
        }
    }
    return false;
}

void registrarHuella(int id) {
    String mensaje = "registro:" + String(id);
    client.publish("votacion", mensaje.c_str());
    Serial.println("Huella registrada en MQTT");
}

void enviarVoto(String candidato) {
    String mensaje = "voto:" + candidato;
    client.publish("votacion", mensaje.c_str());
    Serial.println("Voto enviado: " + candidato);
    mostrarMensaje("Voto enviado!");
}

void mostrarMensaje(String mensaje) {
    display.clearDisplay();
    display.setCursor(0, 10);
    display.println(mensaje);
    display.display();
}

void reconnectMQTT() {
    while (!client.connected()) {
        Serial.print("Intentando conectar a MQTT...");
        if (client.connect("ESP32_Client")) {
            Serial.println("Conectado!");
        } else {
            Serial.print("Error, rc=");
            Serial.print(client.state());
            Serial.println(" Intentando de nuevo en 5s...");
            delay(5000);
        }
    }
}
