# Cấu hình websocket và mqtt cho việc giao tiếp giữa raspi, app và server

---

# 1. Cài đặt thư viện

```
pip install channels daphne
sudo apt install redis-server -y
```


# 2. Cài đặt file ```setting.py```


```
DEBUG = True
ALLOWED_HOSTS=['*']
```

- cấu khình app:  daphne, channels, corsheaders, iot_base_app

```
INSTALLED_APPS = [
    'daphne',
    'channels',
    'corsheaders',
    'iot_base_app',
    'nested_admin',
    'django_extensions',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

```

- Cáu hình middleware

```
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.gzip.GZipMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]


```


- Cấu hình mqtt: chyển đổi http response sang  mqtt respose để đẩy điều khiển xuống raspi

```
MQTT_BRIDGE_URL = "http://localhost:5700/api/relay/mqtt"

```

- cấu hình chanel cho web socket

```
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("localhost", 6379)],
        },
    },
}


ASGI_APPLICATION = 'iot_base.asgi.application'

```

- Cấu hình chứng thực cho giao thưucs post
```
CSRF_TRUSTED_ORIGINS = [
    'http://127.0.0.1:5600', 
    'http://0.0.0.0:5600',
    'http://localhost:5600',
]

CORS_ALLOW_ALL_ORIGINS = True

```

## 3. Thêm file ```asgi.py```  vào trong thư mục iot_base

```python

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from iot_base_app.routing import websocket_urlpatterns # Import routing cá»§a app

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'iot_base.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(), # http
    "websocket": URLRouter(websocket_urlpatterns), # websocket
})

```
## 4. cấu hình ```urls.py```  trong thư mục iot_base

- djanog làm backend , flutter làm frontend . thư mục **web** nằm trong folder **iot_base**

```python

from django.contrib import admin
from django.urls import path,include
from django.conf.urls.static import static
from django.conf import settings
import os
from django.urls import path, re_path, include
from django.views.generic import TemplateView
from django.views.static import serve


FLUTTER_WEB_DIR = os.path.join(settings.BASE_DIR, 'web')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include("iot_base_app.urls")),

    # static file
    re_path(r'^(?P<path>.*\..*)$', serve, {'document_root': FLUTTER_WEB_DIR}),

    # frontend SPA (KHÃ”NG Äƒn API)
    re_path(r'^(?!api/).*$', TemplateView.as_view(template_name='index.html')),
]


```


# Websocket

## 5. Tạo file ```consumers.py``` trong folder  **iot_base_app**


```python

import json
from channels.generic.websocket import AsyncWebsocketConsumer
import asyncio

class SensorConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.pi_id = self.scope['url_route']['kwargs'].get('pi_id')
        self.client_id = self.scope['url_route']['kwargs'].get('client_id')
    
        self.groups_to_join = []

        if self.pi_id and not self.client_id:
            self.groups_to_join.append(f"{self.pi_id}")
        
        elif self.pi_id and self.client_id:
            self.groups_to_join.append(f"{self.pi_id}_{self.client_id}")

        for group in self.groups_to_join:
            await self.channel_layer.group_add(group, self.channel_name)

        await self.accept()
        
    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def sensor_message(self, event):
        message = event['message']
        await self.send(text_data=json.dumps(message))

```



## 6. Tạo file ```routing.py``` trong folder **iot_base_app** để route cho soketweb

```python
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/(?P<pi_id>\w+)/$', consumers.SensorConsumer.as_asgi()),
    re_path(r'ws/(?P<pi_id>\w+)/(?P<client_id>\w+)/$', consumers.SensorConsumer.as_asgi()),
]

```

# Mqtt


## 7. tạo thưu viện mqtt bridge và chạy dịch vụ  Sẽ chạy ngầm

### 7.1 tạo file  `my_mqtt.py`

