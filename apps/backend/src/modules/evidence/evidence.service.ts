import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { AdobeSignService } from './adobe-sign.service';
import { FileStorageService } from './file-storage.service';
import { SupabaseService } from '../database/supabase.service';
import { CreateAdobeSignNotarizationDto } from './dto/create-adobe-sign-notarization.dto';
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

type CertificateDownloadResult = {
  content: Buffer;
  content_type: string;
  file_name: string;
};

type EvidenceDownloadResult = {
  content: Buffer;
  content_type: string;
  file_name: string;
};

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly adobeSignService: AdobeSignService,
    private readonly fileStorageService: FileStorageService,
  ) {}

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

    await this.fileStorageService.ensureWritable();
    await this.fileStorageService.saveFile(storagePath, decoded);

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

  async downloadEvidenceFile(evidenceId: string): Promise<EvidenceDownloadResult> {
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

    if (!evidence.storage_path) {
      throw new NotFoundException({
        success: false,
        error_code: 'FILE_NOT_FOUND',
        message: 'Stored file path was not found',
      });
    }

    const file = await this.fileStorageService.readFile(evidence.storage_path);

    return {
      content: file.content,
      content_type: evidence.mime_type || 'application/octet-stream',
      file_name: evidence.filename,
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

    const refreshedCertificate = await this.maybeRefreshAdobeCertificateStatus(
      evidenceId,
      certificate,
    );

    return {
      success: true,
      data: {
        evidence_id: evidenceId,
        certificate_id:
          refreshedCertificate.provider_certificate_id ??
          refreshedCertificate.id,
        certificate_url: refreshedCertificate.certificate_url,
        status: refreshedCertificate.status,
      },
    };
  }

  async createAdobeSignNotarization(payload: CreateAdobeSignNotarizationDto) {
    const agreement = await this.adobeSignService.createAgreement({
      filename: payload.filename,
      mimeType: payload.mime_type,
      fileContentBase64: payload.file_content_base64,
    });

    return {
      provider_name: 'Adobe Acrobat Sign',
      provider_certificate_id: agreement.agreementId,
      certificate_url: this.buildCertificateDownloadUrl(payload.evidence_id),
      status: this.adobeSignService.mapAgreementStatus(
        agreement.agreementStatus,
      ),
      provider_payload: {
        agreement_id: agreement.agreementId,
        agreement_status: agreement.agreementStatus,
        file_hash: payload.file_hash,
        adobe_payload: agreement.rawPayload,
      },
    };
  }

  async syncAdobeSignNotarization(evidenceId: string) {
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
      throw new NotFoundException({
        success: false,
        error_code: 'CERTIFICATE_NOT_FOUND',
        message: 'Certificate record was not found',
      });
    }

    const providerName = certificate.provider_name.toLowerCase();

    if (!providerName.includes('adobe')) {
      throw new BadRequestException({
        success: false,
        error_code: 'UNSUPPORTED_PROVIDER',
        message: 'This certificate is not managed by Adobe Sign sync',
      });
    }

    const agreementId =
      certificate.provider_certificate_id ||
      (typeof certificate.provider_payload?.agreement_id === 'string'
        ? certificate.provider_payload.agreement_id
        : null);

    if (!agreementId) {
      throw new NotFoundException({
        success: false,
        error_code: 'CERTIFICATE_NOT_FOUND',
        message: 'Adobe agreement id was not found',
      });
    }

    const agreement = await this.adobeSignService.getAgreement(agreementId);
    const agreementStatus =
      typeof agreement.status === 'string' ? agreement.status : 'IN_PROCESS';
    const normalizedStatus =
      this.adobeSignService.mapAgreementStatus(agreementStatus);

    return this.recordNotarizationResult(evidenceId, {
      provider_name: 'Adobe Acrobat Sign',
      provider_certificate_id: agreementId,
      certificate_url: this.buildCertificateDownloadUrl(evidenceId),
      status: normalizedStatus,
      provider_payload: {
        ...(certificate.provider_payload ?? {}),
        agreement_id: agreementId,
        agreement_status: agreementStatus,
        adobe_payload: agreement,
      },
    });
  }

  async syncPendingAdobeSignNotarizations() {
    const certificates =
      await this.supabaseService.findMany<NotarizationCertificateRecord>(
        'notarization_certificates',
        {
          status: 'IN_PROGRESS',
        },
        {
          orderBy: 'created_at',
          ascending: false,
          limit: 20,
        },
      );

    const adobeCertificates = certificates.filter((certificate) =>
      certificate.provider_name.toLowerCase().includes('adobe'),
    );

    const results = await Promise.allSettled(
      adobeCertificates.map((certificate) =>
        this.syncAdobeSignNotarization(certificate.evidence_id),
      ),
    );

    return {
      success: true,
      data: {
        scanned: certificates.length,
        attempted: adobeCertificates.length,
        synced: results.filter((result) => result.status === 'fulfilled').length,
        failed: results.filter((result) => result.status === 'rejected').length,
      },
    };
  }

  async downloadCertificate(evidenceId: string): Promise<CertificateDownloadResult> {
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

    if (!certificate || !certificate.certificate_url) {
      throw new NotFoundException({
        success: false,
        error_code: 'CERTIFICATE_NOT_FOUND',
        message: 'Certificate file was not found',
      });
    }

    const refreshedCertificate = await this.maybeRefreshAdobeCertificateStatus(
      evidenceId,
      certificate,
    );

    if (refreshedCertificate.provider_name.toLowerCase().includes('adobe')) {
      const agreementId =
        refreshedCertificate.provider_certificate_id ||
        (typeof refreshedCertificate.provider_payload?.agreement_id === 'string'
          ? refreshedCertificate.provider_payload.agreement_id
          : null);

      if (!agreementId) {
        throw new NotFoundException({
          success: false,
          error_code: 'CERTIFICATE_NOT_FOUND',
          message: 'Adobe agreement id was not found',
        });
      }

      const document = await this.adobeSignService.downloadAgreementCombinedDocument(
        agreementId,
      );

      return {
        content: document.content,
        content_type: document.contentType,
        file_name: this.buildAdobeCertificateFileName({
          evidence,
          certificate: refreshedCertificate,
          agreementId,
        }),
      };
    }

    const response = await fetch(refreshedCertificate.certificate_url!);

    if (!response.ok) {
      throw new NotFoundException({
        success: false,
        error_code: 'CERTIFICATE_DOWNLOAD_FAILED',
        message: 'Certificate file could not be downloaded',
      });
    }

    const contentType =
      response.headers.get('content-type')?.split(';')[0].trim() ||
      'application/octet-stream';
    const content = Buffer.from(await response.arrayBuffer());
    const fileName = this.buildCertificateFileName({
      evidence,
      certificate: refreshedCertificate,
      contentType,
      certificateUrl: refreshedCertificate.certificate_url!,
    });

    return {
      content,
      content_type: contentType,
      file_name: fileName,
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

  private buildCertificateDownloadUrl(evidenceId: string) {
    return `${this.getApiBaseUrl()}/v1/evidence/${evidenceId}/certificate/download`;
  }

  private buildCertificateFileName(input: {
    evidence: EvidenceRecord;
    certificate: NotarizationCertificateRecord;
    contentType: string;
    certificateUrl: string;
  }) {
    const baseName = input.evidence.filename.replace(/\.[^.]+$/, '');
    const normalizedBaseName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const providerId =
      input.certificate.provider_certificate_id?.replace(/[^a-zA-Z0-9._-]/g, '_') ||
      input.certificate.id;
    const extension =
      this.extensionFromContentType(input.contentType) ||
      extname(new URL(input.certificateUrl).pathname) ||
      '.bin';

    return `${normalizedBaseName}-certificate-${providerId}${extension}`;
  }

  private buildAdobeCertificateFileName(input: {
    evidence: EvidenceRecord;
    certificate: NotarizationCertificateRecord;
    agreementId: string;
  }) {
    const baseName = input.evidence.filename.replace(/\.[^.]+$/, '');
    const normalizedBaseName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const providerId =
      input.certificate.provider_certificate_id?.replace(/[^a-zA-Z0-9._-]/g, '_') ||
      input.agreementId;

    return `${normalizedBaseName}-adobe-sign-certificate-${providerId}.pdf`;
  }

  private extensionFromContentType(contentType: string) {
    switch (contentType) {
      case 'application/pdf':
        return '.pdf';
      case 'application/json':
        return '.json';
      case 'text/plain':
        return '.txt';
      case 'application/zip':
        return '.zip';
      default:
        return '';
    }
  }

  private getApiBaseUrl() {
    const explicitBaseUrl = process.env.TRADEGUARD_API_BASE_URL?.trim();

    if (explicitBaseUrl) {
      return explicitBaseUrl.replace(/\/$/, '');
    }

    const port = process.env.PORT?.trim() || '3000';
    return `http://localhost:${port}`;
  }

  private async triggerNotarizationWorkflow(
    payload: Record<string, unknown>,
  ): Promise<{
    triggered: boolean;
    status: string;
  }> {
    if (this.adobeSignService.isConfigured()) {
      try {
        const adobeResponse = await this.createAdobeSignNotarization({
          evidence_id: String(payload.evidence_id),
          filename: String(payload.filename),
          mime_type: String(payload.mime_type),
          file_content_base64: String(payload.file_content_base64),
          file_hash: String(payload.file_hash),
        });

        await this.recordNotarizationResult(String(payload.evidence_id), {
          provider_name: adobeResponse.provider_name,
          provider_certificate_id: adobeResponse.provider_certificate_id,
          certificate_url: adobeResponse.certificate_url,
          status: adobeResponse.status,
          provider_payload: adobeResponse.provider_payload,
        });

        await this.logWorkflow({
          reference_id: String(payload.evidence_id),
          status: 'DIRECT_PROVIDER_TRIGGERED',
          payload: adobeResponse,
        });

        return {
          triggered: true,
          status: adobeResponse.status,
        };
      } catch (error) {
        this.logger.error(
          `Failed to trigger direct Adobe Sign notarization: ${
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
          status: 'DIRECT_PROVIDER_EXCEPTION',
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

  private async maybeRefreshAdobeCertificateStatus(
    evidenceId: string,
    certificate: NotarizationCertificateRecord,
  ) {
    if (!certificate.provider_name.toLowerCase().includes('adobe')) {
      return certificate;
    }

    if (['COMPLETED', 'FAILED'].includes(certificate.status)) {
      return certificate;
    }

    try {
      await this.syncAdobeSignNotarization(evidenceId);
      return (
        (await this.supabaseService.findFirst<NotarizationCertificateRecord>(
          'notarization_certificates',
          { evidence_id: evidenceId },
          {
            orderBy: 'created_at',
            ascending: false,
          },
        )) ?? certificate
      );
    } catch (error) {
      this.logger.warn(
        `Adobe Sign status refresh skipped for ${evidenceId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return certificate;
    }
  }
}
