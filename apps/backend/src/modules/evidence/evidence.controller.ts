import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
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
}
