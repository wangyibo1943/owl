import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join } from 'node:path';
import JSZip = require('jszip');
import PDFDocument = require('pdfkit');
import { SupabaseService } from '../database/supabase.service';
import { FileStorageService } from '../evidence/file-storage.service';
import { CreateLegalTriggerDto } from './dto/create-legal-trigger.dto';

type EvidenceRecord = {
  id: string;
  company_name: string;
  deal_reference: string | null;
  filename: string;
  file_hash: string;
  status: string;
  created_at: string;
};

type NotarizationCertificateRecord = {
  id: string;
  status: string;
  certificate_url: string | null;
};

type BlockchainAnchorRecord = {
  id: string;
  chain_name: string;
  provider_name: string;
  transaction_hash: string;
  anchor_status: string;
  anchor_proof_url: string | null;
  anchored_hash: string;
  created_at: string;
};

type LegalTriggerRecord = {
  id: string;
  evidence_id: string;
  anchor_id: string | null;
  seller_name: string;
  seller_email: string | null;
  buyer_name: string;
  buyer_email: string | null;
  amount_in_dispute: number | null;
  currency: string | null;
  breach_summary: string;
  trigger_status: string;
  demand_letter_status: string;
  bundle_status: string;
  handoff_status: string;
  demand_letter_url: string | null;
  bundle_url: string | null;
  lawyer_contact: string | null;
  provider_payload: Record<string, unknown> | null;
  created_at: string;
};

type DemandLetterRecord = {
  id: string;
  legal_trigger_id: string;
  draft_text: string;
  export_url: string | null;
  review_status: string;
  provider_payload: Record<string, unknown> | null;
  created_at: string;
};

type EvidenceBundleRecord = {
  id: string;
  legal_trigger_id: string;
  manifest_json: Record<string, unknown>;
  bundle_url: string | null;
  review_status: string;
  provider_payload: Record<string, unknown> | null;
  created_at: string;
};

type BundleArtifact = {
  storage_path: string;
  legacy_file_path: string;
  file_name: string;
  download_url: string;
  content_type: string;
};

type BundleDownloadResult = {
  content: Buffer;
  content_type: string;
  file_name: string;
};

type DemandLetterArtifact = {
  file_name: string;
  storage_path: string;
  download_url: string;
  content_type: string;
  format: 'pdf' | 'docx';
};

type DemandLetterArtifacts = {
  pdf: DemandLetterArtifact;
  docx: DemandLetterArtifact;
};

type DemandLetterDownloadResult = {
  content: Buffer;
  content_type: string;
  file_name: string;
};

@Injectable()
export class LegalService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async createTrigger(payload: CreateLegalTriggerDto) {
    const evidence = await this.supabaseService.findFirst<EvidenceRecord>(
      'evidence_records',
      {
        id: payload.evidence_id,
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
          evidence_id: payload.evidence_id,
        },
        {
          orderBy: 'created_at',
          ascending: false,
        },
      );

    if (!certificate || certificate.status.toUpperCase() !== 'COMPLETED') {
      throw new BadRequestException({
        success: false,
        error_code: 'CERTIFICATE_NOT_READY',
        message:
          'Evidence must have a completed notarization certificate before legal trigger creation',
      });
    }

    const anchor = await this.supabaseService.findFirst<BlockchainAnchorRecord>(
      'blockchain_anchors',
      {
        evidence_id: payload.evidence_id,
      },
      {
        orderBy: 'created_at',
        ascending: false,
      },
    );

    if (!anchor || anchor.anchor_status.toUpperCase() !== 'ANCHORED') {
      throw new BadRequestException({
        success: false,
        error_code: 'ANCHOR_NOT_READY',
        message:
          'Evidence must be anchored on-chain before legal trigger creation',
      });
    }

    const existingTrigger = await this.supabaseService.findFirst<LegalTriggerRecord>(
      'legal_triggers',
      {
        evidence_id: payload.evidence_id,
      },
      {
        orderBy: 'created_at',
        ascending: false,
      },
    );

    if (existingTrigger) {
      return {
        success: true,
        data: this.mapTriggerResponse(existingTrigger),
      };
    }

