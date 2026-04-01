import 'dart:convert';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

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
        cardTheme: CardThemeData(
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
                  initialValue: _selectedState,
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
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
              ],
            ),
          ),
        ),
        if (!_isLoading && _result == null && _error == null) ...[
          const SizedBox(height: 16),
          const _EmptyStateCard(
            title: 'Ready to verify a buyer',
            body:
                'Enter a US company name and optional website to get a live risk grade, registry match confidence, and evidence-backed explanation.',
            icon: Icons.domain_verification_outlined,
          ),
        ],
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
  final _dealReferenceController = TextEditingController(text: 'TG-MOBILE-001');
  final _contentController = TextEditingController(
    text: 'Buyer acknowledged invoice and delivery timeline in writing.',
  );

  bool _isSubmitting = false;
  bool _isRefreshing = false;
  String? _error;
  LocalEvidenceFile? _selectedFile;
  EvidenceSubmissionResult? _submission;
  CertificateStatusResult? _certificate;

  @override
  void dispose() {
    _companyController.dispose();
    _dealReferenceController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    setState(() {
      _error = null;
    });

    final result = await FilePicker.platform.pickFiles(
      allowMultiple: false,
      withData: true,
      type: FileType.any,
    );

    if (result == null || result.files.isEmpty) {
      return;
    }

    final picked = result.files.first;
    if (picked.bytes == null) {
      setState(() {
        _error = 'File bytes could not be loaded on this device.';
      });
      return;
    }

    setState(() {
      _selectedFile = LocalEvidenceFile(
        filename: picked.name,
        bytes: picked.bytes!,
        mimeType: _mimeTypeFromFilename(picked.name),
      );
    });
  }

  Future<void> _submitEvidence() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      final selectedFile = _selectedFile;
      final fallbackText = _contentController.text.trim();

      if (selectedFile == null && fallbackText.isEmpty) {
        throw Exception('Choose a file or enter evidence text first.');
      }

      final submission = await TradeGuardApi.instance.uploadEvidence(
        companyName: _companyController.text.trim(),
        dealReference: _dealReferenceController.text.trim().isEmpty
            ? null
            : _dealReferenceController.text.trim(),
        filename: selectedFile?.filename ?? 'evidence-note.txt',
        mimeType: selectedFile?.mimeType ?? 'text/plain',
        fileBytes: selectedFile?.bytes ??
            Uint8List.fromList(utf8.encode(fallbackText)),
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
      final certificate =
          await TradeGuardApi.instance.getCertificate(evidenceId);

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

  Future<void> _openCertificate() async {
    final certificateUrl = _certificate?.certificateUrl;
    if (certificateUrl == null || certificateUrl.isEmpty) return;

    final launched = await launchUrl(
      Uri.parse(certificateUrl),
      mode: LaunchMode.externalApplication,
    );

    if (!launched && mounted) {
      setState(() {
        _error = 'Certificate URL could not be opened.';
      });
    }
  }

  Future<void> _openEvidenceFile() async {
    final evidenceId = _submission?.evidenceId;
    if (evidenceId == null) return;

    final launched = await launchUrl(
      Uri.parse(TradeGuardApi.instance.evidenceFileUrl(evidenceId)),
      mode: LaunchMode.externalApplication,
    );

    if (!launched && mounted) {
      setState(() {
        _error = 'Evidence file URL could not be opened.';
      });
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
                  decoration:
                      const InputDecoration(labelText: 'Deal reference'),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _pickFile,
                  icon: const Icon(Icons.attach_file),
                  label: Text(
                    _selectedFile == null
                        ? 'Choose evidence file'
                        : _selectedFile!.filename,
                  ),
                ),
                if (_selectedFile != null) ...[
                  const SizedBox(height: 8),
                  _SelectedFileCard(file: _selectedFile!),
                ],
                const SizedBox(height: 12),
                TextField(
                  controller: _contentController,
                  minLines: 6,
                  maxLines: 10,
                  decoration: const InputDecoration(
                    labelText: 'Evidence note (optional fallback)',
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
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
              ],
            ),
          ),
        ),
        if (!_isSubmitting && _submission == null && _error == null) ...[
          const SizedBox(height: 16),
          const _EmptyStateCard(
            title: 'Preserve contract evidence',
            body:
                'Upload a PDF, screenshot, or chat export to push it into the live notarization flow and keep a downloadable certificate trail.',
            icon: Icons.verified_user_outlined,
          ),
        ],
        if (_submission != null) ...[
          const SizedBox(height: 16),
          _EvidenceResultCard(
            submission: _submission!,
            certificate: _certificate,
            isRefreshing: _isRefreshing,
            onRefresh: _refreshCertificate,
            onOpenCertificate: _openCertificate,
            onOpenEvidence: _openEvidenceFile,
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
                _MetricChip(label: 'Website', value: result.websiteMatchLabel),
                if (result.ticker != null)
                  _MetricChip(label: 'Ticker', value: result.ticker!),
              ],
            ),
            const SizedBox(height: 16),
            _StatusBanner(
              tone: result.riskTone,
              title: result.riskToneTitle,
              body: result.summary,
            ),
            const SizedBox(height: 16),
            _DetailRow(label: 'Status', value: result.status),
            _DetailRow(
              label: 'Jurisdiction',
              value: result.jurisdiction ?? 'N/A',
            ),
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
            _DetailRow(
              label: 'Website Match',
              value: result.websiteMatchLabel,
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
    required this.onOpenCertificate,
    required this.onOpenEvidence,
  });

  final EvidenceSubmissionResult submission;
  final CertificateStatusResult? certificate;
  final bool isRefreshing;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onOpenCertificate;
  final Future<void> Function() onOpenEvidence;

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
            const SizedBox(height: 8),
            _StatusBanner(
              tone: certificate?.statusTone ??
                  _statusToneForValue(submission.status),
              title: certificate?.statusTitle ?? 'Evidence received',
              body: certificate?.statusSummary ??
                  'The evidence file is stored and ready for notarization updates.',
            ),
            if (certificate != null) ...[
              const SizedBox(height: 16),
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
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                FilledButton.tonalIcon(
                  onPressed: isRefreshing ? null : onRefresh,
                  icon: isRefreshing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.refresh),
                  label: Text(
                    isRefreshing ? 'Refreshing...' : 'Refresh Certificate',
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: onOpenEvidence,
                  icon: const Icon(Icons.download),
                  label: const Text('Open Evidence File'),
                ),
                if (certificate?.certificateUrl != null)
                  OutlinedButton.icon(
                    onPressed: onOpenCertificate,
                    icon: const Icon(Icons.picture_as_pdf),
                    label: const Text('Open Certificate'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyStateCard extends StatelessWidget {
  const _EmptyStateCard({
    required this.title,
    required this.body,
    required this.icon,
  });

  final String title;
  final String body;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          children: [
            Icon(icon, size: 34, color: const Color(0xFF0F766E)),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              body,
              style: const TextStyle(
                color: Color(0xFF4B5563),
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _SelectedFileCard extends StatelessWidget {
  const _SelectedFileCard({required this.file});

  final LocalEvidenceFile file;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F3F0),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Selected file',
            style: TextStyle(
              fontSize: 12,
              color: Color(0xFF4B5563),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            file.filename,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            '${_formatBytes(file.bytes.length)} • ${file.mimeType}',
            style: const TextStyle(color: Color(0xFF4B5563)),
          ),
        ],
      ),
    );
  }
}

class _StatusBanner extends StatelessWidget {
  const _StatusBanner({
    required this.tone,
    required this.title,
    required this.body,
  });

  final StatusTone tone;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: tone.foreground,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            body,
            style: TextStyle(
              color: tone.foreground.withValues(alpha: 0.9),
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}

class StatusTone {
  const StatusTone({
    required this.background,
    required this.foreground,
  });

  final Color background;
  final Color foreground;
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
        color: color.withValues(alpha: 0.12),
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
    defaultValue: 'https://wehom.net/v1',
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
    required String mimeType,
    required Uint8List fileBytes,
    String? dealReference,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/evidence/upload'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'company_name': companyName,
        'deal_reference': dealReference,
        'filename': filename,
        'mime_type': mimeType,
        'file_content_base64': base64Encode(fileBytes),
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

  String evidenceFileUrl(String evidenceId) {
    return '$_baseUrl/evidence/$evidenceId/file/download';
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
    required this.websiteMatch,
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
  final String websiteMatch;
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
      websiteMatch: json['website_match'] as String? ?? 'UNKNOWN',
      lastFilingDate: json['last_filing_date'] as String?,
      sicDescription: json['sic_description'] as String?,
    );
  }

  String get websiteMatchLabel => switch (websiteMatch) {
        'VERIFIED' => 'Verified',
        'PROBABLE' => 'Probable',
        'MISMATCH' => 'Mismatch',
        _ => 'Unknown',
      };

  StatusTone get riskTone {
    if (creditGrade == 'A') {
      return const StatusTone(
        background: Color(0xFFE6F6EC),
        foreground: Color(0xFF14532D),
      );
    }
    if (creditGrade == 'B') {
      return const StatusTone(
        background: Color(0xFFE8F3F0),
        foreground: Color(0xFF0F766E),
      );
    }
    if (creditGrade == 'C') {
      return const StatusTone(
        background: Color(0xFFFFF4DB),
        foreground: Color(0xFFB45309),
      );
    }

    return const StatusTone(
      background: Color(0xFFFDEAEA),
      foreground: Color(0xFF991B1B),
    );
  }

  String get riskToneTitle => switch (creditGrade) {
        'A' => 'Low structural risk',
        'B' => 'Moderate review recommended',
        'C' => 'Elevated commercial risk',
        _ => 'High risk warning',
      };
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

  StatusTone get statusTone => _statusToneForValue(status);

  String get statusTitle => switch (status.toUpperCase()) {
        'COMPLETED' => 'Certificate ready',
        'FAILED' => 'Provider follow-up needed',
        'IN_PROGRESS' => 'Notarization in progress',
        _ => 'Evidence processing',
      };

  String get statusSummary => switch (status.toUpperCase()) {
        'COMPLETED' =>
          'The provider certificate is available and can be opened or downloaded now.',
        'FAILED' =>
          'The provider reported a failure state. Refresh again after checking Adobe Sign.',
        'IN_PROGRESS' =>
          'The evidence is in the live notarization queue. Refresh to check for certificate completion.',
        _ =>
          'The evidence has been accepted and is waiting for provider status updates.',
      };
}

class LocalEvidenceFile {
  LocalEvidenceFile({
    required this.filename,
    required this.bytes,
    required this.mimeType,
  });

  final String filename;
  final Uint8List bytes;
  final String mimeType;
}

String _mimeTypeFromFilename(String filename) {
  final lower = filename.toLowerCase();

  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.txt')) return 'text/plain';

  return 'application/octet-stream';
}

StatusTone _statusToneForValue(String value) {
  final normalized = value.trim().toUpperCase();

  switch (normalized) {
    case 'COMPLETED':
      return const StatusTone(
        background: Color(0xFFE6F6EC),
        foreground: Color(0xFF14532D),
      );
    case 'FAILED':
      return const StatusTone(
        background: Color(0xFFFDEAEA),
        foreground: Color(0xFF991B1B),
      );
    case 'IN_PROGRESS':
    case 'PENDING_NOTARIZATION':
      return const StatusTone(
        background: Color(0xFFFFF4DB),
        foreground: Color(0xFFB45309),
      );
    default:
      return const StatusTone(
        background: Color(0xFFE8F3F0),
        foreground: Color(0xFF0F766E),
      );
  }
}

String _formatBytes(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) {
    return '${(bytes / 1024).toStringAsFixed(1)} KB';
  }
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}
