import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { EvidenceService } from './evidence.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { CreateAdobeSignNotarizationDto } from './dto/create-adobe-sign-notarization.dto';
import { RecordNotarizationResultDto } from './dto/record-notarization-result.dto';

@Controller('evidence')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post('upload')
  upload(@Body() payload: CreateEvidenceDto) {
    return this.evidenceService.create(payload);
  }

  @Get(':evidenceId/certificate')
  getCertificate(@Param('evidenceId') evidenceId: string) {
    return this.evidenceService.getCertificate(evidenceId);
  }

  @Get(':evidenceId/certificate/download')
  async downloadCertificate(
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const certificate = await this.evidenceService.downloadCertificate(
      evidenceId,
    );

    res.setHeader('Content-Type', certificate.content_type);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${certificate.file_name}"`,
    );

    return res.send(certificate.content);
  }

  @Get(':evidenceId/file/download')
  async downloadEvidenceFile(
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const file = await this.evidenceService.downloadEvidenceFile(evidenceId);

    res.setHeader('Content-Type', file.content_type);
    res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);

    return res.send(file.content);
  }

  @Post('providers/adobe-sign/notarize')
  createAdobeSignNotarization(
    @Body() payload: CreateAdobeSignNotarizationDto,
  ) {
    return this.evidenceService.createAdobeSignNotarization(payload);
  }

  @Post('providers/adobe-sign/sync-pending')
  syncPendingAdobeSignNotarizations() {
    return this.evidenceService.syncPendingAdobeSignNotarizations();
  }

  @Get('providers/adobe-sign/webhook')
  verifyAdobeSignWebhook(
    @Headers('x-adobesign-clientid') clientIdHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const echoedClientId =
      clientIdHeader?.trim() ||
      process.env.ADOBE_SIGN_WEBHOOK_CLIENT_ID?.trim() ||
      null;

    this.assertAllowedAdobeWebhookClientId(echoedClientId);

    if (echoedClientId) {
      res.setHeader('X-AdobeSign-ClientId', echoedClientId);
    }

    return {
      success: true,
      xAdobeSignClientId: echoedClientId,
    };
  }

  @Post('providers/adobe-sign/webhook')
  async handleAdobeSignWebhook(
    @Body() payload: Record<string, unknown>,
    @Headers('x-adobesign-clientid') clientIdHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const echoedClientId =
      clientIdHeader?.trim() ||
      process.env.ADOBE_SIGN_WEBHOOK_CLIENT_ID?.trim() ||
      null;

    this.assertAllowedAdobeWebhookClientId(echoedClientId);

    if (echoedClientId) {
      res.setHeader('X-AdobeSign-ClientId', echoedClientId);
    }

    return this.evidenceService.handleAdobeSignWebhook(payload, echoedClientId);
  }

  @Post(':evidenceId/providers/adobe-sign/sync')
  syncAdobeSignNotarization(@Param('evidenceId') evidenceId: string) {
    return this.evidenceService.syncAdobeSignNotarization(evidenceId);
  }

  @Post(':evidenceId/notarization-result')
  recordNotarizationResult(
    @Param('evidenceId') evidenceId: string,
    @Body() payload: RecordNotarizationResultDto,
  ) {
    return this.evidenceService.recordNotarizationResult(evidenceId, payload);
  }

  private assertAllowedAdobeWebhookClientId(clientId: string | null) {
    const configuredClientIds = [
      process.env.ADOBE_SIGN_WEBHOOK_CLIENT_ID?.trim() || null,
      ...(process.env.ADOBE_SIGN_WEBHOOK_ALLOWED_CLIENT_IDS?.split(',') ?? []),
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    if (configuredClientIds.length === 0) {
      return;
    }

    if (!clientId || !configuredClientIds.includes(clientId)) {
      throw new ForbiddenException({
        success: false,
        error_code: 'INVALID_WEBHOOK_CLIENT_ID',
        message: 'Adobe webhook client id is not allowed',
      });
    }
  }
}
