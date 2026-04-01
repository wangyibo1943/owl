import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AnchorController } from './anchor.controller';
import { AnchorService } from './anchor.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AnchorController],
  providers: [AnchorService],
})
export class AnchorModule {}
