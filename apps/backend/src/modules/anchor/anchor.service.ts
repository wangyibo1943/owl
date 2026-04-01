import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SupabaseService } from '../database/supabase.service';

type EvidenceRecord = {
  id: string;
  file_hash: string;
  status: string;
};

type NotarizationCertificateRecord = {
  id: string;
  certificate_url: string | null;
  status: string;
  provider_name: string;
};

type BlockchainAnchorRecord = {
  id: string;
  evidence_id: string;
  chain_name: string;
  provider_name: string;
  transaction_hash: string;
  anchor_status: string;
  anchor_proof_url: string | null;
  anchored_hash: string;
  provider_payload: Record<string, unknown> | null;
  created_at: string;
};

@Injectable()
export class AnchorService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async createAnchor(evidenceId: string) {
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

    if (!certificate || certificate.status.toUpperCase() !== 'COMPLETED') {
      throw new BadRequestException({
        success: false,
        error_code: 'CERTIFICATE_NOT_READY',
        message:
          'Evidence must have a completed notarization certificate before anchoring',
      });
    }

    const existingAnchor =
      await this.supabaseService.findFirst<BlockchainAnchorRecord>(
        'blockchain_anchors',
        {
          evidence_id: evidenceId,
        },
      );

    if (existingAnchor) {
      return {
        success: true,
        data: this.mapAnchorResponse(existingAnchor),
      };
    }

    if (!this.supabaseService.isEnabled()) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'CONFIGURATION_ERROR',
        message: 'Supabase is not configured',
      });
    }

    const chainName = process.env.BLOCKCHAIN_CHAIN_NAME?.trim() || 'Base Sepolia';
    const providerName =
      process.env.BLOCKCHAIN_ANCHOR_PROVIDER?.trim() || 'MockAnchorProvider';
    const digestSource = [
      evidence.id,
      evidence.file_hash,
      certificate.id,
      certificate.certificate_url ?? '',
      chainName,
    ].join(':');
    const transactionHash = `0x${createHash('sha256')
      .update(digestSource)
      .digest('hex')}`;
    const proofBaseUrl =
      process.env.BLOCKCHAIN_PROOF_BASE_URL?.trim() ||
      'https://explorer.example/tx';

    const inserted = await this.supabaseService.insert<BlockchainAnchorRecord>(
      'blockchain_anchors',
      {
        evidence_id: evidenceId,
        chain_name: chainName,
        provider_name: providerName,
        transaction_hash: transactionHash,
        anchor_status: 'ANCHORED',
        anchor_proof_url: `${proofBaseUrl.replace(/\/$/, '')}/${transactionHash}`,
        anchored_hash: evidence.file_hash,
        provider_payload: {
          certificate_id: certificate.id,
          certificate_url: certificate.certificate_url,
          certificate_provider: certificate.provider_name,
        },
      },
    );

    if (!inserted) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'ANCHOR_PERSIST_FAILED',
        message: 'Blockchain anchor record could not be created',
      });
    }

    await this.supabaseService.insert('workflow_logs', {
      workflow_name: 'TradeGuard_Evidence_Anchor',
      reference_id: evidenceId,
      status: 'RESULT_RECORDED',
      payload: {
        chain_name: inserted.chain_name,
        transaction_hash: inserted.transaction_hash,
        anchor_status: inserted.anchor_status,
      },
    });

    return {
      success: true,
      data: this.mapAnchorResponse(inserted),
    };
  }

  async getAnchor(evidenceId: string) {
    const anchor = await this.supabaseService.findFirst<BlockchainAnchorRecord>(
      'blockchain_anchors',
      {
        evidence_id: evidenceId,
      },
    );

    if (!anchor) {
      throw new NotFoundException({
        success: false,
        error_code: 'ANCHOR_NOT_FOUND',
        message: 'Blockchain anchor was not found',
      });
    }

    return {
      success: true,
      data: this.mapAnchorResponse(anchor),
    };
  }

  private mapAnchorResponse(anchor: BlockchainAnchorRecord) {
    return {
      evidence_id: anchor.evidence_id,
      anchor_id: anchor.id,
      chain_name: anchor.chain_name,
      provider_name: anchor.provider_name,
      transaction_hash: anchor.transaction_hash,
      anchor_status: anchor.anchor_status,
      anchor_proof_url: anchor.anchor_proof_url,
      anchored_hash: anchor.anchored_hash,
      created_at: anchor.created_at,
    };
  }
}
