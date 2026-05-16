# Code Raspbery

https://github.com/datld47/raspi-aun.git


## 1. `app.py`

```python
from my_mqtt import MyMqtt
import threading
import queue
import time
from datetime import datetime as dt
from datetime import timezone
import requests
import random
import json
from threading import Lock

mqtt_queue_rx=queue.Queue()
pi_id='pi_1'

client_id_1=f'{pi_id}_local'
broker_local_ip='localhost'
broker_local_port=1883

topics_sub=[
    'esp/+/data'
]

client_mqtt_1=MyMqtt(
    client_id_1,broker_local_ip,broker_local_port,topics_sub,mqtt_queue_rx)

def thread_1_mqtt_handler():
    print("Bắt đầu connect mqtt broker local...")
    client_mqtt_1.client_connect()
    while True:
        msg=mqtt_queue_rx.get()
        print(msg)
        if client_mqtt_1.callback_msg_error(msg):
            continue
        if isinstance(msg, dict):
            topic=msg['topic']
            if topic.startswith('esp/') and topic.endswith('/data'):
                parts = topic.split('/')
                node_id = parts[2]
                print(f"[{node_id}][DATA]:{msg['data']}")


if __name__=="__main__":
    thread_1_mqtt=threading.Thread(target=thread_1_mqtt_handler,daemon=True)
    thread_1_mqtt.start()
    try:
        while True:
            input('')
            print('Nhập thông số điều khiển điều khiển:')
            esp_id = input('Nhập esp id:')
            device_id=input('Nhập esp device id:')
            cmd=input('Nhập lệnh điều khiển: ON/OFF:')
            topic_pub=f'esp/{esp_id}/cmd'
            print(topic_pub)
            payload={'device_id':device_id,'command':cmd}
            client_mqtt_1.client_publish(topic_pub,payload)
                  
    except Exception as error:
        print(f"\n[System] Đang tắt hệ thống...{error}")
        client_mqtt_1.close()
```




## 2. `my_mqtt.py`


