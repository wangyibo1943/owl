import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { SupabaseService } from '../database/supabase.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { RecordNotarizationResultDto } from './dto/record-notarization-result.dto';

type EvidenceRecord = {
  id: string;
  company_name: string;
  deal_reference: string | null;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number;
  file_hash: string;
  storage_path: string | null;
  status: string;
  created_at: string;
};

type NotarizationCertificateRecord = {
  id: string;
  evidence_id: string;
  provider_name: string;
  provider_certificate_id: string | null;
  certificate_url: string | null;
  provider_payload: Record<string, unknown> | null;
  status: string;
  created_at: string;
};

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async create(payload: CreateEvidenceDto) {
    const decoded = this.decodeFile(payload.file_content_base64);

    if (decoded.length === 0) {
      throw new BadRequestException({
        success: false,
        error_code: 'EMPTY_FILE',
        message: 'Uploaded file is empty',
      });
    }

    const evidenceId = randomUUID();
    const hash = createHash('sha256').update(decoded).digest('hex');
    const fileHash = `sha256:${hash}`;
    const storagePath = this.buildStoragePath(evidenceId, payload.filename);

    await this.supabaseService.insert('evidence_records', {
      id: evidenceId,
      company_name: payload.company_name.trim(),
      deal_reference: payload.deal_reference?.trim() || null,
      filename: payload.filename,
      mime_type: payload.mime_type,
      file_size_bytes: decoded.length,
      file_hash: fileHash,
      storage_path: storagePath,
      status: 'PENDING_NOTARIZATION',
    });

    const workflowResult = await this.triggerNotarizationWorkflow({
      evidence_id: evidenceId,
      company_name: payload.company_name.trim(),
      deal_reference: payload.deal_reference?.trim() || null,
      filename: payload.filename,
      mime_type: payload.mime_type,
      file_hash: fileHash,
      file_size_bytes: decoded.length,
      file_content_base64: payload.file_content_base64,
      storage_path: storagePath,
    });

    return {
      success: true,
      data: {
        evidence_id: evidenceId,
        filename: payload.filename,
        file_hash: fileHash,
        status: workflowResult.status,
        workflow_triggered: workflowResult.triggered,
      },
    };
  }

  async getCertificate(evidenceId: string) {
    const evidence = await this.supabaseService.findFirst<EvidenceRecord>(
      'evidence_records',
      {
        id: evidenceId,
      },
    );

    if (!evidence) {
      throw new NotFoundException({
        success: false,
        error_code: 'EVIDENCE_NOT_FOUND',
        message: 'Evidence record was not found',
      });
    }

    const certificate =
      await this.supabaseService.findFirst<NotarizationCertificateRecord>(
        'notarization_certificates',
        {
          evidence_id: evidenceId,
        },
        {
          orderBy: 'created_at',
          ascending: false,
        },
      );

    if (!certificate) {
      return {
        success: true,
        data: {
          evidence_id: evidenceId,
          certificate_id: null,
          certificate_url: null,
          status: evidence.status,
        },
      };
    }

    return {
      success: true,
      data: {
        evidence_id: evidenceId,
        certificate_id: certificate.provider_certificate_id ?? certificate.id,
        certificate_url: certificate.certificate_url,
        status: certificate.status,
      },
    };
  }

  async recordNotarizationResult(
    evidenceId: string,
    payload: RecordNotarizationResultDto,
  ) {
    const evidence = await this.supabaseService.findFirst<EvidenceRecord>(
      'evidence_records',
      {
        id: evidenceId,
      },
    );

    if (!evidence) {
      throw new NotFoundException({
        success: false,
        error_code: 'EVIDENCE_NOT_FOUND',
        message: 'Evidence record was not found',
      });
    }

    const normalizedStatus = payload.status.trim().toUpperCase();
    const existingCertificate =
      await this.supabaseService.findFirst<NotarizationCertificateRecord>(
        'notarization_certificates',
        {
          evidence_id: evidenceId,
        },
        {
          orderBy: 'created_at',
          ascending: false,
        },
      );

    const certificatePayload = {
      evidence_id: evidenceId,
      provider_name: payload.provider_name.trim(),
      provider_certificate_id: payload.provider_certificate_id?.trim() || null,
      certificate_url: payload.certificate_url?.trim() || null,
      provider_payload: payload.provider_payload ?? null,
      status: normalizedStatus,
    };

    if (existingCertificate) {
      await this.supabaseService.update(
        'notarization_certificates',
        { id: existingCertificate.id },
        certificatePayload,
      );
    } else {
      await this.supabaseService.insert(
        'notarization_certificates',
        certificatePayload,
      );
    }

    await this.supabaseService.update(
      'evidence_records',
      { id: evidenceId },
      { status: normalizedStatus },
    );

    await this.logWorkflow({
      reference_id: evidenceId,
      status: 'RESULT_RECORDED',
      payload: certificatePayload,
    });

    return {
      success: true,
      data: {
        evidence_id: evidenceId,
        status: normalizedStatus,
        certificate_id: certificatePayload.provider_certificate_id,
        certificate_url: certificatePayload.certificate_url,
      },
    };
  }

  private decodeFile(fileContentBase64: string) {
    const normalized = fileContentBase64.replace(/\s+/g, '');

    if (
      normalized.length === 0 ||
      normalized.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
    ) {
      throw new BadRequestException({
        success: false,
        error_code: 'INVALID_FILE',
        message: 'File content is not valid base64',
      });
    }

    return Buffer.from(normalized, 'base64');
  }

  private buildStoragePath(evidenceId: string, filename: string) {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `evidence/${evidenceId}/${sanitizedFilename}`;
  }

  private async triggerNotarizationWorkflow(
    payload: Record<string, unknown>,
  ): Promise<{
    triggered: boolean;
    status: string;
  }> {
    const explicitWebhookUrl = process.env.N8N_EVIDENCE_WEBHOOK_URL?.trim();
    const webhookBaseUrl = process.env.N8N_WEBHOOK_BASE_URL?.trim();

    if (!explicitWebhookUrl && !webhookBaseUrl) {
      await this.supabaseService.update(
        'evidence_records',
        { id: payload.evidence_id },
        { status: 'PENDING_WORKFLOW_CONFIGURATION' },
      );
      await this.logWorkflow({
        reference_id: String(payload.evidence_id),
        status: 'SKIPPED_CONFIGURATION_MISSING',
        payload,
      });

      return {
        triggered: false,
        status: 'PENDING_WORKFLOW_CONFIGURATION',
      };
    }

    const webhookUrl = explicitWebhookUrl
      ? new URL(explicitWebhookUrl)
      : new URL(
          'tradeguard-evidence-notarization',
          webhookBaseUrl!.endsWith('/')
            ? webhookBaseUrl
            : `${webhookBaseUrl!}/`,
        );

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        await this.supabaseService.update(
          'evidence_records',
          { id: payload.evidence_id },
          { status: 'NOTARIZATION_TRIGGER_FAILED' },
        );
        await this.logWorkflow({
          reference_id: String(payload.evidence_id),
          status: 'TRIGGER_FAILED',
          payload: {
            response_status: response.status,
          },
        });

        return {
          triggered: false,
          status: 'NOTARIZATION_TRIGGER_FAILED',
        };
      }

      const responsePayload =
        ((await response.json()) as Record<string, unknown>) ?? {};

      await this.logWorkflow({
        reference_id: String(payload.evidence_id),
        status: 'TRIGGERED',
        payload: responsePayload,
      });

      return {
        triggered: true,
        status: 'PENDING_NOTARIZATION',
      };
    } catch (error) {
      this.logger.error(
        `Failed to trigger notarization workflow: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      await this.supabaseService.update(
        'evidence_records',
        { id: payload.evidence_id },
        { status: 'NOTARIZATION_TRIGGER_FAILED' },
      );
      await this.logWorkflow({
        reference_id: String(payload.evidence_id),
        status: 'TRIGGER_EXCEPTION',
        payload: {
          message: error instanceof Error ? error.message : 'unknown error',
        },
      });

      return {
        triggered: false,
        status: 'NOTARIZATION_TRIGGER_FAILED',
      };
    }
  }

  private async logWorkflow(payload: Record<string, unknown>) {
    await this.supabaseService.insert('workflow_logs', {
      workflow_name: 'TradeGuard_Evidence_Notarization',
      ...payload,
    });
  }
}
