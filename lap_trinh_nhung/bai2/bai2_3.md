# Code flutter socket web


## 1. `home_screen.dart`

```dart

import 'package:flutter/material.dart';
import 'package:flutter_simple_treeview/flutter_simple_treeview.dart';
import 'package:scada_dashboard/iot_base/screens/pi_screen.dart';
import 'package:scada_dashboard/iot_base/screens/esp_screen.dart';

class NodeModel {
  final String id;
  final String type; // 'pi' hoáº·c 'client'
  final String? parentId;

  NodeModel({required this.id, required this.type, this.parentId});
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  NodeModel? _selectedNode;

  void _onTapNode(NodeModel node) {
    setState(() {
      _selectedNode = node;
    });
  }

  //===================== láº¥y nodes =====================//

  late List<TreeNode> nodes = [
    TreeNode(
      content: InkWell(
        child: Text('pi_1'),
        onTap: () {
          _onTapNode(NodeModel(id: 'pi_1', type: 'pi'));
        },
      ),
      children: [
        TreeNode(
          content: InkWell(
            child: Text('client_pi_1_1'),
            onTap: () {
              _onTapNode(
                NodeModel(
                  id: 'client_pi_1_1',
                  type: 'client',
                  parentId: 'pi_1',
                ),
              );
            },
          ),
        ),
        TreeNode(
          content: InkWell(
            child: Text('client_pi_1_2'),
            onTap: () {
              _onTapNode(
                NodeModel(
                  id: 'client_pi_1_2',
                  type: 'client',
                  parentId: 'pi_1',
                ),
              );
            },
          ),
        ),
      ],
    ),
  ];

  //====================================================//

  Widget _buildCenterContent() {
    final node = _selectedNode;

    if (node == null) {
      return const Text("ChÆ°a chá»n node");
    }
    switch (node.type) {
      case 'pi':
        return PiScreen(key: ValueKey(node.id), piId: node.id);

      case 'client':
        return EspScreen(
          key: ValueKey(node.id),
          clientId: node.id,
          piId: node.parentId!,
        );

      default:
        // Máº·c Ä‘á»‹nh khi má»›i má»Ÿ app, chÆ°a báº¥m gÃ¬
        return Container(
          color: Colors.red, // Tráº£ láº¡i mÃ u Ä‘á» gá»‘c cá»§a báº¡n
          alignment: Alignment.center,
          child: const Text('Center (HÃ£y chá»n Node bÃªn trÃ¡i)'),
        );
    }
  }

  //=====================================================//

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Center(child: Text('IOT BASE V1'))),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Container(color: Colors.green, child: Text('Header')),
            ),
            Expanded(
              flex: 10,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: Container(
                      color: Colors.grey,
                      child: TreeView(nodes: nodes),
                    ),
                  ),
                  Expanded(flex: 4, child: _buildCenterContent()),
                ],
              ),
            ),
            Expanded(
              child: Container(color: Colors.yellow, child: Text('Footer')),
            ),
          ],
        ),
      ),
    );
  }
}


```


## 2.  `pi_screen.dart`


```dart


import 'package:flutter/material.dart';

class PiScreen extends StatelessWidget {
  // Biáº¿n chá»©a ID truyá»n vÃ o tá»« menu bÃªn trÃ¡i
  final String piId;

  // Constructor báº¯t buá»™c pháº£i cÃ³ tham sá»‘ piId
  const PiScreen({super.key, required this.piId});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.blue.shade50,
      alignment: Alignment.center,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            'MÃ€N HÃŒNH ÄIá»€U KHIá»‚N: ${piId.toUpperCase()}',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.blue,
            ),
          ),
          const SizedBox(height: 20),
          // CÃ¡c widget khÃ¡c á»Ÿ Ä‘Ã¢y cÅ©ng sáº½ dÃ¹ng biáº¿n piId Ä‘á»ƒ load dá»¯ liá»‡u
          Text('Äang káº¿t ná»‘i Ä‘á»ƒ láº¥y thÃ´ng sá»‘ cá»§a $piId...'),
        ],
      ),
    );
  }
}


```


## 3.  `esp_screen.dart`