```python

from paho.mqtt.client import Client
from paho.mqtt.properties import Properties
from paho.mqtt.packettypes import PacketTypes
import json
import time
from paho.mqtt.enums import CallbackAPIVersion, MQTTProtocolVersion,MQTTErrorCode
import threading
import queue
from datetime import datetime as dt

class MyMqtt(Client):
    
    def __init__(self,client_id,broker_ip,broker_port,topics_sub=None,rx_queue=None,
                 api_version=CallbackAPIVersion.VERSION2,mqtt_protocol=MQTTProtocolVersion.MQTTv5):
        super().__init__(
            callback_api_version=api_version,
            client_id=client_id,
            protocol=mqtt_protocol)
        self.broker_ip=broker_ip
        self.broker_port=broker_port
        self.client_id= client_id
        self.rx_queue=rx_queue
        self.topics_sub=topics_sub
        self.sub_tracker = {}
        self.tracker_lock = threading.Lock()
        self.system_ready = threading.Event()
        self.on_connect = self.on_connect_
        self.on_subscribe = self.on_subscribe_
        self.on_disconnect=self.on_disconnect_
        self.on_message = self.on_message_
   
    def client_connect(self):
        #msg_will={"client_id":f'{self.client_id}',"status_connect":False}
        #topic_will="client/offline"
        keepalive=60
        clean_start=True
        connect_properties = Properties(PacketTypes.CONNECT)
        #connect_properties.SessionExpiryInterval = 100
        #self.will_set(topic_will,json.dumps(msg_will),qos=1)
        try:
            self.connect(host=self.broker_ip,
                        port=self.broker_port,
                        keepalive=keepalive,
                        clean_start=clean_start,
                        properties=connect_properties)
            
            self.loop_start() 
            print(f'[OK][client_connect]: Đã gửi yêu cầu connect thành công')
            return True
        except Exception as error:
            print(f'[ERROR][cliient_connect][{self.client_id}] lỗi kết nối:{error}')
            self.rx_queue.put('ERROR_CONNECT')
            return False

    def subscribe_topics(self):
        if self.sub_tracker:
            self.sub_tracker.clear()
            
        if self.topics_sub:
            batch_topics = [(topic, 1) for topic in self.topics_sub]
            rc,mid = self.subscribe(batch_topics)
            if rc==0:
                with self.tracker_lock:
                        self.sub_tracker[mid] = {
                            "expected_count": len(batch_topics),
                            "status": "pending"
                        }
                print(f'[OK][subscribe_topics]: đã gửi lệnh yêu cầu thành công')
            else:
                print(f'[ERROR][subscribe_topics]: lỗi gửi lệnh:{rc}')
                self.rx_queue.put('ERROR_SUBSCRIBE')
    
    def client_publish(self,topic:str,payload:dict):
        if self.system_ready.is_set():
            payload_to_send = json.dumps(payload)  # chuyển thành kiểu jsoan
            self.publish(topic, payload_to_send)
            return True
        return False
        
            
    def on_connect_(self,client, obj, flags, reason_code, properties):
        if reason_code == 0:
            print(f'[OK][on_connect_]: đã kết nối thành công với broker')
            if self.topics_sub:
                self.subscribe_topics()
            else:
                self.system_ready.set()
        else:
            print(f'[OK][on_connect_]: lỗi kết nối broker:{reason_code}')
                            
    def on_subscribe_(self, client, obj, mid, reason_codes, properties):
        with self.tracker_lock:
            if mid in self.sub_tracker:
                success_count = sum(1 for rc in reason_codes if not rc.is_failure)
                expected = self.sub_tracker[mid]["expected_count"]
                if success_count == expected:
                    print(f"[OK] [on_subscribe_]Đã đăng ký thành công toàn bộ {success_count} topics!")
                    self.system_ready.set() # Bật cờ cho Main Thread chạy
                    print(f"[OK] [MY_MQTT] bật cờ system_ready")
                else:
                    print(f"[ERROR] [on_subscribe_] lỗi thiếu gói: {success_count}/{expected} topics") 
                    self.system_ready.clear()
                    print(f"[ERROR] [MY_MQTT] tắt cờ system_ready")
                    
    def on_disconnect_(self,client,obj,disconnect_flags,reason_code,properties):
        self.system_ready.clear() 
        if reason_code == 0:
            print("['ERROR][MY_MQTT] chủ động ngắt kết nối an toàn (Graceful Disconnect).")
        else:
            print(f"['ERROR][MY_MQTT] Mất kết nối vật lý! (Mã lỗi: {reason_code})")

    def on_message_(self, client, obj, msg):
        try:
            payload_str = msg.payload.decode('utf-8')
            data = json.loads(payload_str)
            command = {
                "topic": msg.topic,
                "data": data
            }
            if self.rx_queue:
                self.rx_queue.put(command)
            else:
                print(command)
            print(f"[OK][on_message_]:{msg.topic}")
        except json.JSONDecodeError:
            print(f"[ERROR][on_message_]:lỗi định dạng json")
        except Exception as e:
            print(f"[ERROR][on_message_]:lỗi ngoại lệ:{e}")
    
    def callback_msg_error(self,msg):
        if msg=='ERROR_CONNECT':
            time.sleep(5)
            self.client_connect()
            return True
        elif msg=='ERROR_SUBSCRIBE':
            time.sleep(5)
            if self.is_connected():
                self.subscribe_topics()
            return True
        return False
    
    def close(self):
        self.disconnect() 
        self.loop_stop()

             
if __name__=='__main__':
    
    def thread_mqtt_controler_handler():
        global client_1
        global mqtt_queue_rx
        client_1.client_connect()
        while True:
            msg=mqtt_queue_rx.get()
            if client_1.callback_msg_error(msg):
                continue
            if isinstance(msg, dict):
                print(f"\n[Controller] ---> ĐÃ NHẬN LỆNH TỪ TOPIC: {msg['topic']}")
                print(f"[Controller] ---> DỮ LIỆU: {msg['data']}")
    
    mqtt_queue_rx=queue.Queue()
    client_1=MyMqtt('client_1','192.168.137.58',1883,rx_queue=mqtt_queue_rx)
    thread_mqtt_controler=threading.Thread(target=thread_mqtt_controler_handler,daemon=True)
    thread_mqtt_controler.start()
    try:
        # Khởi tạo và chạy các luồng của bạn ở đây...
        while True:
            print(f'{dt.now()}')
            time.sleep(5)
    
    except KeyboardInterrupt:
        print("\n[System] Đang tắt hệ thống...")
        client_1.disconnect() 
        client_1.loop_stop()



```