```python
from paho.mqtt.client import Client
from paho.mqtt.properties import Properties
from paho.mqtt.packettypes import PacketTypes
import paho.mqtt.client as mqtt
import json
import time
from paho.mqtt.enums import CallbackAPIVersion, MQTTProtocolVersion,MQTTErrorCode
from paho.mqtt.reasoncodes import ReasonCode
import enum
import threading
import queue
from threading import Lock
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
            print(f'[OK][client_connect]: ÄÃ£ gá»­i yÃªu cáº§u connect thÃ nh cÃ´ng')
            return True
        except Exception as error:
            print(f'[ERROR][cliient_connect] lá»—i káº¿t ná»‘i:{error}')
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
                print(f'[OK][subscribe_topics]: Ä‘Ã£ gá»­i lá»‡nh yÃªu cáº§u thÃ nh cÃ´ng')
            else:
                print(f'[ERROR][subscribe_topics]: lá»—i gá»­i lá»‡nh:{rc}')
                self.rx_queue.put('ERROR_SUBSCRIBE')
    
    def client_publish(self,topic:str,payload:dict):
        if self.system_ready.is_set():
            payload_to_send = json.dumps(payload)  # chuyá»ƒn thÃ nh kiá»ƒu jsoan
            self.publish(topic, payload_to_send)
            return True
        return False
        
            
    def on_connect_(self,client, obj, flags, reason_code, properties):
        if reason_code == 0:
            print(f'[OK][on_connect_]: Ä‘Ã£ káº¿t ná»‘i thÃ nh cÃ´ng vá»›i broker')
            if self.topics_sub:
                self.subscribe_topics()
            else:
                self.system_ready.set()
        else:
            print(f'[OK][on_connect_]: lá»—i káº¿t ná»‘i broker:{reason_code}')
                            
    def on_subscribe_(self, client, obj, mid, reason_codes, properties):
        with self.tracker_lock:
            if mid in self.sub_tracker:
                success_count = sum(1 for rc in reason_codes if not rc.is_failure)
                expected = self.sub_tracker[mid]["expected_count"]
                if success_count == expected:
                    print(f"[OK] [on_subscribe_]ÄÃ£ Ä‘Äƒng kÃ½ thÃ nh cÃ´ng toÃ n bá»™ {success_count} topics!")
                    self.system_ready.set() # Báº­t cá» cho Main Thread cháº¡y
                    print(f"[OK] [MY_MQTT] báº­t cá» system_ready")
                else:
                    print(f"[ERROR] [on_subscribe_] lá»—i thiáº¿u gÃ³i: {success_count}/{expected} topics") 
                    self.system_ready.clear()
                    print(f"[ERROR] [MY_MQTT] táº¯t cá» system_ready")
                    
    def on_disconnect_(self,client,obj,disconnect_flags,reason_code,properties):
        self.system_ready.clear() 
        if reason_code == 0:
            print("['ERROR][MY_MQTT] chá»§ Ä‘á»™ng ngáº¯t káº¿t ná»‘i an toÃ n (Graceful Disconnect).")
        else:
            print(f"['ERROR][MY_MQTT] Máº¥t káº¿t ná»‘i váº­t lÃ½! (MÃ£ lá»—i: {reason_code})")

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
            print(f"[ERROR][on_message_]:lá»—i Ä‘á»‹nh dáº¡ng json")
        except Exception as e:
            print(f"[ERROR][on_message_]:lá»—i ngoáº¡i lá»‡:{e}")
    
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
                print(f"\n[Controller] ---> ÄÃƒ NHáº¬N Lá»†NH Tá»ª TOPIC: {msg['topic']}")
                print(f"[Controller] ---> Dá»® LIá»†U: {msg['data']}")
    
    mqtt_queue_rx=queue.Queue()
    client_1=MyMqtt('client_1','192.168.137.58',1883,rx_queue=mqtt_queue_rx)
    thread_mqtt_controler=threading.Thread(target=thread_mqtt_controler_handler,daemon=True)
    thread_mqtt_controler.start()
    try:
        # Khá»Ÿi táº¡o vÃ  cháº¡y cÃ¡c luá»“ng cá»§a báº¡n á»Ÿ Ä‘Ã¢y...
        while True:
            print(f'{dt.now()}')
            time.sleep(5)
    
    except KeyboardInterrupt:
        print("\n[System] Äang táº¯t há»‡ thá»‘ng...")
        client_1.disconnect() 
        client_1.loop_stop()
```


### 7.2 tạo file  `http_relay_mqtt.py`

```python
from flask import Flask, request, jsonify
import paho.mqtt.client as mqtt
import json
from my_mqtt import MyMqtt
import threading
import queue
import time
from datetime import datetime as dt

mqtt_queue_rx=queue.Queue()
client_id='client_linux_2'
broker_ip='localhost'
broker_port=1883

client_mqtt_1=MyMqtt(
    client_id,broker_ip,broker_port,rx_queue=mqtt_queue_rx)

def thread_1_mqtt_handler():
    print("Báº¯t Ä‘áº§u connect mqtt...")
    client_mqtt_1.client_connect()
    while True:
            msg=mqtt_queue_rx.get()
            if client_mqtt_1.callback_msg_error(msg):
                continue
 
thread_1_mqtt=threading.Thread(target=thread_1_mqtt_handler,daemon=True)
thread_1_mqtt.start()

app = Flask(__name__)
@app.route('/api/relay/mqtt', methods=['POST'])
def publish():
    try:
        data = request.get_json(force=True)
        topic = data.get("topic")
        payload = data.get("payload")
        if not topic or payload is None:
            return jsonify({"error": "Missing 'topic' or 'message'"}), 400
        result=client_mqtt_1.client_publish(topic, payload)
        if result:
            return jsonify({"status": "published", "topic": topic}), 200
        else:
            return jsonify({"error":"not connect to broker"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='localhost', port=5700,debug=False)
    
```

### 7.3 Tạo file `http_relay_mqtt.sh`

```
#!/bin/bash

PROJECT_DIR="/home/dat/project_dat/django-web-blog/iot_base/mqtt_bridge"
VENV_PATH="/home/dat/project_dat/django-web-blog/myenv1/bin/activate"
source "$VENV_PATH"
cd "$PROJECT_DIR"

exec gunicorn -w 1 -b 0.0.0.0:5700 http_relay_mqtt:app
deactivate
```