```dart


import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:syncfusion_flutter_charts/charts.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:scada_dashboard/iot_base/iot_base_constants.dart';
import 'package:scada_dashboard/iot_base/components/pump_status_card.dart';
import 'package:scada_dashboard/iot_base/components/sensor_card.dart';
import 'package:intl/intl.dart';
import 'package:http/http.dart' as http;

class ChartData {
  ChartData(
    this.timestamp,
    this.temperature,
    this.humidity,
    this.soilMoisture,
    this.plantAgeWeeks,
  );
  final DateTime timestamp;
  final double temperature;
  final double humidity;
  final double soilMoisture;
  final double plantAgeWeeks;
}

class EspScreen extends StatefulWidget {
  const EspScreen({super.key, required this.clientId, required this.piId});
  final String clientId;
  final String piId;

  @override
  State<EspScreen> createState() => _EspScreenState();
}

class _EspScreenState extends State<EspScreen> {
  WebSocketChannel? _channel;
  final List<ChartData> _chartData = [];
  Timer? _reconnectTimer;
  bool _isConnected = false;
  double _currentTemp = 0.0;
  double _currentHumi = 0.0;
  double _currentSoil = 0.0;
  double _currentAge = 0.0;
  String _currentTime = "--:--:--";
  String _pumpId = "N/A";
  bool _currentStatus = false;
  int _totalRuntimeS = 0;

  @override
  void initState() {
    super.initState();
    _connectWebSocket();
  }

  void _connectWebSocket() {
    // Biáº¿n Ä‘á»™ng láº¥y tÃªn client Ä‘á»ƒ chÃ¨n vÃ o URL
    final wsUrl = Uri.parse(
      '${IotBaseConstants.wsBaseUrl}/${widget.piId}/${widget.clientId}/',
    );
    _channel?.sink.close();
    _channel = null;
    try {
      _channel = WebSocketChannel.connect(wsUrl);
      _channel!.stream.listen(
        (message) {
          setState(() {
            _isConnected = true;
          });

          final Map<String, dynamic> data = jsonDecode(message);

          // 1. Láº¥y thá»i gian gá»‘c (UCT) tá»« gÃ³i tin
          final DateTime timeUct = DateTime.parse(data['timestamp']);
          final DateTime timeVn = timeUct.toLocal();
          // 2. Táº¡o thÃªm má»™t biáº¿n cá»™ng cá»©ng 7 tiáº¿ng (UCT+7)
          //final DateTime timeVn = timeUct.add(const Duration(hours: 7));

          // BÃ³c tÃ¡ch dá»¯ liá»‡u JSON dá»±a trÃªn key thá»±c táº¿ tá»« Server
          final double temp = (data['temperature'] as num).toDouble();
          final double humi = (data['humidity'] as num).toDouble();
          final double soil = (data['soil_moisture'] as num).toDouble();
          final double age = (data['plant_age_weeks'] as num).toDouble();

          final Map<String, dynamic>? pumpData = data['pumps'];

          String parsedPumpId = "N/A";
          bool parsedStatus = false;
          int parsedRuntime = 0;

          if (pumpData != null) {
            parsedPumpId = pumpData['pump_id']?.toString() ?? "N/A";
            parsedStatus = (pumpData['current_status'] == 1);
            parsedRuntime = (pumpData['total_runtime_s'] as num?)?.toInt() ?? 0;
          }

          setState(() {
            _currentTemp = temp;
            _currentHumi = humi;
            _currentSoil = soil;
            _currentAge = age;
            // Format thá»i gian cho Ä‘áº¹p (VD: 17:46:57)
            String strUct =
                "${timeUct.hour.toString().padLeft(2, '0')}:${timeUct.minute.toString().padLeft(2, '0')}:${timeUct.second.toString().padLeft(2, '0')} UCT";
            String strVn =
                "${timeVn.hour.toString().padLeft(2, '0')}:${timeVn.minute.toString().padLeft(2, '0')}:${timeVn.second.toString().padLeft(2, '0')} UCT+7";
            _currentTime = "$strUct  |  $strVn";

            _pumpId = parsedPumpId;
            _currentStatus = parsedStatus;
            _totalRuntimeS = parsedRuntime;

            _chartData.add(ChartData(timeVn, temp, humi, soil, age));
            _chartData.sort((a, b) => a.timestamp.compareTo(b.timestamp));
            //_chartData.sort((a, b) => a.timestamp.compareTo(b.timestamp));
            // Giá»›i háº¡n máº£ng chá»‰ giá»¯ 50 Ä‘iá»ƒm má»›i nháº¥t Ä‘á»ƒ Ä‘á»“ thá»‹ cháº¡y mÆ°á»£t
            if (_chartData.length > 50) {
              _chartData.removeAt(0);
            }
          });
        },
        onError: (error) {
          print("Lá»—i WebSocket: \$error");
          _handleReconnect();
        },
        onDone: () {
          print("WebSocket Ä‘Ã£ Ä‘Ã³ng");
          _handleReconnect();
        },
      );
    } catch (e) {
      _handleReconnect();
    }
  }

  void _handleReconnect() {
    setState(() {
      _isConnected = false;
    });

    _channel?.sink.close();
    _channel = null;

    // TrÃ¡nh viá»‡c táº¡o quÃ¡ nhiá»u timer cÃ¹ng lÃºc
    if (_reconnectTimer?.isActive ?? false) return;

    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      print("Äang thá»­ káº¿t ná»‘i láº¡i...");
      _connectWebSocket();
    });
  }

  @override
  void dispose() {
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    super.dispose();
  }

  //=============================================//
  Future<void> _togglePump() async {
    // XÃ¡c Ä‘á»‹nh lá»‡nh dá»±a trÃªn tráº¡ng thÃ¡i hiá»‡n táº¡i
    String command = _currentStatus ? "OFF" : "ON";
    try {
      final response = await http.post(
        Uri.parse(
          '${IotBaseConstants.apiBaseUrl}/v1/devices/control/',
        ), // URL API cá»§a báº¡n
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'node_id': widget.clientId,
          'pi_id': widget.piId,
          'pump_id': _pumpId,
          'device_type': 'pump',
          'command': command,
        }),
      );
      if (response.statusCode == 200) {
        print("ÄÃ£ gá»­i lá»‡nh $command thÃ nh cÃ´ng");
      }
    } catch (e) {
      print("Lá»—i khi gá»­i lá»‡nh: $e");
    }
  }

  //================================================//

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(8.0),
          child: Row(
            children: [
              Text(
                'GiÃ¡m sÃ¡t: ${widget.clientId}',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.blueGrey,
                ),
              ),
              const SizedBox(width: 10),
              Icon(
                _isConnected ? Icons.wifi : Icons.wifi_off,
                color: _isConnected ? Colors.greenAccent : Colors.red,
                size: 20,
              ),
              const Spacer(),
              Text(
                "Cáº­p nháº­t: $_currentTime",
                style: TextStyle(color: Colors.grey[600]),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // 2. KHU Vá»°C THáºº THÃ”NG Sá» HIá»†N Táº I (Wrap giÃºp tá»± Ä‘á»™ng xuá»‘ng dÃ²ng náº¿u mÃ n hÃ¬nh nhá»)
        Wrap(
          spacing: 15,
          runSpacing: 15,
          alignment: WrapAlignment.center,
          children: [
            SensorCard(
              title: "Nhiá»‡t Ä‘á»™",
              value: "$_currentTemp Â°C",
              icon: Icons.thermostat,
              color: Colors.red,
            ),
            SensorCard(
              title: "Äá»™ áº©m KK",
              value: "$_currentHumi %",
              icon: Icons.water_drop,
              color: Colors.blue,
            ),
            SensorCard(
              title: "Äá»™ áº©m Äáº¥t",
              value: "$_currentSoil %",
              icon: Icons.grass,
              color: Colors.brown,
            ),
            SensorCard(
              title: "Tuá»•i cÃ¢y",
              value: "$_currentAge tuáº§n",
              icon: Icons.eco,
              color: Colors.green,
            ),

            GestureDetector(
              onTap: _togglePump,
              child: PumpStatusCard(
                pumpId: _pumpId,
                isRunning: _currentStatus,
                totalRuntimeS: _totalRuntimeS,
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        Expanded(
          child: SfCartesianChart(
            primaryXAxis: DateTimeAxis(
              title: AxisTitle(text: 'Thá»i gian'),
              dateFormat: DateFormat('HH:mm:ss'),
            ),
            primaryYAxis: NumericAxis(title: AxisTitle(text: 'GiÃ¡ trá»‹')),
            legend: Legend(isVisible: true, position: LegendPosition.bottom),
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
              LineSeries<ChartData, DateTime>(
                name: 'Äá»™ áº©m Äáº¥t (%)',
                dataSource: _chartData,
                xValueMapper: (ChartData data, _) => data.timestamp,
                yValueMapper: (ChartData data, _) => data.soilMoisture,
                color: Colors.brown,
                animationDuration: 0,
              ),
              LineSeries<ChartData, DateTime>(
                name: 'Tuá»•i cÃ¢y (Tuáº§n)',
                dataSource: _chartData,
                xValueMapper: (ChartData data, _) => data.timestamp,
                yValueMapper: (ChartData data, _) => data.plantAgeWeeks,
                color: Colors.green,
                animationDuration: 0,
              ),
            ],
          ),
        ),
      ],
    );
  }
}


```


