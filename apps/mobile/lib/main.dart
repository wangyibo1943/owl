import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const TradeGuardApp());
}

class TradeGuardApp extends StatelessWidget {
  const TradeGuardApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF0F766E);

    return MaterialApp(
      title: 'TradeGuard',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: seed),
        scaffoldBackgroundColor: const Color(0xFFF5F7F4),
        useMaterial3: true,
        cardTheme: CardTheme(
          color: Colors.white,
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: BorderSide.none,
          ),
        ),
      ),
      home: const TradeGuardHomePage(),
    );
  }
}

class TradeGuardHomePage extends StatelessWidget {
  const TradeGuardHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('TradeGuard'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Credit'),
              Tab(text: 'Evidence'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            CreditCheckScreen(),
            EvidenceScreen(),
          ],
        ),
      ),
    );
  }
}

class CreditCheckScreen extends StatefulWidget {
  const CreditCheckScreen({super.key});

  @override
  State<CreditCheckScreen> createState() => _CreditCheckScreenState();
}

class _CreditCheckScreenState extends State<CreditCheckScreen> {
  final _companyController = TextEditingController(text: 'Apple Inc.');
  final _websiteController = TextEditingController(text: 'apple.com');
  String _selectedState = '';
  bool _isLoading = false;
  String? _error;
  CreditLookupResult? _result;

  @override
  void dispose() {
    _companyController.dispose();
    _websiteController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await TradeGuardApi.instance.lookupCredit(
        companyName: _companyController.text.trim(),
        website: _websiteController.text.trim().isEmpty
            ? null
            : _websiteController.text.trim(),
        companyState: _selectedState.isEmpty ? null : _selectedState,
      );

      setState(() {
        _result = result;
      });
    } catch (error) {
      setState(() {
        _error = '$error';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const _HeroCard(
          title: 'US Buyer Risk Check',
          body:
              'Run a live company lookup against TradeGuard backend, score the entity, and surface registry confidence before you ship.',
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Lookup Input',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _companyController,
                  decoration: const InputDecoration(
                    labelText: 'Company name',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _websiteController,
                  decoration: const InputDecoration(
                    labelText: 'Website',
                    hintText: 'example.com',
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _selectedState,
                  decoration: const InputDecoration(
                    labelText: 'State registry hint',
                  ),
                  items: const [
                    DropdownMenuItem<String>(
                      value: '',
                      child: Text('Auto'),
                    ),
                    DropdownMenuItem<String>(
                      value: 'CA',
                      child: Text('California'),
                    ),
                  ],
                  onChanged: (value) {
                    setState(() {
                      _selectedState = value ?? '';
                    });
                  },
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _isLoading ? null : _submit,
                  icon: _isLoading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.search),
                  label: Text(_isLoading ? 'Checking...' : 'Run Credit Check'),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
              ],
            ),
          ),
        ),
        if (_result != null) ...[
          const SizedBox(height: 16),
          _CreditResultCard(result: _result!),
        ],
      ],
    );
  }
}

class EvidenceScreen extends StatefulWidget {
  const EvidenceScreen({super.key});

  @override
  State<EvidenceScreen> createState() => _EvidenceScreenState();
}

class _EvidenceScreenState extends State<EvidenceScreen> {
  final _companyController = TextEditingController(text: 'Apple Inc.');
  final _dealReferenceController =
      TextEditingController(text: 'TG-MOBILE-001');
  final _filenameController = TextEditingController(text: 'evidence.txt');
  final _contentController = TextEditingController(
    text: 'Buyer acknowledged invoice and delivery timeline in writing.',
  );

  bool _isSubmitting = false;
  bool _isRefreshing = false;
  String? _error;
  EvidenceSubmissionResult? _submission;
  CertificateStatusResult? _certificate;

