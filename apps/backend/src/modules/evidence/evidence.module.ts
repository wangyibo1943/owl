import { Module } from '@nestjs/common';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { AdobeSignService } from './adobe-sign.service';
import { FileStorageService } from './file-storage.service';

@Module({
  controllers: [EvidenceController],
  providers: [EvidenceService, AdobeSignService, FileStorageService],
})
export class EvidenceModule {}