    if (!this.supabaseService.isEnabled()) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'CONFIGURATION_ERROR',
        message: 'Supabase is not configured',
      });
    }

    const normalizedCurrency = payload.currency?.trim().toUpperCase() || 'USD';
    const inserted = await this.supabaseService.insert<LegalTriggerRecord>(
      'legal_triggers',
      {
        evidence_id: payload.evidence_id,
        anchor_id: anchor.id,
        seller_name: payload.seller_name.trim(),
        seller_email: payload.seller_email?.trim() || null,
        buyer_name: payload.buyer_name.trim(),
        buyer_email: payload.buyer_email?.trim() || null,
        amount_in_dispute: payload.amount_in_dispute ?? null,
        currency: payload.amount_in_dispute != null ? normalizedCurrency : null,
        breach_summary: payload.breach_summary.trim(),
        trigger_status: 'INTAKE_COMPLETED',
        demand_letter_status: 'PENDING',
        bundle_status: 'PENDING',
        handoff_status: 'NOT_STARTED',
        demand_letter_url: null,
        bundle_url: null,
        lawyer_contact: payload.lawyer_contact?.trim() || null,
        provider_payload: {
          evidence_company_name: evidence.company_name,
          evidence_filename: evidence.filename,
          deal_reference: evidence.deal_reference,
          evidence_created_at: evidence.created_at,
          certificate_id: certificate.id,
          certificate_url: certificate.certificate_url,
          anchor_transaction_hash: anchor.transaction_hash,
          anchor_proof_url: anchor.anchor_proof_url,
        },
      },
    );

    if (!inserted) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'LEGAL_TRIGGER_CREATE_FAILED',
        message: 'Legal trigger record could not be created',
      });
    }

    await this.supabaseService.insert('workflow_logs', {
      workflow_name: 'TradeGuard_Legal_Trigger',
      reference_id: inserted.id,
      status: 'INTAKE_COMPLETED',
      payload: {
        evidence_id: inserted.evidence_id,
        anchor_id: inserted.anchor_id,
        demand_letter_status: inserted.demand_letter_status,
        bundle_status: inserted.bundle_status,
        handoff_status: inserted.handoff_status,
      },
    });

    return {
      success: true,
      data: this.mapTriggerResponse(inserted),
    };
  }

  async getTrigger(triggerId: string) {
    const trigger = await this.supabaseService.findFirst<LegalTriggerRecord>(
      'legal_triggers',
      {
        id: triggerId,
      },
    );

    if (!trigger) {
      throw new NotFoundException({
        success: false,
        error_code: 'LEGAL_TRIGGER_NOT_FOUND',
        message: 'Legal trigger record was not found',
      });
    }

    return {
      success: true,
      data: this.mapTriggerResponse(trigger),
    };
  }

  async generateDemandLetter(triggerId: string) {
    const trigger = await this.supabaseService.findFirst<LegalTriggerRecord>(
      'legal_triggers',
      {
        id: triggerId,
      },
    );

    if (!trigger) {
      throw new NotFoundException({
        success: false,
        error_code: 'LEGAL_TRIGGER_NOT_FOUND',
        message: 'Legal trigger record was not found',
      });
    }

    const existingDraft = await this.supabaseService.findFirst<DemandLetterRecord>(
      'demand_letters',
      {
        legal_trigger_id: triggerId,
      },
      {
        orderBy: 'created_at',
        ascending: false,
      },
    );

    if (existingDraft) {
      return {
        success: true,
        data: this.mapDemandLetterResponse(existingDraft, trigger),
      };
    }

    const evidence = await this.supabaseService.findFirst<EvidenceRecord>(
      'evidence_records',
      {
        id: trigger.evidence_id,
      },
    );

    const anchor = trigger.anchor_id
      ? await this.supabaseService.findFirst<BlockchainAnchorRecord>(
          'blockchain_anchors',
          {
            id: trigger.anchor_id,
          },
        )
      : null;

    const certificate =
      await this.supabaseService.findFirst<NotarizationCertificateRecord>(
        'notarization_certificates',
        {
          evidence_id: trigger.evidence_id,
        },
        {
          orderBy: 'created_at',
          ascending: false,
        },
      );

    const draftText = this.buildDemandLetterDraft({
      trigger,
      evidence,
      anchor,
      certificate,
    });

    const artifacts = await this.writeDemandLetterArtifacts({
      triggerId,
      draftText,
      sellerName: trigger.seller_name,
      buyerName: trigger.buyer_name,
    });

    const inserted = await this.supabaseService.insert<DemandLetterRecord>(
      'demand_letters',
      {
        legal_trigger_id: triggerId,
        draft_text: draftText,
        export_url: artifacts.pdf.download_url,
        review_status: 'DRAFT',
        provider_payload: {
          generator: 'TradeGuardTemplateEngine',
          evidence_id: trigger.evidence_id,
          anchor_id: trigger.anchor_id,
          pdf_url: artifacts.pdf.download_url,
          pdf_storage_path: artifacts.pdf.storage_path,
          docx_url: artifacts.docx.download_url,
          docx_storage_path: artifacts.docx.storage_path,
        },
      },
    );

    if (!inserted) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'DEMAND_LETTER_CREATE_FAILED',
        message: 'Demand letter draft could not be created',
      });
    }

    await this.supabaseService.update(
      'legal_triggers',
      { id: triggerId },
      {
        demand_letter_status: 'GENERATED',
        demand_letter_url: artifacts.pdf.download_url,
      },
    );

    await this.supabaseService.insert('workflow_logs', {
      workflow_name: 'TradeGuard_Demand_Letter',
      reference_id: triggerId,
      status: 'GENERATED',
      payload: {
        legal_trigger_id: triggerId,
        demand_letter_id: inserted.id,
        review_status: inserted.review_status,
      },
    });

    return {
      success: true,
      data: this.mapDemandLetterResponse(inserted, {
        ...trigger,
        demand_letter_status: 'GENERATED',
      }),
    };
  }

  async getDemandLetterDownload(triggerId: string, format?: string) {
    const trigger = await this.supabaseService.findFirst<LegalTriggerRecord>(
      'legal_triggers',
      {
        id: triggerId,
      },
    );

    if (!trigger) {
      throw new NotFoundException({
        success: false,
        error_code: 'LEGAL_TRIGGER_NOT_FOUND',
        message: 'Legal trigger record was not found',
      });
    }

    const letter = await this.supabaseService.findFirst<DemandLetterRecord>(
      'demand_letters',
      {
        legal_trigger_id: triggerId,
      },
      {
        orderBy: 'created_at',
        ascending: false,
      },
    );

    if (!letter) {
      throw new NotFoundException({
        success: false,
        error_code: 'DEMAND_LETTER_NOT_READY',
        message: 'Demand letter was not found',
      });
    }

    const artifacts = await this.ensureDemandLetterArtifacts(trigger, letter);
    const normalizedFormat = format?.trim().toLowerCase() === 'docx' ? 'docx' : 'pdf';
    const selected = artifacts[normalizedFormat];
    const file = await this.fileStorageService.readFile(selected.storage_path);

    return {
      content: file.content,
      content_type: selected.content_type,
      file_name: selected.file_name,
    };
  }

  async generateEvidenceBundle(triggerId: string) {
    const trigger = await this.supabaseService.findFirst<LegalTriggerRecord>(
      'legal_triggers',
      {
        id: triggerId,
      },
    );

    if (!trigger) {
      throw new NotFoundException({
        success: false,
        error_code: 'LEGAL_TRIGGER_NOT_FOUND',
        message: 'Legal trigger record was not found',
      });
    }

    const existingBundle = await this.supabaseService.findFirst<EvidenceBundleRecord>(
      'evidence_bundles',
      {
        legal_trigger_id: triggerId,
      },
      {
        orderBy: 'created_at',
        ascending: false,
      },
    );

    const evidence = await this.supabaseService.findFirst<EvidenceRecord>(
      'evidence_records',
      {
        id: trigger.evidence_id,
      },
    );

    const anchor = trigger.anchor_id
      ? await this.supabaseService.findFirst<BlockchainAnchorRecord>(
          'blockchain_anchors',
          {
            id: trigger.anchor_id,
          },
        )
      : null;

    const certificate =
      await this.supabaseService.findFirst<NotarizationCertificateRecord>(
        'notarization_certificates',
        {
          evidence_id: trigger.evidence_id,
        },
        {
          orderBy: 'created_at',
          ascending: false,
        },
      );

    const letter = await this.supabaseService.findFirst<DemandLetterRecord>(
      'demand_letters',
      {
        legal_trigger_id: triggerId,
      },
      {
        orderBy: 'created_at',
        ascending: false,
      },
    );

    const manifest = this.buildEvidenceBundleManifest({
      trigger,
      evidence,
      anchor,
      certificate,
      letter,
    });
    const artifact = await this.writeEvidenceBundleArchive({
      trigger,
      manifest,
      demandLetterText: letter?.draft_text ?? null,
    });

    if (existingBundle) {
      await this.supabaseService.update(
        'evidence_bundles',
        { id: existingBundle.id },
        {
          manifest_json: manifest,
          bundle_url: artifact.download_url,
          review_status: 'GENERATED',
          provider_payload: {
            generator: 'TradeGuardBundleEngine',
            evidence_id: trigger.evidence_id,
            includes_demand_letter: Boolean(letter),
            archive_file_name: artifact.file_name,
            storage_path: artifact.storage_path,
          },
        },
      );

      await this.supabaseService.update(
        'legal_triggers',
        { id: triggerId },
        {
          bundle_status: 'GENERATED',
          bundle_url: artifact.download_url,
        },
      );

      await this.supabaseService.insert('workflow_logs', {
        workflow_name: 'TradeGuard_Evidence_Bundle',
        reference_id: triggerId,
        status: 'REGENERATED',
        payload: {
          legal_trigger_id: triggerId,
          evidence_bundle_id: existingBundle.id,
          bundle_url: artifact.download_url,
        },
      });

      return {
        success: true,
        data: this.mapEvidenceBundleResponse(
          {
            ...existingBundle,
            manifest_json: manifest,
            bundle_url: artifact.download_url,
            review_status: 'GENERATED',
          },
          {
            ...trigger,
            bundle_status: 'GENERATED',
            bundle_url: artifact.download_url,
          },
        ),
      };
    }

    const inserted = await this.supabaseService.insert<EvidenceBundleRecord>(
      'evidence_bundles',
      {
        legal_trigger_id: triggerId,
        manifest_json: manifest,
        bundle_url: artifact.download_url,
        review_status: 'GENERATED',
        provider_payload: {
          generator: 'TradeGuardBundleEngine',
          evidence_id: trigger.evidence_id,
          includes_demand_letter: Boolean(letter),
          archive_file_name: artifact.file_name,
          storage_path: artifact.storage_path,
        },
      },
    );

    if (!inserted) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'EVIDENCE_BUNDLE_CREATE_FAILED',
        message: 'Evidence bundle could not be created',
      });
    }

    await this.supabaseService.update(
      'legal_triggers',
      { id: triggerId },
      {
        bundle_status: 'GENERATED',
        bundle_url: artifact.download_url,
      },
    );

    await this.supabaseService.insert('workflow_logs', {
      workflow_name: 'TradeGuard_Evidence_Bundle',
      reference_id: triggerId,
      status: 'GENERATED',
      payload: {
        legal_trigger_id: triggerId,
        evidence_bundle_id: inserted.id,
        bundle_url: artifact.download_url,
      },
    });

    return {
      success: true,
      data: this.mapEvidenceBundleResponse(inserted, {
        ...trigger,
        bundle_status: 'GENERATED',
        bundle_url: artifact.download_url,
      }),
    };
  }

  async getEvidenceBundle(triggerId: string) {
    const trigger = await this.supabaseService.findFirst<LegalTriggerRecord>(
      'legal_triggers',
      {
        id: triggerId,
      },
    );

    if (!trigger) {
      throw new NotFoundException({
        success: false,
        error_code: 'LEGAL_TRIGGER_NOT_FOUND',
        message: 'Legal trigger record was not found',
      });
    }

    const bundle = await this.supabaseService.findFirst<EvidenceBundleRecord>(
      'evidence_bundles',
      {
        legal_trigger_id: triggerId,
      },
      {
        orderBy: 'created_at',
        ascending: false,
      },
    );

    if (!bundle) {
      throw new NotFoundException({
        success: false,
        error_code: 'BUNDLE_NOT_READY',
        message: 'Evidence bundle was not found',
      });
    }

    return {
      success: true,
      data: this.mapEvidenceBundleResponse(bundle, trigger),
    };
  }

  async getEvidenceBundleDownload(triggerId: string) {
    const bundle = await this.supabaseService.findFirst<EvidenceBundleRecord>(
      'evidence_bundles',
      {
        legal_trigger_id: triggerId,
      },
      {
        orderBy: 'created_at',
        ascending: false,
      },
    );

    if (!bundle) {
      throw new NotFoundException({
        success: false,
        error_code: 'BUNDLE_NOT_READY',
        message: 'Evidence bundle was not found',
      });
    }

    const storagePath = this.extractBundleStoragePath(bundle, triggerId);

    if (storagePath) {
      try {
        const file = await this.fileStorageService.readFile(storagePath);

        return {
          content: file.content,
          content_type: 'application/zip',
          file_name: this.buildBundleArtifact(triggerId).file_name,
        };
      } catch {
        // Fall through to legacy local path support.
      }
    }

    const artifact = this.buildBundleArtifact(triggerId);

    try {
      await access(artifact.legacy_file_path, fsConstants.R_OK);
    } catch {
      throw new NotFoundException({
        success: false,
        error_code: 'BUNDLE_FILE_NOT_FOUND',
        message: 'Evidence bundle file was not found',
      });
    }

    return {
      content: await readFile(artifact.legacy_file_path),
      content_type: artifact.content_type,
      file_name: artifact.file_name,
    };
  }

  async generateLawyerHandoff(triggerId: string) {
    const trigger = await this.supabaseService.findFirst<LegalTriggerRecord>(
      'legal_triggers',
      {
        id: triggerId,
      },
    );

    if (!trigger) {
      throw new NotFoundException({
        success: false,
        error_code: 'LEGAL_TRIGGER_NOT_FOUND',
        message: 'Legal trigger record was not found',
      });
    }

    const evidence = await this.supabaseService.findFirst<EvidenceRecord>(
      'evidence_records',
      {
        id: trigger.evidence_id,
      },
    );

    const anchor = trigger.anchor_id
      ? await this.supabaseService.findFirst<BlockchainAnchorRecord>(
          'blockchain_anchors',
          {
            id: trigger.anchor_id,
          },
        )
      : null;

    const certificate =
      await this.supabaseService.findFirst<NotarizationCertificateRecord>(
        'notarization_certificates',
        {
          evidence_id: trigger.evidence_id,
        },
        {
          orderBy: 'created_at',
          ascending: false,
        },
      );

    const letter = await this.supabaseService.findFirst<DemandLetterRecord>(
      'demand_letters',
      {
        legal_trigger_id: triggerId,
      },
      {
        orderBy: 'created_at',
        ascending: false,
      },
    );

    const bundle = await this.supabaseService.findFirst<EvidenceBundleRecord>(
      'evidence_bundles',
      {
        legal_trigger_id: triggerId,
      },
      {
        orderBy: 'created_at',
        ascending: false,
      },
    );

    if (!bundle) {
      throw new BadRequestException({
        success: false,
        error_code: 'BUNDLE_NOT_READY',
        message:
          'Evidence bundle must be generated before lawyer handoff can be prepared',
      });
    }

    const handoffPacket = this.buildLawyerHandoffPacket({
      trigger,
      evidence,
      certificate,
      anchor,
      letter,
      bundle,
    });

    await this.supabaseService.update(
      'legal_triggers',
      { id: triggerId },
      {
        handoff_status: 'READY',
        provider_payload: {
          ...(trigger.provider_payload ?? {}),
          lawyer_handoff: handoffPacket,
        },
      },
    );

    await this.supabaseService.insert('workflow_logs', {
      workflow_name: 'TradeGuard_Lawyer_Handoff',
      reference_id: triggerId,
      status: 'READY',
      payload: {
        legal_trigger_id: triggerId,
        lawyer_contact: trigger.lawyer_contact,
        bundle_url: bundle.bundle_url,
      },
    });

    return {
      success: true,
      data: {
        legal_trigger_id: trigger.id,
        evidence_id: trigger.evidence_id,
        handoff_status: 'READY',
        lawyer_contact: trigger.lawyer_contact,
        packet: handoffPacket,
      },
    };
  }

  private mapTriggerResponse(trigger: LegalTriggerRecord) {
    return {
      legal_trigger_id: trigger.id,
      evidence_id: trigger.evidence_id,
      anchor_id: trigger.anchor_id,
      seller_name: trigger.seller_name,
      seller_email: trigger.seller_email,
      buyer_name: trigger.buyer_name,
      buyer_email: trigger.buyer_email,
      amount_in_dispute: trigger.amount_in_dispute,
      currency: trigger.currency,
      breach_summary: trigger.breach_summary,
      trigger_status: trigger.trigger_status,
      demand_letter_status: trigger.demand_letter_status,
      bundle_status: trigger.bundle_status,
      handoff_status: trigger.handoff_status,
      demand_letter_url: trigger.demand_letter_url,
      bundle_url: trigger.bundle_url,
      lawyer_contact: trigger.lawyer_contact,
      created_at: trigger.created_at,
    };
  }

  private mapDemandLetterResponse(
    letter: DemandLetterRecord,
    trigger: Pick<
      LegalTriggerRecord,
      'id' | 'evidence_id' | 'demand_letter_status'
    >,
  ) {
    return {
      legal_trigger_id: trigger.id,
      evidence_id: trigger.evidence_id,
      demand_letter_id: letter.id,
      demand_letter_status: trigger.demand_letter_status,
      review_status: letter.review_status,
      draft_text: letter.draft_text,
      export_url: letter.export_url,
      pdf_url:
        typeof letter.provider_payload?.pdf_url === 'string'
          ? letter.provider_payload.pdf_url
          : letter.export_url,
      docx_url:
        typeof letter.provider_payload?.docx_url === 'string'
          ? letter.provider_payload.docx_url
          : null,
      created_at: letter.created_at,
    };
  }

  private mapEvidenceBundleResponse(
    bundle: EvidenceBundleRecord,
    trigger: Pick<
      LegalTriggerRecord,
      'id' | 'evidence_id' | 'bundle_status' | 'bundle_url'
    >,
  ) {
    return {
      legal_trigger_id: trigger.id,
      evidence_id: trigger.evidence_id,
      evidence_bundle_id: bundle.id,
      bundle_status: trigger.bundle_status,
      review_status: bundle.review_status,
      bundle_url: trigger.bundle_url,
      manifest: bundle.manifest_json,
      created_at: bundle.created_at,
    };
  }

  private async writeEvidenceBundleArchive(input: {
    trigger: LegalTriggerRecord;
    manifest: Record<string, unknown>;
    demandLetterText: string | null;
  }) {
    const artifact = this.buildBundleArtifact(input.trigger.id);
    const zip = new JSZip();

    zip.file(
      'README.txt',
      [
        'TradeGuard Evidence Bundle',
        `Legal Trigger ID: ${input.trigger.id}`,
        `Generated At: ${new Date().toISOString()}`,
      ].join('\n'),
    );
    zip.file('manifest.json', JSON.stringify(input.manifest, null, 2));

    if (input.demandLetterText) {
      zip.file('demand-letter.txt', input.demandLetterText);
    }

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9,
      },
    });

    await this.fileStorageService.ensureWritable();
    await this.fileStorageService.saveFile(artifact.storage_path, buffer, {
      contentType: artifact.content_type,
    });

    return artifact;
  }

  private async ensureDemandLetterArtifacts(
    trigger: LegalTriggerRecord,
    letter: DemandLetterRecord,
  ) {
    const existing = this.extractDemandLetterArtifacts(trigger.id, letter);
    if (existing) {
      return existing;
    }

    const artifacts = await this.writeDemandLetterArtifacts({
      triggerId: trigger.id,
      draftText: letter.draft_text,
      sellerName: trigger.seller_name,
      buyerName: trigger.buyer_name,
    });

    await this.supabaseService.update(
      'demand_letters',
      { id: letter.id },
      {
        export_url: artifacts.pdf.download_url,
        provider_payload: {
          ...(letter.provider_payload ?? {}),
          pdf_url: artifacts.pdf.download_url,
          pdf_storage_path: artifacts.pdf.storage_path,
          docx_url: artifacts.docx.download_url,
          docx_storage_path: artifacts.docx.storage_path,
        },
      },
    );

    await this.supabaseService.update(
      'legal_triggers',
      { id: trigger.id },
      {
        demand_letter_url: artifacts.pdf.download_url,
      },
    );

    return artifacts;
  }

  private extractDemandLetterArtifacts(
    triggerId: string,
    letter: DemandLetterRecord,
  ): DemandLetterArtifacts | null {
    const pdfStoragePath = letter.provider_payload?.pdf_storage_path;
    const docxStoragePath = letter.provider_payload?.docx_storage_path;
    const pdfUrl = letter.provider_payload?.pdf_url;
    const docxUrl = letter.provider_payload?.docx_url;

    if (
      typeof pdfStoragePath !== 'string' ||
      typeof docxStoragePath !== 'string' ||
      typeof pdfUrl !== 'string' ||
      typeof docxUrl !== 'string'
    ) {
      return null;
    }

    const fileNameBase = `tradeguard-demand-letter-${triggerId}`;

    return {
      pdf: {
        file_name: `${fileNameBase}.pdf`,
        storage_path: pdfStoragePath,
        download_url: pdfUrl,
        content_type: 'application/pdf',
        format: 'pdf',
      },
      docx: {
        file_name: `${fileNameBase}.docx`,
        storage_path: docxStoragePath,
        download_url: docxUrl,
        content_type:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        format: 'docx',
      },
    };
  }

  private async writeDemandLetterArtifacts(input: {
    triggerId: string;
    draftText: string;
    sellerName: string;
    buyerName: string;
  }) {
    const artifacts = this.buildDemandLetterArtifacts(input.triggerId);
    await this.fileStorageService.ensureWritable();

    const pdfBuffer = await this.renderDemandLetterPdf({
      draftText: input.draftText,
      sellerName: input.sellerName,
      buyerName: input.buyerName,
    });
    const docxBuffer = await this.renderDemandLetterDocx({
      draftText: input.draftText,
      sellerName: input.sellerName,
      buyerName: input.buyerName,
    });

    await this.fileStorageService.saveFile(artifacts.pdf.storage_path, pdfBuffer, {
      contentType: artifacts.pdf.content_type,
    });
    await this.fileStorageService.saveFile(
      artifacts.docx.storage_path,
      docxBuffer,
      {
        contentType: artifacts.docx.content_type,
      },
    );

    return artifacts;
  }

  private buildDemandLetterArtifacts(triggerId: string): DemandLetterArtifacts {
    const fileNameBase = `tradeguard-demand-letter-${triggerId}`;
    const downloadBase = `${this.getApiBaseUrl()}/v1/legal/triggers/${triggerId}/demand-letter/download`;

    return {
      pdf: {
        file_name: `${fileNameBase}.pdf`,
        storage_path: join('legal-letters', triggerId, `${fileNameBase}.pdf`),
        download_url: `${downloadBase}?format=pdf`,
        content_type: 'application/pdf',
        format: 'pdf',
      },
      docx: {
        file_name: `${fileNameBase}.docx`,
        storage_path: join('legal-letters', triggerId, `${fileNameBase}.docx`),
        download_url: `${downloadBase}?format=docx`,
        content_type:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        format: 'docx',
      },
    };
  }

  private async renderDemandLetterDocx(input: {
    draftText: string;
    sellerName: string;
    buyerName: string;
  }) {
    const sections = input.draftText
      .split('\n\n')
      .map((block) => block.trim())
      .filter(Boolean);

    const paragraphs: Paragraph[] = [
      new Paragraph({
        text: 'TradeGuard Demand Letter',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Seller: ', bold: true }),
          new TextRun(input.sellerName),
        ],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Buyer: ', bold: true }),
          new TextRun(input.buyerName),
        ],
        spacing: { after: 240 },
      }),
      ...sections.map(
        (block, index) =>
          new Paragraph({
            text: block,
            spacing: { after: index === sections.length - 1 ? 0 : 220 },
          }),
      ),
    ];

    const document = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    return Buffer.from(await Packer.toBuffer(document));
  }

  private async renderDemandLetterPdf(input: {
    draftText: string;
    sellerName: string;
    buyerName: string;
  }) {
    return await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        margin: 54,
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).font('Helvetica-Bold').text('TradeGuard Demand Letter', {
        align: 'center',
      });
      doc.moveDown();
      doc.fontSize(11).font('Helvetica-Bold').text(`Seller: `, {
        continued: true,
      });
      doc.font('Helvetica').text(input.sellerName);
      doc.font('Helvetica-Bold').text(`Buyer: `, {
        continued: true,
      });
      doc.font('Helvetica').text(input.buyerName);
      doc.moveDown();

      const sections = input.draftText
        .split('\n\n')
        .map((block) => block.trim())
        .filter(Boolean);

      for (const block of sections) {
        doc.font('Helvetica').fontSize(11).text(block, {
          align: 'left',
          lineGap: 4,
        });
        doc.moveDown();
      }

      doc.end();
    });
  }

  private buildBundleArtifact(triggerId: string): BundleArtifact {
    const fileName = `tradeguard-legal-bundle-${triggerId}.zip`;
    const storagePath = join('legal-bundles', triggerId, fileName);
    const legacyFilePath = join(
      process.cwd(),
      'generated',
      'legal-bundles',
      fileName,
    );

    return {
      storage_path: storagePath,
      legacy_file_path: legacyFilePath,
      file_name: fileName,
      download_url: `${this.getApiBaseUrl()}/v1/legal/triggers/${triggerId}/bundle/download`,
      content_type: 'application/zip',
    };
  }

  private extractBundleStoragePath(
    bundle: EvidenceBundleRecord,
    triggerId: string,
  ) {
    const storagePath = bundle.provider_payload?.storage_path;

    if (typeof storagePath === 'string' && storagePath.trim().length > 0) {
      return storagePath.trim();
    }

    return this.buildBundleArtifact(triggerId).storage_path;
  }

  private getApiBaseUrl() {
    const explicitBaseUrl = process.env.TRADEGUARD_API_BASE_URL?.trim();

    if (explicitBaseUrl) {
      return explicitBaseUrl.replace(/\/$/, '');
    }

    const port = process.env.PORT?.trim() || '3000';
    return `http://localhost:${port}`;
  }

  private buildDemandLetterDraft(input: {
    trigger: LegalTriggerRecord;
    evidence: EvidenceRecord | null;
    anchor: BlockchainAnchorRecord | null;
    certificate: NotarizationCertificateRecord | null;
  }) {
    const { trigger, evidence, anchor, certificate } = input;
    const amountLine =
      trigger.amount_in_dispute != null
        ? `${trigger.currency ?? 'USD'} ${trigger.amount_in_dispute}`
        : 'an amount to be confirmed';
    const evidenceFilename = evidence?.filename ?? 'the preserved evidence file';
    const certificateLine = certificate?.certificate_url
      ? `Notarization certificate: ${certificate.certificate_url}`
      : 'Notarization certificate is on file with TradeGuard.';
    const anchorLine = anchor?.transaction_hash
      ? `Blockchain anchor transaction: ${anchor.transaction_hash}`
      : 'Blockchain anchor reference is on file with TradeGuard.';

    return [
      `Subject: Formal Demand for Payment and Preservation of Rights`,
      ``,
      `To: ${trigger.buyer_name}`,
      `From: ${trigger.seller_name}`,
      ``,
      `This letter serves as a formal demand regarding an outstanding commercial dispute in the amount of ${amountLine}.`,
      ``,
      `Summary of breach: ${trigger.breach_summary}`,
      ``,
      `TradeGuard case references:`,
      `- Legal trigger ID: ${trigger.id}`,
      `- Evidence ID: ${trigger.evidence_id}`,
      `- Evidence file: ${evidenceFilename}`,
      `- ${certificateLine}`,
      `- ${anchorLine}`,
      ``,
      `You are hereby requested to cure the above breach, including payment of all outstanding amounts, within 7 calendar days of receipt of this letter.`,
      ``,
      `If this matter is not resolved promptly, the sender reserves all rights to escalate the dispute, including engagement of US counsel and further legal action without additional notice.`,
      ``,
      `This draft is generated by TradeGuard for intake and review purposes only and should be reviewed by qualified counsel before formal service.`,
    ].join('\n');
  }

  private buildEvidenceBundleManifest(input: {
    trigger: LegalTriggerRecord;
    evidence: EvidenceRecord | null;
    anchor: BlockchainAnchorRecord | null;
    certificate: NotarizationCertificateRecord | null;
    letter: DemandLetterRecord | null;
  }) {
    const { trigger, evidence, anchor, certificate, letter } = input;

    return {
      case_summary: {
        legal_trigger_id: trigger.id,
        seller_name: trigger.seller_name,
        buyer_name: trigger.buyer_name,
        amount_in_dispute: trigger.amount_in_dispute,
        currency: trigger.currency,
        breach_summary: trigger.breach_summary,
      },
      evidence_index: [
        evidence
          ? {
              evidence_id: evidence.id,
              filename: evidence.filename,
              file_hash: evidence.file_hash,
              company_name: evidence.company_name,
              deal_reference: evidence.deal_reference,
              created_at: evidence.created_at,
            }
          : null,
      ].filter(Boolean),
      notarization: certificate
        ? {
            status: certificate.status,
            certificate_url: certificate.certificate_url,
          }
        : null,
      blockchain_anchor: anchor
        ? {
            chain_name: anchor.chain_name,
            provider_name: anchor.provider_name,
            transaction_hash: anchor.transaction_hash,
            anchor_proof_url: anchor.anchor_proof_url,
            anchored_hash: anchor.anchored_hash,
          }
        : null,
      demand_letter: letter
        ? {
            demand_letter_id: letter.id,
            review_status: letter.review_status,
            export_url: letter.export_url,
          }
        : null,
      export_notes: {
        format: 'manifest-first',
        next_step: 'Replace placeholder bundle URL with real ZIP export in next iteration',
      },
    };
  }

  private buildLawyerHandoffPacket(input: {
    trigger: LegalTriggerRecord;
    evidence: EvidenceRecord | null;
    certificate: NotarizationCertificateRecord | null;
    anchor: BlockchainAnchorRecord | null;
    letter: DemandLetterRecord | null;
    bundle: EvidenceBundleRecord;
  }) {
    const { trigger, evidence, certificate, anchor, letter, bundle } = input;

    return {
      case_summary: {
        legal_trigger_id: trigger.id,
        seller_name: trigger.seller_name,
        seller_email: trigger.seller_email,
        buyer_name: trigger.buyer_name,
        buyer_email: trigger.buyer_email,
        amount_in_dispute: trigger.amount_in_dispute,
        currency: trigger.currency,
        breach_summary: trigger.breach_summary,
      },
      evidence_references: {
        evidence_id: trigger.evidence_id,
        filename: evidence?.filename ?? null,
        file_hash: evidence?.file_hash ?? null,
        certificate_url: certificate?.certificate_url ?? null,
        anchor_transaction_hash: anchor?.transaction_hash ?? null,
        anchor_proof_url: anchor?.anchor_proof_url ?? null,
      },
      generated_assets: {
        demand_letter_id: letter?.id ?? null,
        bundle_id: bundle.id,
        bundle_url: bundle.bundle_url,
      },
      intake: {
        lawyer_contact: trigger.lawyer_contact,
        handoff_prepared_at: new Date().toISOString(),
        next_step:
          'Review demand letter, export bundle, and forward to retained US counsel.',
      },
    };
  }
}
