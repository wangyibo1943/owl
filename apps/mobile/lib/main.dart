import 'dart:convert';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

void main() {
  runApp(const TradeGuardApp());
}

enum AppLanguage { en, zh }

class TradeGuardApp extends StatefulWidget {
  const TradeGuardApp({super.key});

  @override
  State<TradeGuardApp> createState() => _TradeGuardAppState();
}

class _TradeGuardAppState extends State<TradeGuardApp> {
  final ValueNotifier<AppLanguage> _language =
      ValueNotifier<AppLanguage>(AppLanguage.zh);

  @override
  void dispose() {
    _language.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF0F766E);

    return _TradeGuardLanguageScope(
      notifier: _language,
      child: ValueListenableBuilder<AppLanguage>(
        valueListenable: _language,
        builder: (context, language, _) {
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
        },
      ),
    );
  }
}

class _TradeGuardLanguageScope extends InheritedNotifier<ValueNotifier<AppLanguage>> {
  const _TradeGuardLanguageScope({
    required ValueNotifier<AppLanguage> notifier,
    required super.child,
  }) : super(notifier: notifier);

  static ValueNotifier<AppLanguage> notifierOf(BuildContext context) {
    final scope = context
        .dependOnInheritedWidgetOfExactType<_TradeGuardLanguageScope>();
    assert(scope != null, 'TradeGuard language scope is missing.');
    return scope!.notifier!;
  }
}

extension TradeGuardLanguageX on BuildContext {
  AppLanguage get appLanguage => _TradeGuardLanguageScope.notifierOf(this).value;

  ValueNotifier<AppLanguage> get appLanguageNotifier =>
      _TradeGuardLanguageScope.notifierOf(this);

  AppCopy get copy => AppCopy(appLanguage);
}

class AppCopy {
  const AppCopy(this.language);

  final AppLanguage language;

  bool get isChinese => language == AppLanguage.zh;