  @override
  void dispose() {
    _companyController.dispose();
    _dealReferenceController.dispose();
    _filenameController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _submitEvidence() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      final submission = await TradeGuardApi.instance.uploadEvidence(
        companyName: _companyController.text.trim(),
        dealReference: _dealReferenceController.text.trim().isEmpty
            ? null
            : _dealReferenceController.text.trim(),
        filename: _filenameController.text.trim().isEmpty
            ? 'evidence.txt'
            : _filenameController.text.trim(),
        textContent: _contentController.text,
      );

      final certificate =
          await TradeGuardApi.instance.getCertificate(submission.evidenceId);

      setState(() {
        _submission = submission;
        _certificate = certificate;
      });
    } catch (error) {
      setState(() {
        _error = '$error';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Future<void> _refreshCertificate() async {
    final evidenceId = _submission?.evidenceId;
    if (evidenceId == null) return;

    setState(() {
      _isRefreshing = true;
      _error = null;
    });

    try {
      await TradeGuardApi.instance.syncAdobe(evidenceId);
      final certificate = await TradeGuardApi.instance.getCertificate(evidenceId);

      setState(() {
        _certificate = certificate;
      });
    } catch (error) {
      setState(() {
        _error = '$error';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isRefreshing = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const _HeroCard(
          title: 'Evidence Preservation',
          body:
              'Submit text evidence into the live notarization pipeline. Adobe Sign agreements and certificate URLs are returned from the backend.',
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Evidence Submission',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _companyController,
                  decoration: const InputDecoration(labelText: 'Company name'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _dealReferenceController,
                  decoration: const InputDecoration(labelText: 'Deal reference'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _filenameController,
                  decoration: const InputDecoration(labelText: 'Filename'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _contentController,
                  minLines: 6,
                  maxLines: 10,
                  decoration: const InputDecoration(
                    labelText: 'Evidence content',
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _isSubmitting ? null : _submitEvidence,
                  icon: _isSubmitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.verified),
                  label: Text(
                    _isSubmitting ? 'Submitting...' : 'Submit for Preservation',
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
              ],
            ),
          ),
        ),
        if (_submission != null) ...[
          const SizedBox(height: 16),
          _EvidenceResultCard(
            submission: _submission!,
            certificate: _certificate,
            isRefreshing: _isRefreshing,
            onRefresh: _refreshCertificate,
          ),
        ],
      ],
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [Color(0xFF072A2B), Color(0xFF14532D), Color(0xFF0F766E)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            body,
            style: const TextStyle(
              color: Color(0xFFD6F3EB),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _CreditResultCard extends StatelessWidget {
  const _CreditResultCard({required this.result});

  final CreditLookupResult result;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    result.companyName,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                _GradeBadge(grade: result.creditGrade),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _MetricChip(label: 'Score', value: '${result.riskScore}'),
                _MetricChip(
                  label: 'Confidence',
                  value: result.matchConfidence,
                ),
                _MetricChip(label: 'Source', value: result.sourceName),
                if (result.ticker != null)
                  _MetricChip(label: 'Ticker', value: result.ticker!),
              ],
            ),
            const SizedBox(height: 16),
            _DetailRow(label: 'Status', value: result.status),
            _DetailRow(label: 'Jurisdiction', value: result.jurisdiction ?? 'N/A'),
            _DetailRow(
              label: 'Registration',
              value: result.registrationNumber ?? 'N/A',
            ),
            _DetailRow(
              label: 'Entity Type',
              value: result.entityType ?? 'N/A',
            ),
            _DetailRow(
              label: 'Latest Filing',
              value: result.lastFilingDate ?? 'N/A',
            ),
            _DetailRow(
              label: 'Industry',
              value: result.sicDescription ?? 'N/A',
            ),
            const SizedBox(height: 16),
            Text(
              result.summary,
              style: const TextStyle(height: 1.45),
            ),
            if (result.riskFlags.isNotEmpty) ...[
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: result.riskFlags
                    .map(
                      (flag) => Chip(
                        label: Text(flag),
                        backgroundColor: const Color(0xFFE8F3F0),
                      ),
                    )
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EvidenceResultCard extends StatelessWidget {
  const _EvidenceResultCard({
    required this.submission,
    required this.certificate,
    required this.isRefreshing,
    required this.onRefresh,
  });

  final EvidenceSubmissionResult submission;
  final CertificateStatusResult? certificate;
  final bool isRefreshing;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Evidence Status',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            _DetailRow(label: 'Evidence ID', value: submission.evidenceId),
            _DetailRow(label: 'Hash', value: submission.fileHash),
            _DetailRow(label: 'Upload Status', value: submission.status),
            if (certificate != null) ...[
              _DetailRow(
                label: 'Certificate Status',
                value: certificate!.status,
              ),
              _DetailRow(
                label: 'Certificate ID',
                value: certificate!.certificateId ?? 'Pending',
              ),
              _DetailRow(
                label: 'Certificate URL',
                value: certificate!.certificateUrl ?? 'Pending',
              ),
            ],
            const SizedBox(height: 16),
            FilledButton.tonalIcon(
              onPressed: isRefreshing ? null : onRefresh,
              icon: isRefreshing
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh),
              label: Text(isRefreshing ? 'Refreshing...' : 'Refresh Certificate'),
            ),
          ],
        ),
      ),
    );
  }
}

class _GradeBadge extends StatelessWidget {
  const _GradeBadge({required this.grade});

  final String grade;

  @override
  Widget build(BuildContext context) {
    final color = switch (grade) {
      'A' => const Color(0xFF14532D),
      'B' => const Color(0xFF0F766E),
      'C' => const Color(0xFFB45309),
      _ => const Color(0xFF991B1B),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        grade,
        style: TextStyle(
          color: color,
          fontSize: 18,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F3F0),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: Color(0xFF4B5563)),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 128,
            child: Text(
              label,
              style: const TextStyle(color: Color(0xFF6B7280)),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class TradeGuardApi {
  TradeGuardApi._();

  static final instance = TradeGuardApi._();
  static const _baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://wehom.net/v1',
  );

  Future<CreditLookupResult> lookupCredit({
    required String companyName,
    String? website,
    String? companyState,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/credit/lookup'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'company_name': companyName,
        if (website != null && website.isNotEmpty) 'website': website,
        if (companyState != null && companyState.isNotEmpty)
          'company_state': companyState,
      }),
    );

    final json = _decode(response.body);
    if (response.statusCode >= 400) {
      throw Exception(_extractMessage(json));
    }

    return CreditLookupResult.fromJson(
      Map<String, dynamic>.from(json['data'] as Map),
    );
  }

  Future<EvidenceSubmissionResult> uploadEvidence({
    required String companyName,
    required String filename,
    required String textContent,
    String? dealReference,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/evidence/upload'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'company_name': companyName,
        'deal_reference': dealReference,
        'filename': filename,
        'mime_type': 'text/plain',
        'file_content_base64': base64Encode(utf8.encode(textContent)),
      }),
    );

    final json = _decode(response.body);
    if (response.statusCode >= 400) {
      throw Exception(_extractMessage(json));
    }

    return EvidenceSubmissionResult.fromJson(
      Map<String, dynamic>.from(json['data'] as Map),
    );
  }

  Future<CertificateStatusResult> getCertificate(String evidenceId) async {
    final response = await http.get(
      Uri.parse('$_baseUrl/evidence/$evidenceId/certificate'),
    );
    final json = _decode(response.body);
    if (response.statusCode >= 400) {
      throw Exception(_extractMessage(json));
    }

    return CertificateStatusResult.fromJson(
      Map<String, dynamic>.from(json['data'] as Map),
    );
  }

  Future<CertificateStatusResult> syncAdobe(String evidenceId) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/evidence/$evidenceId/providers/adobe-sign/sync'),
    );
    final json = _decode(response.body);
    if (response.statusCode >= 400) {
      throw Exception(_extractMessage(json));
    }

    return CertificateStatusResult.fromJson(
      Map<String, dynamic>.from(json['data'] as Map),
    );
  }

