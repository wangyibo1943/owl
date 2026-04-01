import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { CreditModule } from './modules/credit/credit.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { DatabaseModule } from './modules/database/database.module';
import { AnchorModule } from './modules/anchor/anchor.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    HealthModule,
    CreditModule,
    EvidenceModule,
    AnchorModule,
  ],
})
export class AppModule {}
