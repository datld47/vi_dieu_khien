# Code flutter

## 1. `home_screen.dart`

```dart

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:mqtt_client/mqtt_browser_client.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:scada_dashboard/iot_aun/btn_connect.dart';
import 'package:scada_dashboard/iot_aun/card_sensor.dart';
import 'package:syncfusion_flutter_charts/charts.dart';
import 'package:intl/intl.dart';
import 'package:scada_dashboard/iot_aun/relay_control.dart';
import 'package:flutter/foundation.dart';

class ChartData {
  ChartData(this.timestamp, this.temperature, this.humidity);
  final DateTime timestamp;
  final double temperature;
  final double humidity;
}

class IoTDashboard extends StatefulWidget {
  const IoTDashboard({super.key});

  @override
  State<IoTDashboard> createState() => _IoTDashboardState();
}

class _IoTDashboardState extends State<IoTDashboard> {
  // MQTT Client
  MqttBrowserClient? client;

  // Controllers cho Input
  final TextEditingController _ipController = TextEditingController(
    text: '192.168.5.73',
  ); // IP cá»§a Pi
  final TextEditingController _portController = TextEditingController(
    text: '8080',
  ); // Port WebSockets
  final TextEditingController _espIdController = TextEditingController(
    text: 'esp_1',
  );

  // Tráº¡ng thÃ¡i há»‡ thá»‘ng
  bool isConnected = false;

  // Dá»¯ liá»‡u hiá»ƒn thá»‹
  String temperature = "--";
  String humidity = "--";
  String pumpStatus = "OFF";

  final List<ChartData> _chartData = [];

  // HÃ m káº¿t ná»‘i MQTT
  Future<void> connectMQTT() async {
    final ip = _ipController.text;
    final port = int.tryParse(_portController.text) ?? 8080;
    final espId = _espIdController.text;

    if (ip.isEmpty || espId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lÃ²ng nháº­p Ä‘á»§ IP vÃ  ESP ID')),
      );
      return;
    }

    // khoi tao client
    client = MqttBrowserClient(
      'ws://$ip',
      'flutter_web_client_${DateTime.now().millisecondsSinceEpoch}',
    );
    client!.port = port;
    client!.websocketProtocols = MqttClientConstants.protocolsSingleDefault;
    client!.logging(on: true);

    try {
      //print('Äang káº¿t ná»‘i Ä‘áº¿n ws://$ip:$port...');
      await client!.connect(); //goi ket noi bat dong bo
    } catch (e) {
      //print('Lá»—i káº¿t ná»‘i: $e');
      client!.disconnect();
      return;
    }

    // ket noi thanh cong

    if (client!.connectionStatus!.state == MqttConnectionState.connected) {
      setState(() {
        isConnected = true; //thay doi trang thai
      });

      //print('Káº¿t ná»‘i thÃ nh cÃ´ng!');

      // Subscribe vÃ o Topic láº¯ng nghe Data
      final topicSub = 'esp/$espId/data';
      client!.subscribe(topicSub, MqttQos.atMostOnce);

      //============= su kien Láº¯ng nghe dá»¯ liá»‡u tráº£ vá» ==================//
      client!.updates!.listen((List<MqttReceivedMessage<MqttMessage>> c) {
        final MqttPublishMessage message = c[0].payload as MqttPublishMessage;
        final payload = MqttPublishPayload.bytesToStringAsString(
          message.payload.message,
        );
        try {
          final data = jsonDecode(payload);
          final temp = double.tryParse(data['temperature'].toString()) ?? 0;
          final hum = double.tryParse(data['humidity'].toString()) ?? 0;
          final now = DateTime.now();

          setState(() {
            temperature = temp.toString();
            humidity = hum.toString();

            // Giáº£ sá»­ Node tráº£ vá» tráº¡ng thÃ¡i bÆ¡m hiá»‡n táº¡i
            if (data.containsKey('status')) {
              pumpStatus = data['status'] == 1 ? 'ON' : 'OFF';
            }

            _chartData.add(ChartData(now, temp, hum));
            _chartData.sort((a, b) => a.timestamp.compareTo(b.timestamp));

            if (_chartData.length > 50) {
              _chartData.removeAt(0);
            }
          });
        } catch (e) {
          print('Lá»—i parse JSON: $e');
        }
      });

      //====================================================//
    } else {
      client!.disconnect();
    }
  }

  // HÃ m ngáº¯t káº¿t ná»‘i
  void disconnectMQTT() {
    client?.disconnect();
    setState(() {
      isConnected = false;
      temperature = "--";
      humidity = "--";
      pumpStatus = "OFF";
    });
  }

  // HÃ m Publish lá»‡nh Ä‘iá»u khiá»ƒn
  void sendCommand(String command) {
    if (client == null ||
        client!.connectionStatus!.state != MqttConnectionState.connected) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('ChÆ°a káº¿t ná»‘i Ä‘áº¿n Broker!')));
      return;
    }

    final espId = _espIdController.text;
    final topicPub = 'esp/$espId/cmd';

    // ÄÃ³ng gÃ³i JSON giá»‘ng ká»‹ch báº£n Python cá»§a báº¡n
    final payloadMap = {
      'device_id': 'relay_1', // Báº¡n cÃ³ thá»ƒ thÃªm Ã´ input cho cÃ¡i nÃ y náº¿u muá»‘n
      'command': command,
    };

    final builder = MqttClientPayloadBuilder();
    builder.addString(jsonEncode(payloadMap));

    //print('Publishing to $topicPub: ${jsonEncode(payloadMap)}');

    client!.publishMessage(topicPub, MqttQos.atLeastOnce, builder.payload!);

    // Cáº­p nháº­t UI táº¡m thá»i (sáº½ chuáº©n xÃ¡c hÆ¡n náº¿u Ä‘á»£i pháº£n há»“i tá»« ESP)
    setState(() {
      pumpStatus = command;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Báº£ng Äiá»u Khiá»ƒn IoT (Web)'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            Expanded(
              flex: 5,
              child: Column(
                children: [
                  Row(
                    children: [
                      // 1. KHU Vá»°C KET NOI
                      Expanded(
                        child: TextField(
                          controller: _ipController,
                          decoration: const InputDecoration(
                            labelText: 'IP Broker',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      if (!kIsWeb)
                        Expanded(
                          child: TextField(
                            controller: _portController,
                            decoration: const InputDecoration(
                              labelText: 'Port (WebSockets)',
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _espIdController,
                          decoration: const InputDecoration(
                            labelText: 'ESP ID',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      BtnConnect(
                        isConnect: isConnected,
                        callbackConnect: connectMQTT,
                        callbackDisconnect: disconnectMQTT,
                      ),
                      const SizedBox(width: 10),
                    ],
                  ),
                  const SizedBox(height: 10),
                  // 2. KHU Vá»°C HIá»‚N THá»Š Dá»® LIá»†U (CARDS)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      CardSensor(
                        title: 'Nhiá»‡t Ä‘á»™',
                        value: '$temperature Â°C',
                        icon: Icons.thermostat,
                        iconColor: Colors.orange,
                      ),
                      CardSensor(
                        title: 'Äá»™ áº©m',
                        value: '$humidity %',
                        icon: Icons.water_drop,
                        iconColor: Colors.blue,
                      ),
                      CardSensor(
                        title: 'BÆ¡m (Relay)',
                        value: pumpStatus,
                        icon: Icons.power,
                        iconColor: pumpStatus == 'ON'
                            ? Colors.green
                            : Colors.grey, //thuoc tinh color dua vao dieu kien
                      ),
                    ],
                  ),

                  const SizedBox(height: 10),

                  //4. Khu vuc do thi
                  Expanded(
                    child: SfCartesianChart(
                      primaryXAxis: DateTimeAxis(
                        title: AxisTitle(text: 'Thá»i gian'),
                        dateFormat: DateFormat('HH:mm:ss'),
                      ),
                      primaryYAxis: NumericAxis(
                        title: AxisTitle(text: 'GiÃ¡ trá»‹'),
                      ),
                      legend: Legend(
                        isVisible: true,
                        position: LegendPosition.bottom,
                      ),
                      tooltipBehavior: TooltipBehavior(enable: true),
                      series: <LineSeries<ChartData, DateTime>>[
                        LineSeries<ChartData, DateTime>(
                          name: 'Nhiá»‡t Ä‘á»™ (Â°C)',
                          dataSource: _chartData,
                          xValueMapper: (ChartData data, _) => data.timestamp,
                          yValueMapper: (ChartData data, _) => data.temperature,
                          color: Colors.red,
                          // Äáº·t báº±ng 0 sáº½ giÃºp nÃ³ váº½ láº¡i ngay láº­p tá»©c vÃ  mÆ°á»£t mÃ  hÆ¡n
                          animationDuration: 0,
                        ),
                        LineSeries<ChartData, DateTime>(
                          name: 'Äá»™ áº©m khÃ´ng khÃ­ (%)',
                          dataSource: _chartData,
                          xValueMapper: (ChartData data, _) => data.timestamp,
                          yValueMapper: (ChartData data, _) => data.humidity,
                          color: Colors.blue,
                          animationDuration: 0,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // 3. KHU Vá»°C ÄIá»€U KHIá»‚N
            Expanded(
              flex: 2,
              child: Column(
                children: [
                  RelayControl(
                    title: 'Äiá»u Khiá»ƒn Relay 1',
                    onTurnOn: () => sendCommand('ON'),
                    onTurnOff: () => sendCommand('OFF'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

```


