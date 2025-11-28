import 'dart:async';
import 'dart:io';
import 'package:csv/csv.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';

void main() {
  runApp(ChemVisualizerApp());
}

class ChemVisualizerApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Chemical Visualizer (Mobile)',
      theme: ThemeData.dark().copyWith(
        primaryColor: Colors.deepPurple,
        scaffoldBackgroundColor: Color(0xFF121217),
      ),
      home: VisualizerHome(),
    );
  }
}

class VisualizerHome extends StatefulWidget {
  @override
  _VisualizerHomeState createState() => _VisualizerHomeState();
}

class _VisualizerHomeState extends State<VisualizerHome> {
  List<Map<String, String>> rows = [];
  List<String> columns = [];
  String status = "No data loaded";
  String? csvFilePath;

  // sample desktop image you uploaded (use file:// prefix when loading as image)
  // On an emulator/phone this path likely won't exist, replace as needed.
  final String sampleImagePath = "/mnt/data/2aa20a9f-c54e-46ae-b81c-2c19379963c8.png";

  // Parsed numeric columns
  Map<String, List<double>> numericCols = {};

  // look up a time column name if present
  String? timeColumn;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Chemical Equipment Visualizer'),
        actions: [
          IconButton(
            icon: Icon(Icons.folder_open),
            tooltip: 'Open CSV',
            onPressed: _pickCsv,
          ),
          IconButton(
            icon: Icon(Icons.refresh),
            tooltip: 'Reload (clear)',
            onPressed: _clearData,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            _topSummary(),
            Divider(height: 1, color: Colors.white10),
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.all(12),
                child: Column(
                  children: [
                    _imagePreviewCard(),
                    SizedBox(height: 12),
                    _controlsRow(),
                    SizedBox(height: 12),
                    _chartsSection(),
                    SizedBox(height: 12),
                    _tablePreview(),
                    SizedBox(height: 12),
                    _statusTile(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _topSummary() {
    final avgFlow = _meanOfColumnByLike(['Flowrate', 'flowrate', 'flow_rate', 'flow']);
    final avgPressure = _meanOfColumnByLike(['Pressure', 'pressure']);
    final avgTemp = _meanOfColumnByLike(['Temperature', 'temperature', 'Temp']);
    final rowsCount = rows.length;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      child: Row(
        children: [
          _cardStat("Avg Flowrate", avgFlow != null ? avgFlow.toStringAsFixed(2) : "-"),
          SizedBox(width: 8),
          _cardStat("Avg Pressure", avgPressure != null ? avgPressure.toStringAsFixed(2) : "-"),
          SizedBox(width: 8),
          _cardStat("Avg Temp", avgTemp != null ? avgTemp.toStringAsFixed(2) : "-"),
          SizedBox(width: 8),
          _cardStat("Rows", "$rowsCount"),
        ],
      ),
    );
  }

  Widget _cardStat(String title, String value) {
    return Expanded(
      child: Container(
        padding: EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: Color(0xFF1C1C26),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.white10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: TextStyle(color: Colors.white70, fontSize: 12)),
            SizedBox(height: 6),
            Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _imagePreviewCard() {
    final exists = File(sampleImagePath).existsSync();
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Color(0xFF16161A),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white10),
      ),
      padding: EdgeInsets.all(12),
      child: Row(
        children: [
          Expanded(
            child: Text(
              "Sample asset preview (desktop upload). Path:\n$sampleImagePath",
              style: TextStyle(color: Colors.white70),
            ),
          ),
          Container(
            width: 120,
            height: 80,
            child: exists
                ? Image.file(File(sampleImagePath), fit: BoxFit.contain)
                : Center(child: Text("No file\nfound", textAlign: TextAlign.center)),
          )
        ],
      ),
    );
  }

  Widget _controlsRow() {
    return Row(
      children: [
        ElevatedButton.icon(
          icon: Icon(Icons.file_upload),
          label: Text("Pick CSV"),
          onPressed: _pickCsv,
        ),
        SizedBox(width: 8),
        ElevatedButton.icon(
          icon: Icon(Icons.play_arrow),
          label: Text("Use Sample CSV"),
          onPressed: _loadSampleCsv,
        ),
        SizedBox(width: 8),
        ElevatedButton.icon(
          icon: Icon(Icons.analytics),
          label: Text("Analyze"),
          onPressed: () {
            setState(() {}); // refresh charts
          },
        ),
      ],
    );
  }

  Widget _chartsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _sectionTitle("Type Distribution (Bar)"),
        SizedBox(height: 8),
        Container(height: 180, child: _barChartWidget()),
        SizedBox(height: 12),
        _sectionTitle("Flow over Time (Line)"),
        SizedBox(height: 8),
        Container(height: 200, child: _lineChartWidget()),
        SizedBox(height: 12),
        _sectionTitle("Top Numeric (Pie)"),
        SizedBox(height: 8),
        Container(height: 160, child: _pieChartWidget()),
      ],
    );
  }