  String get creditTab => isChinese ? '征信查询' : 'Credit';
  String get evidenceTab => isChinese ? '证据存证' : 'Evidence';
  String get switchLanguage => isChinese ? '切换语言' : 'Language';
  String get chinese => '中文';
  String get english => 'English';
  String get creditHeroTitle => isChinese ? '美国买家信用查询' : 'US Buyer Risk Check';
  String get creditHeroBody => isChinese
      ? '连接 TradeGuard 实时后端，查询企业主体，给出信用等级、匹配置信度和可解释风险提示，帮助你在发货前先看清对方。'
      : 'Run a live company lookup against TradeGuard backend, score the entity, and surface registry confidence before you ship.';
  String get lookupInput => isChinese ? '查询条件' : 'Lookup Input';
  String get companyName => isChinese ? '公司名称' : 'Company name';
  String get website => isChinese ? '官网' : 'Website';
  String get websiteHint => isChinese ? 'example.com' : 'example.com';
  String get stateRegistryHint => isChinese ? '州注册提示' : 'State registry hint';
  String get auto => isChinese ? '自动' : 'Auto';
  String get california => isChinese ? '加州' : 'California';
  String get checking => isChinese ? '查询中...' : 'Checking...';
  String get runCreditCheck => isChinese ? '开始征信' : 'Run Credit Check';
  String get readyToVerifyBuyer => isChinese ? '准备开始核验买家' : 'Ready to verify a buyer';
  String get readyToVerifyBuyerBody => isChinese
      ? '输入美国公司名称和可选官网，即可获取实时信用等级、主体匹配置信度和风险解释。'
      : 'Enter a US company name and optional website to get a live risk grade, registry match confidence, and evidence-backed explanation.';
  String get evidenceHeroTitle => isChinese ? '证据固定与存证' : 'Evidence Preservation';
  String get evidenceHeroBody => isChinese
      ? '上传合同扫描件、聊天记录或截图后，系统会自动保存文件、生成哈希、完成链上锚定，并返回可下载的存证证明。'
      : 'Upload a contract scan, chat export, or screenshot and TradeGuard will store it, hash it, anchor it on-chain, and return a downloadable preservation proof.';
  String get evidenceSubmission => isChinese ? '证据提交' : 'Evidence Submission';
  String get dealReference => isChinese ? '交易编号' : 'Deal reference';
  String get chooseEvidenceFile => isChinese ? '选择证据文件' : 'Choose evidence file';
  String get evidenceNoteFallback =>
      isChinese ? '证据备注（可选兜底）' : 'Evidence note (optional fallback)';
  String get submitting => isChinese ? '提交中...' : 'Submitting...';
  String get submitForPreservation =>
      isChinese ? '提交并固定证据' : 'Submit for Preservation';
  String get preserveContractEvidence =>
      isChinese ? '固定合同与聊天证据' : 'Preserve contract evidence';
  String get preserveContractEvidenceBody => isChinese
      ? '上传 PDF、截图或聊天导出文件，系统会自动完成快速存证，并生成可下载的证明文件。'
      : 'Upload a PDF, screenshot, or chat export and the app will complete quick preservation automatically with a downloadable proof file.';
  String get fileBytesError =>
      isChinese ? '当前设备无法读取文件内容。' : 'File bytes could not be loaded on this device.';
  String get chooseFileFirst =>
      isChinese ? '请先选择文件或输入证据文本。' : 'Choose a file or enter evidence text first.';
  String get certificateOpenError =>
      isChinese ? '无法打开证书链接。' : 'Certificate URL could not be opened.';
  String get evidenceOpenError =>
      isChinese ? '无法打开证据文件链接。' : 'Evidence file URL could not be opened.';
  String get evidenceStatus => isChinese ? '证据状态' : 'Evidence Status';
  String get evidenceReceived => isChinese ? '证据已接收' : 'Evidence received';
  String get evidenceReceivedBody => isChinese
      ? '证据文件已经存入系统，系统会自动生成证明并尝试完成链上锚定。'
      : 'The evidence file is stored and the system will generate a preservation proof and attempt on-chain anchoring automatically.';
  String get evidenceId => isChinese ? '证据 ID' : 'Evidence ID';
  String get fileHash => isChinese ? '文件哈希' : 'Hash';
  String get uploadStatus => isChinese ? '上传状态' : 'Upload Status';
  String get certificateStatus => isChinese ? '证书状态' : 'Certificate Status';
  String get certificateId => isChinese ? '证书 ID' : 'Certificate ID';
  String get certificateUrl => isChinese ? '证书链接' : 'Certificate URL';
  String get pending => isChinese ? '等待中' : 'Pending';
  String get refreshing => isChinese ? '刷新中...' : 'Refreshing...';
  String get refreshCertificate =>
      isChinese ? '刷新证书状态' : 'Refresh Certificate';
  String get openEvidenceFile =>
      isChinese ? '打开证据文件' : 'Open Evidence File';
  String get openCertificate => isChinese ? '打开证书' : 'Open Certificate';
  String get selectedFile => isChinese ? '已选文件' : 'Selected file';
  String get score => isChinese ? '评分' : 'Score';
  String get confidence => isChinese ? '置信度' : 'Confidence';
  String get source => isChinese ? '来源' : 'Source';
  String get websiteMatch => isChinese ? '官网匹配' : 'Website';
  String get ticker => isChinese ? '股票代码' : 'Ticker';
  String get status => isChinese ? '状态' : 'Status';
  String get jurisdiction => isChinese ? '司法辖区' : 'Jurisdiction';
  String get registration => isChinese ? '注册号' : 'Registration';
  String get entityType => isChinese ? '主体类型' : 'Entity Type';
  String get latestFiling => isChinese ? '最近披露' : 'Latest Filing';
  String get industry => isChinese ? '行业' : 'Industry';
  String get notAvailable => isChinese ? '暂无' : 'N/A';
  String get requestFailed => isChinese ? '请求失败' : 'Request failed';
  String get companyNotFound => isChinese ? '未找到该公司' : 'Company was not found';
  String get unsupportedState => isChinese
      ? '当前 MVP 仅支持加州私营公司州注册查询'
      : 'Only California state registry lookup is supported for private companies in this MVP';
  String get badRequest => isChinese ? '请求参数有误' : 'Bad Request';
  String get certificateReady => isChinese ? '证书已就绪' : 'Certificate ready';
  String get providerFollowUpNeeded =>
      isChinese ? '需要继续跟进提供方状态' : 'Provider follow-up needed';
  String get notarizationInProgress =>
      isChinese ? '存证处理中' : 'Notarization in progress';
  String get evidenceProcessing => isChinese ? '证据处理中' : 'Evidence processing';
  String get certificateReadyBody => isChinese
      ? '存证证明已经生成，现在可以直接打开或下载。'
      : 'The preservation proof is available and can be opened or downloaded now.';
  String get providerFollowUpNeededBody => isChinese
      ? '当前处理链路返回了失败状态，请稍后刷新或重新提交。'
      : 'The preservation pipeline reported a failure state. Refresh again or resubmit later.';
  String get notarizationInProgressBody => isChinese
      ? '证据正在处理，请稍后刷新查看证明是否已经生成。'
      : 'The evidence is being processed. Refresh to check whether the proof is ready.';
  String get evidenceProcessingBody => isChinese
      ? '证据已被系统接收，正在等待提供方状态更新。'
      : 'The evidence has been accepted and is waiting for provider status updates.';
  String gradeRiskTitle(String grade) => switch (grade) {
        'A' => isChinese ? '结构性风险较低' : 'Low structural risk',
        'B' => isChinese ? '建议进一步复核' : 'Moderate review recommended',
        'C' => isChinese ? '商业风险偏高' : 'Elevated commercial risk',
        _ => isChinese ? '高风险预警' : 'High risk warning',
      };
  String websiteMatchLabel(String value) => switch (value) {
        'VERIFIED' => isChinese ? '已验证' : 'Verified',
        'PROBABLE' => isChinese ? '大概率匹配' : 'Probable',
        'MISMATCH' => isChinese ? '不匹配' : 'Mismatch',
        _ => isChinese ? '未知' : 'Unknown',
      };
  String riskFlagLabel(String flag) {
    const zh = {
      'MISSING_PUBLIC_WEBSITE': '缺少公开官网',
      'MEDIUM_MATCH_CONFIDENCE': '匹配置信度中等',
      'LOW_MATCH_CONFIDENCE': '匹配置信度较低',
      'INPUT_WEBSITE_NOT_VERIFIED': '输入官网未验证',
      'WEBSITE_MISMATCH': '官网不匹配',
      'NON_ACTIVE_STATUS': '主体状态非正常',
      'INACTIVE_ENTITY': '主体已失效',
      'BRANCH_ENTITY': '分支主体',
      'MISSING_REGISTRATION_NUMBER': '缺少注册号',
      'PO_BOX_AGENT': '代理地址为邮政信箱',
      'LIMITED_JURISDICTION_DATA': '司法辖区信息有限',
      'NON_US_JURISDICTION': '非美国辖区',
      'MISSING_LEI': '缺少 LEI',
      'MISSING_TICKER': '缺少股票代码',
      'MISSING_INDUSTRY_CLASSIFICATION': '缺少行业分类',
      'MISSING_PUBLIC_FILING_HISTORY': '缺少公开披露记录',
      'MISSING_LOCAL_REGISTRY_NUMBER': '缺少本地注册号',
      'MISSING_REGISTRATION_REFRESH_DATE': '缺少登记更新时间',
      'MISSING_AGENT_ADDRESS': '缺少代理地址',
      'NEW_ENTITY': '成立时间较短',
      'MISSING_INCORPORATION_DATE': '缺少成立时间',
      'STALE_PUBLIC_FILINGS': '公开披露记录过旧',
      'AGING_PUBLIC_FILINGS': '公开披露记录偏旧',
    };

    return isChinese ? (zh[flag] ?? flag) : flag;
  }
}

