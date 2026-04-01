import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FileStorageService } from '../evidence/file-storage.service';
import { LegalController } from './legal.controller';
import { LegalService } from './legal.service';

@Module({
  imports: [DatabaseModule],
  controllers: [LegalController],
  providers: [LegalService, FileStorageService],
})
export class LegalModule {}
