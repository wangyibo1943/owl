import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
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

  @Post(':evidenceId/notarization-result')
  recordNotarizationResult(
    @Param('evidenceId') evidenceId: string,
    @Body() payload: RecordNotarizationResultDto,
  ) {
    return this.evidenceService.recordNotarizationResult(evidenceId, payload);
  }
}
