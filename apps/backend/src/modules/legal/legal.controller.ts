import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
}
