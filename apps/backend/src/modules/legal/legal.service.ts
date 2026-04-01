import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
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

@Injectable()
export class LegalService {
  constructor(private readonly supabaseService: SupabaseService) {}

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

    const inserted = await this.supabaseService.insert<DemandLetterRecord>(
      'demand_letters',
      {
        legal_trigger_id: triggerId,
        draft_text: draftText,
        export_url: null,
        review_status: 'DRAFT',
        provider_payload: {
          generator: 'TradeGuardTemplateEngine',
          evidence_id: trigger.evidence_id,
          anchor_id: trigger.anchor_id,
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
      created_at: letter.created_at,
    };
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
}
