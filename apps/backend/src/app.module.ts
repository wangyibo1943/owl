import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { CreditModule } from './modules/credit/credit.module';
import { EvidenceModule } from './modules/evidence/evidence.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    CreditModule,
    EvidenceModule,
  ],
})
export class AppModule {}