### 7.4 Tạo service  htpp_relay_mqtt

```
[Unit]
Description=Flask MQTT Bridge via custom shell script
After=network.target

[Service]
User=dat
WorkingDirectory=/home/dat/project_dat/django-web-blog/iot_base/mqtt_bridge
ExecStart=/bin/bash /home/dat/project_dat/django-web-blog/iot_base/mqtt_bridge/http_relay_mqtt.sh
Restart=always

[Install]
WantedBy=multi-user.target
```


## 8. tạo file `services.py` trong folder **iot_base_app** 

```python

def send_to_mqtt_bridge(topic: str, payload: dict) -> tuple:
 
    flask_bridge_url = settings.MQTT_BRIDGE_URL
    print(flask_bridge_url)
    data_to_send = {
        "topic": topic,
        "payload": payload
    }

    try:
        response = requests.post(flask_bridge_url, json=data_to_send, timeout=3)
        
        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"Bridge Error {response.status_code}: {response.text}"
            
    except requests.exceptions.RequestException as e:
        return False, f"Connection to Bridge failed: {str(e)}"

```

## 9. Tạo file ```urls.py``` trong folder **iot_base_app** để route api

```python

from django.urls import path
from . import views

urlpatterns = [
   path("test/server/",views.test_server.as_view(),name="test-server"),
   path("test/mqtt/",views.test_mqtt.as_view(),name="test-mqtt"),
   path("v1/pi/<str:pi_id>/telemetry/live/",views.PiTelemetryLiveAPIView.as_view(),name="pi_telemetry_live_view"),
   path("v1/pi/<str:pi_id>/telemetry/sync/",views.PiTelemetrySyncAPIView.as_view(),name="pi_telemetry_sync_view"),
   path("v1/devices/control/", views.DeviceControlAPIView.as_view(), name="device-control"),

]

```

## 10. Viết chương trình cho file ```views.py``` để test

```python

from datetime import date
from django.http import HttpResponseRedirect,JsonResponse,HttpResponse
from django.urls import reverse
from django.shortcuts import render,get_object_or_404
from django.template.loader import render_to_string 
from django.views.generic import ListView,DetailView
from django.views import View
from django.views.decorators.csrf import csrf_exempt # Cáº§n thiáº¿t cho API tá»« thiáº¿t bá»‹
from django.utils.decorators import method_decorator
import json 
from django.utils import timezone
from django.utils.timezone import now
from datetime import datetime
from pytz import timezone as pytz_timezone 
from django.utils.dateparse import parse_datetime
from collections import defaultdict
from django.db.models import Prefetch, Count, Sum, OuterRef, Subquery, CharField,FloatField,DateTimeField,Q,Max
import re
from django.conf import settings
import requests
from django.core.cache import cache
from django.db import transaction
from .services import create_topic_control,create_topic_notify,send_to_mqtt_bridge
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

class test_server(View):
    def get(self, request):
        context = {
            "server": "dat-linux",
            "project":"iot-base" 
        }
        return JsonResponse(context, safe=False)
        
class test_mqtt(View):
    def get(self, request):
        topic=create_topic_control('pi_1')
        print(topic)
        payload={
            'cmd':'on pump'
        }
        is_success, result=send_to_mqtt_bridge(topic,payload)
        if is_success:
            return JsonResponse({
                "status": "success",
                "message": "ÄÃ£ Ä‘áº©y lá»‡nh Ä‘i",
                "bridge_reply": result
            })
        else:
            return JsonResponse({
                "status": "error",
                "message": result
            }, status=503)



# nhận dữ liệu realtime từ pi và đẩy vào websocket
@method_decorator(csrf_exempt, name='dispatch')
class PiTelemetryLiveAPIView(View):
    
    def post(self, request, pi_id):
        try:
            payload = json.loads(request.body)
            node_id=payload['node_id']
            channel_layer = get_channel_layer()
            group_name = f"{pi_id}_{node_id}" 
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "sensor_message", 
                    "message": payload 
                }
            )
            return JsonResponse({"status": "ok"}, status=200)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


# Nhận dữ liệu theo batch và lưu trữ vào cơ sở dữ liệu
@method_decorator(csrf_exempt, name='dispatch')
class PiTelemetrySyncAPIView(View):
    def post(self, request, pi_id):
        try:
            payload = json.loads(request.body)
            print(payload)
            return JsonResponse({"status": "ok"}, status=200)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)



# nhận dữ liệu tử app  và  đẩy xuông raspi  thông qua mqtt

@method_decorator(csrf_exempt, name='dispatch')
class DeviceControlAPIView(View):
    def post(self, request):
        try:
            payload = json.loads(request.body)
            pi_id=payload['pi_id']
            print(pi_id)
            send_to_mqtt_bridge(f"server/pi/{pi_id}/control" ,payload)    
            return JsonResponse({"status": "ok"}, status=200)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


```