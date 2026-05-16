# Code ESP32 cho việc đọc nhiệt độ , độ ẩm và gửi lên raspi

```cpp

#include <WiFi.h>
#include "mqtt_client.h"
#include <ArduinoJson.h>

const char* ssid = "UDA.OFFICE";
const char* password = "English@AI";
const char* pi_broker="mqtt://192.168.6.81:1883";
char topic_pub[50];

//const char* ssid = "pi_1";
//const char* password = "11111111";

const char* client_id="esp_1";
esp_mqtt_client_handle_t client;

//espi/client_id/cmd : sub
//esp/client_id/data : publish
//frame điều khiển :  {"device_id":"relay_1","command":"ON"}

void create_json_data_info(float temperature, int humidity, bool status, char* bufferOut, size_t maxSize) {
  // 1. Khai báo JsonDocument (với v7, bộ nhớ tự động quản lý và dọn dẹp khi thoát hàm)
  JsonDocument doc; 
  // 2. Gán dữ liệu từ tham số truyền vào
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["status"] = status;
  
  serializeJson(doc, bufferOut, maxSize);
}

static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data) {
  esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;
  
  switch ((esp_mqtt_event_id_t)event_id) {
    case MQTT_EVENT_CONNECTED:
    {

      Serial.println("[MQTT] Đã kết nối thành công tới Broker!");
      
      //Subscribe
      char topic_sub[50];
      snprintf(topic_sub, sizeof(topic_sub), "esp/%s/cmd", client_id);
      esp_mqtt_client_subscribe(client,topic_sub, 0);
      
      Serial.println("[MQTT] Đã subcribe topic!");
      break;
    } 
    case MQTT_EVENT_DISCONNECTED:
    {
      Serial.println("[MQTT] Mất kết nối. Thư viện sẽ TỰ ĐỘNG kết nối lại!");
      break;
    }

    case MQTT_EVENT_DATA:
    {
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, event->data, event->data_len);
        if (error) {
            Serial.printf("Lỗi JSON: %s\n", error.c_str());
            break;
        }
        const char* device = doc["device_id"] | "unknown";
        const char* cmd    = doc["command"]    | "none";

        Serial.printf("Thiết bị: %s | Lệnh: %s\n", device, cmd);

        if (strcmp(cmd, "ON") == 0) {
            // Thực hiện bật relay
        }
        else if (strcmp(cmd, "OFF") == 0)
        {
          // Thực hiện tắt relay
        }

        

      break;
    }

    case MQTT_EVENT_ERROR:
    {
      Serial.println("[MQTT] Có lỗi xảy ra!");
      break;
    }
      
    default:
    {
      break;
    }
  }
}

void setup_wifi() {
  Serial.print("Đang kết nối WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print("x");
  }
  Serial.println("\nĐã kết nối WiFi!");
}

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);
  setup_wifi();
  esp_mqtt_client_config_t mqtt_cfg = {};
  mqtt_cfg.broker.address.uri = pi_broker;
  // 2. Khai báo Client ID (Nằm trong nhóm credentials) - Đã fix lỗi 1
  mqtt_cfg.credentials.client_id = client_id; 
  client = esp_mqtt_client_init(&mqtt_cfg);
  // 3. Đăng ký hàm sự kiện bằng MQTT_EVENT_ANY - Đã fix lỗi 2
  esp_mqtt_client_register_event(client, MQTT_EVENT_ANY, mqtt_event_handler, NULL);
  // Khởi động MQTT
  esp_mqtt_client_start(client);
}

void loop() {
  Serial.print("-");
  //Publish dữ liệu
  float temp = 26.5;
  int hum = 95;
  bool isRelay = false;
  memset(topic_pub, 0, sizeof(topic_pub));
  snprintf(topic_pub, sizeof(topic_pub), "esp/%s/data", client_id);
  char payload[256];
  create_json_data_info(temp,hum,isRelay,payload,sizeof(payload));
  //Serial.printf("topic_pub:%s\n",topic_pub);
  //Serial.printf("Payload:%s\n",payload);
  esp_mqtt_client_publish(client,topic_pub, payload , 0, 0, 0);
  vTaskDelay(pdMS_TO_TICKS(10000));
}

```