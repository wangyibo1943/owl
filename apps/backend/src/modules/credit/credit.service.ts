import { Injectable } from '@nestjs/common';
import { CreditLookupDto } from './dto/credit-lookup.dto';

@Injectable()
export class CreditService {
  async lookup(payload: CreditLookupDto) {
    const companyName = payload.company_name.trim();

    return {
      success: true,
      data: {
        company_name: companyName,
        jurisdiction: 'us_ca',
        registration_number: 'TBD',
        status: 'Unknown',
        incorporation_date: null,
        credit_grade: 'B',
        risk_flags: ['MANUAL_REVIEW'],
        summary:
          'This is a placeholder response. Replace with OpenCorporates adapter and scoring engine.',
        source_name: 'Mock',
        source_url: null,
      },
    };
  }
}