## 2. `btn_connect.dart`


```dart

import 'package:flutter/material.dart';

class BtnConnect extends StatelessWidget {
  const BtnConnect({
    super.key,
    required this.isConnect,
    required this.callbackConnect,
    required this.callbackDisconnect,
  });
  final bool isConnect;
  final VoidCallback callbackDisconnect;
  final VoidCallback callbackConnect;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      onPressed: isConnect ? callbackDisconnect : callbackConnect,
      icon: Icon(isConnect ? Icons.link_off : Icons.link),
      label: Text(isConnect ? 'Ngáº¯t Káº¿t Ná»‘i' : 'Káº¿t Ná»‘i'),
      style: ElevatedButton.styleFrom(
        backgroundColor: isConnect
            ? Colors.red.shade100
            : Colors.green.shade100,
      ),
    );
  }
}


```


## 3. `card_sensor.dart`

```dart

import 'package:flutter/material.dart';

class CardSensor extends StatelessWidget {
  const CardSensor({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    required this.iconColor,
  });
  final String title;
  final String value;
  final IconData icon;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 4,
      child: Container(
        width: 150,
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(icon, size: 40, color: iconColor),
            const SizedBox(height: 8),
            Text(
              title,
              style: const TextStyle(fontSize: 16, color: Colors.grey),
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
    );
  }
}

```

## 4. `relay_control.dart`

```dart

import 'package:flutter/material.dart';

class RelayControl extends StatelessWidget {
  const RelayControl({
    super.key,
    required this.title,
    required this.onTurnOn,
    required this.onTurnOff,
  });

  final String title;
  final VoidCallback onTurnOn;
  final VoidCallback onTurnOff;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),

        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ElevatedButton.icon(
              onPressed: onTurnOn,
              icon: const Icon(Icons.flash_on, color: Colors.white),
              label: const Text('Báº­t', style: TextStyle(color: Colors.white)),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            ),

            const SizedBox(width: 20),

            ElevatedButton.icon(
              onPressed: onTurnOff,
              icon: const Icon(Icons.flash_off, color: Colors.white),
              label: const Text('Táº¯t', style: TextStyle(color: Colors.white)),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            ),
          ],
        ),
      ],
    );
  }
}

```