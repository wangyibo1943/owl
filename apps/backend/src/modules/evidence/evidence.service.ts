import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';

@Injectable()
export class EvidenceService {
  async create(payload: CreateEvidenceDto) {
    const decoded = Buffer.from(payload.file_content_base64, 'base64');
    const hash = createHash('sha256').update(decoded).digest('hex');

    return {
      success: true,
      data: {
        evidence_id: randomUUID(),
        filename: payload.filename,
        file_hash: `sha256:${hash}`,
        status: 'PENDING_NOTARIZATION',
      },
    };
  }

  async getCertificate(evidenceId: string) {
    return {
      success: true,
      data: {
        evidence_id: evidenceId,
        certificate_id: 'cert_placeholder',
        certificate_url: 'https://provider.example/certificate/cert_placeholder',
        status: 'COMPLETED',
      },
    };
  }
}