  Map<String, dynamic> _decode(String body) {
    if (body.isEmpty) {
      return <String, dynamic>{};
    }

    return Map<String, dynamic>.from(jsonDecode(body) as Map);
  }

  String _extractMessage(Map<String, dynamic> payload) {
    final message = payload['message'];
    if (message is String && message.isNotEmpty) {
      return message;
    }

    return 'Request failed';
  }
}

class CreditLookupResult {
  CreditLookupResult({
    required this.companyName,
    required this.creditGrade,
    required this.riskScore,
    required this.riskFlags,
    required this.matchConfidence,
    required this.sourceName,
    required this.status,
    required this.summary,
    this.ticker,
    this.entityType,
    this.jurisdiction,
    this.registrationNumber,
    this.lastFilingDate,
    this.sicDescription,
  });

  final String companyName;
  final String? ticker;
  final String? entityType;
  final String? jurisdiction;
  final String? registrationNumber;
  final String creditGrade;
  final int riskScore;
  final List<String> riskFlags;
  final String matchConfidence;
  final String sourceName;
  final String status;
  final String summary;
  final String? lastFilingDate;
  final String? sicDescription;

  factory CreditLookupResult.fromJson(Map<String, dynamic> json) {
    return CreditLookupResult(
      companyName: json['company_name'] as String? ?? 'Unknown',
      ticker: json['ticker'] as String?,
      entityType: json['entity_type'] as String?,
      jurisdiction: json['jurisdiction'] as String?,
      registrationNumber: json['registration_number'] as String?,
      creditGrade: json['credit_grade'] as String? ?? 'N/A',
      riskScore: (json['risk_score'] as num?)?.toInt() ?? 0,
      riskFlags: (json['risk_flags'] as List<dynamic>? ?? const [])
          .map((item) => '$item')
          .toList(),
      matchConfidence: json['match_confidence'] as String? ?? 'UNKNOWN',
      sourceName: json['source_name'] as String? ?? 'Unknown',
      status: json['status'] as String? ?? 'Unknown',
      summary: json['summary'] as String? ?? '',
      lastFilingDate: json['last_filing_date'] as String?,
      sicDescription: json['sic_description'] as String?,
    );
  }
}

class EvidenceSubmissionResult {
  EvidenceSubmissionResult({
    required this.evidenceId,
    required this.fileHash,
    required this.status,
  });

  final String evidenceId;
  final String fileHash;
  final String status;

  factory EvidenceSubmissionResult.fromJson(Map<String, dynamic> json) {
    return EvidenceSubmissionResult(
      evidenceId: json['evidence_id'] as String? ?? '',
      fileHash: json['file_hash'] as String? ?? '',
      status: json['status'] as String? ?? '',
    );
  }
}

class CertificateStatusResult {
  CertificateStatusResult({
    required this.evidenceId,
    required this.status,
    this.certificateId,
    this.certificateUrl,
  });

  final String evidenceId;
  final String status;
  final String? certificateId;
  final String? certificateUrl;

  factory CertificateStatusResult.fromJson(Map<String, dynamic> json) {
    return CertificateStatusResult(
      evidenceId: json['evidence_id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      certificateId: json['certificate_id'] as String?,
      certificateUrl: json['certificate_url'] as String?,
    );
  }
}