  Widget _sectionTitle(String t) => Align(
        alignment: Alignment.centerLeft,
        child: Text(t, style: TextStyle(fontWeight: FontWeight.bold)),
      );

  Widget _barChartWidget() {
    final typeCounts = <String, int>{};
    if (columns.isNotEmpty) {
      // try to find type-like column
      String? typeCol;
      for (var c in columns) {
        if (c.toLowerCase() == 'type' || c.toLowerCase().contains('type')) {
          typeCol = c;
          break;
        }
      }
      if (typeCol != null) {
        for (var r in rows) {
          final v = r[typeCol] ?? "Unknown";
          typeCounts[v] = (typeCounts[v] ?? 0) + 1;
        }
      }
    }
    if (typeCounts.isEmpty) {
      return Center(child: Text("No 'Type' column found or no data"));
    }
    final labels = typeCounts.keys.toList();
    final values = typeCounts.values.toList();
    final maxv = values.reduce((a, b) => a > b ? a : b).toDouble();

    return Padding(
      padding: EdgeInsets.all(8),
      child: BarChart(
        BarChartData(
          alignment: BarChartAlignment.spaceAround,
          maxY: maxv + 1,
          titlesData: FlTitlesData(show: true, bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, getTitlesWidget: (v, meta) {
            final idx = v.toInt();
            if (idx < 0 || idx >= labels.length) return SizedBox.shrink();
            return SideTitleWidget(child: Text(labels[idx], style: TextStyle(fontSize: 10)), axisSide: meta.axisSide);
          }))),
          barGroups: List.generate(labels.length, (i) {
            return BarChartGroupData(x: i, barRods: [BarChartRodData(toY: values[i].toDouble(), width: 18)]);
          }),
        ),
      ),
    );
  }

  Widget _lineChartWidget() {
    // find flow column and time column
    String? flowCol;
    timeColumn = null;
    for (var c in columns) {
      if (c.toLowerCase().contains('flow')) {
        flowCol = c;
        break;
      }
    }
    for (var c in columns) {
      if (['timestamp', 'time', 'date', 'datetime'].contains(c.toLowerCase())) {
        timeColumn = c;
        break;
      }
    }
    if (flowCol == null || timeColumn == null) {
      return Center(child: Text("Need both time and flow columns to plot line chart"));
    }

    // build sorted pairs
    final pairs = <MapEntry<DateTime, double>>[];
    for (var r in rows) {
      final tstr = r[timeColumn] ?? "";
      final fstr = r[flowCol] ?? "";
      DateTime? dt;
      try {
        dt = DateTime.parse(tstr);
      } catch (e) {
        try {
          dt = DateFormat.yMd().parseLoose(tstr);
        } catch (e2) {
          dt = null;
        }
      }
      final fv = double.tryParse(fstr.replaceAll(',', '')) ?? double.nan;
      if (dt != null && !fv.isNaN) {
        pairs.add(MapEntry(dt, fv));
      }
    }
    if (pairs.isEmpty) return Center(child: Text("No valid time/flow pairs"));

    pairs.sort((a, b) => a.key.compareTo(b.key));
    // downsample if too many
    final maxPoints = 200;
    final step = pairs.length > maxPoints ? (pairs.length ~/ maxPoints) : 1;
    final filtered = [for (var i = 0; i < pairs.length; i += step) pairs[i]];

    final spots = List.generate(filtered.length, (i) => FlSpot(i.toDouble(), filtered[i].value));
    final labels = filtered.map((e) => DateFormat('MM-dd HH:mm').format(e.key)).toList();

    return Padding(
      padding: EdgeInsets.all(8),
      child: LineChart(
        LineChartData(
          titlesData: FlTitlesData(show: true, bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, getTitlesWidget: (v, meta) {
            final idx = v.toInt();
            if (idx < 0 || idx >= labels.length) return SizedBox.shrink();
            return SideTitleWidget(axisSide: meta.axisSide, child: Text(labels[idx], style: TextStyle(fontSize: 9)));
          }, interval: 1))),
          minY: 0,
          lineBarsData: [LineChartBarData(spots: spots, dotData: FlDotData(show: false))],
        ),
      ),
    );
  }

  Widget _pieChartWidget() {
    // choose top numeric columns means
    final means = <String, double>{};
    for (var c in columns) {
      final arr = rows.map((r) {
        final s = r[c] ?? "";
        return double.tryParse(s.replaceAll(',', ''));
      }).where((v) => v != null).cast<double>().toList();
      if (arr.length >= 1) {
        final m = arr.reduce((a, b) => a + b) / arr.length;
        means[c] = m;
      }
    }
    if (means.isEmpty) return Center(child: Text("No numeric columns found"));
    // pick top 5 by abs mean
    final entries = means.entries.toList()
      ..sort((a, b) => b.value.abs().compareTo(a.value.abs()));
    final top = entries.take(5).toList();
    final total = top.fold<double>(0, (p, e) => p + e.value.abs());

    return Padding(
      padding: EdgeInsets.all(8),
      child: PieChart(
        PieChartData(
          sections: List.generate(top.length, (i) {
            final e = top[i];
            final value = e.value.abs();
            final perc = total == 0 ? 0.0 : (value / total) * 100;
            final color = Colors.primaries[i % Colors.primaries.length];
            return PieChartSectionData(value: value, title: "${e.key}\n${perc.toStringAsFixed(1)}%", color: color, radius: 50, titleStyle: TextStyle(fontSize: 10));
          }),
        ),
      ),
    );
  }

  Widget _tablePreview() {
    if (columns.isEmpty || rows.isEmpty) {
      return Container(
        padding: EdgeInsets.all(12),
        decoration: BoxDecoration(color: Color(0xFF141418), borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white10)),
        child: Text("No table data. Pick a CSV or use sample."),
      );
    }

    // limit rows shown
    final showRows = rows.take(20).toList();
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(color: Color(0xFF141418), borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white10)),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columns: columns.map((c) => DataColumn(label: Text(c, style: TextStyle(fontSize: 12)))).toList(),
          rows: showRows.map((r) {
            return DataRow(cells: columns.map((c) => DataCell(Text(r[c] ?? "", style: TextStyle(fontSize: 12)))).toList());
          }).toList(),
        ),
      ),
    );
  }

  Widget _statusTile() {
    return Row(
      children: [
        Expanded(child: Text(status, style: TextStyle(color: Colors.white70))),
      ],
    );
  }

  Future<void> _pickCsv() async {
    try {
      final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['csv']);
      if (result == null) return;
      final path = result.files.single.path;
      if (path == null) return;
      csvFilePath = path;
      final content = await File(path).readAsString();
      await _parseCsvText(content);
      setState(() {
        status = "Loaded CSV: ${path.split('/').last}";
      });
    } catch (e) {
      setState(() {
        status = "Error picking/reading CSV: $e";
      });
    }
  }

  Future<void> _loadSampleCsv() async {
    // minimal sample matching your desktop example
    final sample = "Equipment Name,Type,Flowrate,Pressure,Temperature,Timestamp\n"
        "Pump-1,Pump,120,5.2,110,2025-11-20 08:00:00\n"
        "Compressor-1,Compressor,95,8.4,95,2025-11-20 09:00:00\n"
        "Valve-1,Valve,60,4.1,35,2025-11-20 10:00:00\n"
        "Pump-2,Pump,130,5.8,115,2025-11-20 11:00:00\n";
    await _parseCsvText(sample);
    setState(() {
      status = "Loaded sample CSV";
    });
  }

  Future<void> _parseCsvText(String text) async {
    // sanitize common double-encoded newline escapes
    String normalized = text;
    if (normalized.contains(r"\n") || normalized.contains(r"\r\n")) {
      normalized = normalized.replaceAll(r"\r\n", "\r\n").replaceAll(r"\n", "\n");
    }
    if (normalized.startsWith('"') && normalized.endsWith('"')) {
      normalized = normalized.substring(1, normalized.length - 1);
    }

    final converter = CsvToListConverter(eol: '\n', shouldParseNumbers: false);
    List<List<dynamic>> lines;
    try {
      lines = converter.convert(normalized);
    } catch (e) {
      // fallback: split lines manually
      final rawLines = normalized.split('\n').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
      lines = rawLines.map((l) => l.split(',')).toList();
    }
    if (lines.isEmpty) {
      setState(() {
        columns = [];
        rows = [];
      });
      return;
    }
    // header row
    final header = lines.first.map((e) => e.toString()).toList();
    final body = lines.skip(1).where((r) => r.isNotEmpty).toList();
    final parsedRows = <Map<String, String>>[];
    for (var r in body) {
      // ensure r has same length as header
      final rr = List<String>.from(r.map((e) => e.toString()));
      while (rr.length < header.length) rr.add('');
      final map = <String, String>{};
      for (var i = 0; i < header.length; i++) {
        map[header[i]] = rr[i];
      }
      parsedRows.add(map);
    }

    // update numeric columns cache
    final numeric = <String, List<double>>{};
    for (var c in header) {
      final arr = parsedRows.map((m) {
        final s = m[c] ?? "";
        final dd = double.tryParse(s.replaceAll(',', ''));
        return dd;
      }).where((v) => v != null).cast<double>().toList();
      if (arr.length > 0) numeric[c] = arr;
    }

    setState(() {
      columns = header;
      rows = parsedRows;
      numericCols = numeric;
      // set timeColumn if present
      timeColumn = header.firstWhere((h) => ['timestamp', 'time', 'date', 'datetime'].contains(h.toLowerCase()), orElse: () => "");
      if (timeColumn!.isEmpty) timeColumn = null;
    });
  }

  double? _meanOfColumnByLike(List<String> candidates) {
    for (var c in columns) {
      final low = c.toLowerCase();
      for (var cand in candidates) {
        if (low == cand.toLowerCase() || low.contains(cand.toLowerCase())) {
          final arr = numericCols[c] ?? rows.map((r) => double.tryParse((r[c] ?? "").replaceAll(',', ''))).where((v) => v != null).cast<double>().toList();
          if (arr.isNotEmpty) {
            final mean = arr.reduce((a, b) => a + b) / arr.length;
            return mean;
          }
        }
      }
    }
    return null;
  }

  void _clearData() {
    setState(() {
      rows = [];
      columns = [];
      numericCols = {};
      status = "Cleared";
      csvFilePath = null;
    });
  }
}