String _mapErrorMessage(BuildContext context, Object error) {
  final copy = context.copy;
  final message = '$error';
  if (message.contains('Company was not found')) return copy.companyNotFound;
  if (message.contains('UNSUPPORTED_STATE') ||
      message.contains(
        'Only California state registry lookup is supported for private companies in this MVP',
      )) {
    return copy.unsupportedState;
  }
  if (message.contains('Bad Request')) return copy.badRequest;
  if (message.startsWith('Exception: ')) {
    return message.replaceFirst('Exception: ', '');
  }
  return message == 'Request failed' ? copy.requestFailed : message;
}

class _LanguageSwitcher extends StatelessWidget {
  const _LanguageSwitcher();

  @override
  Widget build(BuildContext context) {
    final copy = context.copy;
    final notifier = context.appLanguageNotifier;
    return PopupMenuButton<AppLanguage>(
      tooltip: copy.switchLanguage,
      onSelected: (language) {
        notifier.value = language;
      },
      itemBuilder: (context) => [
        PopupMenuItem<AppLanguage>(
          value: AppLanguage.zh,
          child: Text(copy.chinese),
        ),
        PopupMenuItem<AppLanguage>(
          value: AppLanguage.en,
          child: Text(copy.english),
        ),
      ],
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFE8F3F0),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          context.appLanguage == AppLanguage.zh ? '中文' : 'EN',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class TradeGuardHomePage extends StatelessWidget {
  const TradeGuardHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final copy = context.copy;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('TradeGuard'),
          actions: const [_LanguageSwitcher()],
          bottom: TabBar(
            tabs: [
              Tab(text: copy.creditTab),
              Tab(text: copy.evidenceTab),
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
        _error = _mapErrorMessage(context, error);
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
    final copy = context.copy;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _HeroCard(
          title: copy.creditHeroTitle,
          body: copy.creditHeroBody,
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  copy.lookupInput,
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _companyController,
                  decoration: InputDecoration(
                    labelText: copy.companyName,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _websiteController,
                  decoration: InputDecoration(
                    labelText: copy.website,
                    hintText: copy.websiteHint,
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _selectedState,
                  decoration: InputDecoration(
                    labelText: copy.stateRegistryHint,
                  ),
                  items: [
                    DropdownMenuItem<String>(
                      value: '',
                      child: Text(copy.auto),
                    ),
                    DropdownMenuItem<String>(
                      value: 'CA',
                      child: Text(copy.california),
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
                  label: Text(
                    _isLoading ? copy.checking : copy.runCreditCheck,
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
        if (!_isLoading && _result == null && _error == null) ...[
          const SizedBox(height: 16),
          _EmptyStateCard(
            title: copy.readyToVerifyBuyer,
            body: copy.readyToVerifyBuyerBody,
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
        _error = context.copy.fileBytesError;
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
        throw Exception(context.copy.chooseFileFirst);
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
        _error = _mapErrorMessage(context, error);
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
      final certificate =
          await TradeGuardApi.instance.getCertificate(evidenceId);

      setState(() {
        _certificate = certificate;
      });
    } catch (error) {
      setState(() {
        _error = _mapErrorMessage(context, error);
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
        _error = context.copy.certificateOpenError;
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
        _error = context.copy.evidenceOpenError;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final copy = context.copy;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _HeroCard(
          title: copy.evidenceHeroTitle,
          body: copy.evidenceHeroBody,
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  copy.evidenceSubmission,
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _companyController,
                  decoration: InputDecoration(labelText: copy.companyName),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _dealReferenceController,
                  decoration: InputDecoration(labelText: copy.dealReference),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _pickFile,
                  icon: const Icon(Icons.attach_file),
                  label: Text(
                    _selectedFile == null
                        ? copy.chooseEvidenceFile
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
                  decoration: InputDecoration(
                    labelText: copy.evidenceNoteFallback,
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
                    _isSubmitting
                        ? copy.submitting
                        : copy.submitForPreservation,
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
          _EmptyStateCard(
            title: copy.preserveContractEvidence,
            body: copy.preserveContractEvidenceBody,
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
    final copy = context.copy;

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
                _MetricChip(label: copy.score, value: '${result.riskScore}'),
                _MetricChip(
                  label: copy.confidence,
                  value: result.matchConfidence,
                ),
                _MetricChip(label: copy.source, value: result.sourceName),
                _MetricChip(
                  label: copy.websiteMatch,
                  value: result.websiteMatchLabel(context),
                ),
                if (result.ticker != null)
                  _MetricChip(label: copy.ticker, value: result.ticker!),
              ],
            ),
            const SizedBox(height: 16),
            _StatusBanner(
              tone: result.riskTone,
              title: result.riskToneTitle(context),
              body: result.summary,
            ),
            const SizedBox(height: 16),
            _DetailRow(label: copy.status, value: result.status),
            _DetailRow(
              label: copy.jurisdiction,
              value: result.jurisdiction ?? copy.notAvailable,
            ),
            _DetailRow(
              label: copy.registration,
              value: result.registrationNumber ?? copy.notAvailable,
            ),
            _DetailRow(
              label: copy.entityType,
              value: result.entityType ?? copy.notAvailable,
            ),
            _DetailRow(
              label: copy.latestFiling,
              value: result.lastFilingDate ?? copy.notAvailable,
            ),
            _DetailRow(
              label: copy.industry,
              value: result.sicDescription ?? copy.notAvailable,
            ),
            _DetailRow(
              label: copy.websiteMatch,
              value: result.websiteMatchLabel(context),
            ),
            if (result.riskFlags.isNotEmpty) ...[
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: result.riskFlags
                    .map(
                      (flag) => Chip(
                        label: Text(copy.riskFlagLabel(flag)),
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
    final copy = context.copy;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              copy.evidenceStatus,
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            _DetailRow(label: copy.evidenceId, value: submission.evidenceId),
            _DetailRow(label: copy.fileHash, value: submission.fileHash),
            _DetailRow(label: copy.uploadStatus, value: submission.status),
            const SizedBox(height: 8),
            _StatusBanner(
              tone: certificate?.statusTone ??
                  _statusToneForValue(submission.status),
              title: certificate?.statusTitle(context) ?? copy.evidenceReceived,
              body: certificate?.statusSummary(context) ??
                  copy.evidenceReceivedBody,
            ),
            if (certificate != null) ...[
              const SizedBox(height: 16),
              _DetailRow(
                label: copy.certificateStatus,
                value: certificate!.status,
              ),
              _DetailRow(
                label: copy.certificateId,
                value: certificate!.certificateId ?? copy.pending,
              ),
              _DetailRow(
                label: copy.certificateUrl,
                value: certificate!.certificateUrl ?? copy.pending,
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
                    isRefreshing ? copy.refreshing : copy.refreshCertificate,
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: onOpenEvidence,
                  icon: const Icon(Icons.download),
                  label: Text(copy.openEvidenceFile),
                ),
                if (certificate?.certificateUrl != null)
                  OutlinedButton.icon(
                    onPressed: onOpenCertificate,
                    icon: const Icon(Icons.picture_as_pdf),
                    label: Text(copy.openCertificate),
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
    final copy = context.copy;

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
          Text(
            copy.selectedFile,
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
        'preservation_mode': 'QUICK_PRESERVATION',
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

  String websiteMatchLabel(BuildContext context) =>
      context.copy.websiteMatchLabel(websiteMatch);

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

  String riskToneTitle(BuildContext context) =>
      context.copy.gradeRiskTitle(creditGrade);
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

  String statusTitle(BuildContext context) => switch (status.toUpperCase()) {
        'COMPLETED' => context.copy.certificateReady,
        'FAILED' => context.copy.providerFollowUpNeeded,
        'IN_PROGRESS' => context.copy.notarizationInProgress,
        _ => context.copy.evidenceProcessing,
      };

  String statusSummary(BuildContext context) => switch (status.toUpperCase()) {
        'COMPLETED' => context.copy.certificateReadyBody,
        'FAILED' => context.copy.providerFollowUpNeededBody,
        'IN_PROGRESS' => context.copy.notarizationInProgressBody,
        _ => context.copy.evidenceProcessingBody,
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
