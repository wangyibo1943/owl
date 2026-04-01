import 'package:flutter/material.dart';

void main() {
  runApp(const TradeGuardApp());
}

class TradeGuardApp extends StatelessWidget {
  const TradeGuardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TradeGuard',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E)),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final companyController = TextEditingController();

    return Scaffold(
      appBar: AppBar(title: const Text('TradeGuard')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Buyer Risk Check',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            const Text(
              'Search a buyer, review risk, and preserve evidence before the deal moves forward.',
            ),
            const SizedBox(height: 24),
            TextField(
              controller: companyController,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'Company name',
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => CreditResultScreen(
                      companyName: companyController.text.isEmpty
                          ? 'Example Buyer LLC'
                          : companyController.text,
                    ),
                  ),
                );
              },
              child: const Text('Run Credit Check'),
            ),
          ],
        ),
      ),
    );
  }
}

class CreditResultScreen extends StatelessWidget {
  const CreditResultScreen({super.key, required this.companyName});

  final String companyName;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Credit Result')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              companyName,
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            Card(
              child: ListTile(
                title: const Text('Credit Grade'),
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade100,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text('B'),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: const [
                Chip(label: Text('Manual Review')),
                Chip(label: Text('Basic Checks Only')),
              ],
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const EvidenceUploadScreen(),
                  ),
                );
              },
              child: const Text('Upload Evidence'),
            ),
          ],
        ),
      ),
    );
  }
}

class EvidenceUploadScreen extends StatelessWidget {
  const EvidenceUploadScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Evidence Upload')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Upload contract or chat transcript',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            const Text('MVP supports PDF and screenshot archives.'),
            const SizedBox(height: 24),
            OutlinedButton(
              onPressed: () {},
              child: const Text('Choose File'),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const CertificateResultScreen(),
                  ),
                );
              },
              child: const Text('Submit for Notarization'),
            ),
          ],
        ),
      ),
    );
  }
}

class CertificateResultScreen extends StatelessWidget {
  const CertificateResultScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Certificate')),
      body: const Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Certificate Ready',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 16),
            ListTile(
              title: Text('Certificate ID'),
              subtitle: Text('cert_placeholder'),
            ),
            ListTile(
              title: Text('Hash'),
              subtitle: Text('sha256:placeholder'),
            ),
          ],
        ),
      ),
    );
  }
}