## 4.  `iot_base_constants.dart`

```dart

class IotBaseConstants {
  static const String serverIp = '54.66.51.43';
  static const String serverPort = '5600';

  static const String apiBaseUrl = 'http://$serverIp:$serverPort/api';
  static const String wsBaseUrl = 'ws://$serverIp:$serverPort/ws';
}


```

## 5. `pump_status_card.dart`


```dart

import 'package:flutter/material.dart';

class PumpStatusCard extends StatelessWidget {
  final String pumpId;
  final bool isRunning;
  final int totalRuntimeS;

  const PumpStatusCard({
    super.key,
    required this.pumpId,
    required this.isRunning,
    required this.totalRuntimeS,
  });

  // HÃ m dá»‹ch sá»‘ giÃ¢y thÃ nh Ä‘á»‹nh dáº¡ng (mm:ss) náº±m gá»n trong tháº»
  String _formatDuration(int totalSeconds) {
    if (totalSeconds <= 0) return "";
    int m = totalSeconds ~/ 60;
    int s = totalSeconds % 60;
    return "(${m.toString().padLeft(2, '0')}m ${s.toString().padLeft(2, '0')}s)";
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 130, // TÄƒng nháº¹ Ä‘á»™ rá»™ng Ä‘á»ƒ trÃ¡nh trÃ n chá»¯ khi Ä‘áº¿m giá»
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: isRunning ? Colors.blue[50] : Colors.grey[200],
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isRunning ? Colors.blue : Colors.grey,
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isRunning ? Icons.opacity : Icons.opacity_outlined,
            color: isRunning ? Colors.blue : Colors.grey,
            size: 30,
          ),
          const SizedBox(height: 8),
          Text(
            pumpId.toUpperCase(),
            style: TextStyle(
              color: Colors.grey[800],
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            isRunning ? "ÄANG CHáº Y" : "ÄANG Táº®T",
            style: TextStyle(
              color: isRunning ? Colors.blue[700] : Colors.grey[600],
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (isRunning)
            Text(
              _formatDuration(totalRuntimeS),
              style: TextStyle(
                color: Colors.blue[800],
                fontSize: 11,
                fontFamily: 'monospace', // Font chá»¯ mÃ¡y tÃ­nh cho Ä‘áº¹p
              ),
            ),
          const Text(
            "ðŸ‘‰ Cháº¡m Ä‘á»ƒ Ä/K",
            style: TextStyle(fontSize: 9, color: Colors.blueGrey),
          ),
        ],
      ),
    );
  }
}


```


## 6.  `sensor_card.dart`


```dart

import 'package:flutter/material.dart';

class SensorCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const SensorCard({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 125,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: .3)),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: .05),
            blurRadius: 6,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 8),
          Text(
            title,
            style: TextStyle(color: Colors.grey[600], fontSize: 12),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}





```



