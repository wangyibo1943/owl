import { Controller, Get, Param, Post } from '@nestjs/common';
import { AnchorService } from './anchor.service';

@Controller('evidence')
export class AnchorController {
  constructor(private readonly anchorService: AnchorService) {}

  @Post(':evidenceId/anchor')
  createAnchor(@Param('evidenceId') evidenceId: string) {
    return this.anchorService.createAnchor(evidenceId);
  }

  @Get(':evidenceId/anchor')
  getAnchor(@Param('evidenceId') evidenceId: string) {
    return this.anchorService.getAnchor(evidenceId);
  }
}
