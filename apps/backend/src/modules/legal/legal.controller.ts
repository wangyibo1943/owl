import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LegalService } from './legal.service';
import { CreateLegalTriggerDto } from './dto/create-legal-trigger.dto';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Post('trigger')
  createTrigger(@Body() payload: CreateLegalTriggerDto) {
    return this.legalService.createTrigger(payload);
  }

  @Get('triggers/:triggerId')
  getTrigger(@Param('triggerId') triggerId: string) {
    return this.legalService.getTrigger(triggerId);
  }

  @Post('triggers/:triggerId/demand-letter')
  generateDemandLetter(@Param('triggerId') triggerId: string) {
    return this.legalService.generateDemandLetter(triggerId);
  }

  @Get('triggers/:triggerId/demand-letter/download')
  async downloadDemandLetter(
    @Param('triggerId') triggerId: string,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const letter = await this.legalService.getDemandLetterDownload(
      triggerId,
      format,
    );

    res.setHeader('Content-Type', letter.content_type);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${letter.file_name}"`,
    );

    return res.send(letter.content);
  }

  @Post('triggers/:triggerId/bundle')
  generateEvidenceBundle(@Param('triggerId') triggerId: string) {
    return this.legalService.generateEvidenceBundle(triggerId);
  }

  @Get('triggers/:triggerId/bundle')
  getEvidenceBundle(@Param('triggerId') triggerId: string) {
    return this.legalService.getEvidenceBundle(triggerId);
  }

  @Get('triggers/:triggerId/bundle/download')
  async downloadEvidenceBundle(
    @Param('triggerId') triggerId: string,
    @Res() res: Response,
  ) {
    const bundle = await this.legalService.getEvidenceBundleDownload(triggerId);

    res.setHeader('Content-Type', bundle.content_type);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${bundle.file_name}"`,
    );

    return res.send(bundle.content);
  }

  @Post('triggers/:triggerId/handoff')
  generateLawyerHandoff(@Param('triggerId') triggerId: string) {
    return this.legalService.generateLawyerHandoff(triggerId);
  }
}
