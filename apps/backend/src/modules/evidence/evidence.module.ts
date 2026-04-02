import { Module } from '@nestjs/common';
import { AnchorModule } from '../anchor/anchor.module';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { AdobeSignService } from './adobe-sign.service';
import { FileStorageService } from './file-storage.service';

@Module({
  imports: [AnchorModule],
  controllers: [EvidenceController],
  providers: [EvidenceService, AdobeSignService, FileStorageService],
})
export class EvidenceModule {}
