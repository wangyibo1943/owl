import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreditLookupDto } from './dto/credit-lookup.dto';
import { SupabaseService } from '../database/supabase.service';

type OpenCorporatesCompany = {
  name?: string;
  company_number?: string;
  jurisdiction_code?: string;
  current_status?: string;
  incorporation_date?: string;
  opencorporates_url?: string;
  inactive?: boolean;
  branch?: boolean;
  nonprofit?: boolean;
};

@Injectable()
export class CreditService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private readonly baseUrl =
    process.env.OPENCORPORATES_BASE_URL ?? 'https://api.opencorporates.com/v0.4';

  async lookup(payload: CreditLookupDto) {
    const companyName = payload.company_name.trim();
    const apiKey = process.env.OPENCORPORATES_API_KEY;

    if (!apiKey) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'CONFIGURATION_ERROR',
        message: 'OpenCorporates API key is not configured',
      });
    }

    const company = await this.fetchTopCompanyMatch(companyName, apiKey);

    if (!company) {
      await this.logLookup({
        company_name_input: companyName,
        ein: payload.ein ?? null,
        website: payload.website ?? null,
        credit_grade: null,
        risk_flags: [],
        source_name: 'OpenCorporates',
        source_url: null,
        raw_payload: { error_code: 'COMPANY_NOT_FOUND' },
      });

      throw new NotFoundException({
        success: false,
        error_code: 'COMPANY_NOT_FOUND',
        message: 'Company was not found',
      });
    }

    const evaluation = this.evaluateRisk(company);
    const responsePayload = {
      company_name: company.name ?? companyName,
      jurisdiction: company.jurisdiction_code ?? null,
      registration_number: company.company_number ?? null,
      status: company.current_status ?? 'Unknown',
      incorporation_date: company.incorporation_date ?? null,
      credit_grade: evaluation.creditGrade,
      risk_flags: evaluation.riskFlags,
      summary: evaluation.summary,
      source_name: 'OpenCorporates',
      source_url: company.opencorporates_url ?? null,
    };

    await this.logLookup({
      company_name_input: companyName,
      company_name_matched: responsePayload.company_name,
      ein: payload.ein ?? null,
      website: payload.website ?? null,
      credit_grade: responsePayload.credit_grade,
      risk_flags: responsePayload.risk_flags,
      source_name: responsePayload.source_name,
      source_url: responsePayload.source_url,
      raw_payload: company,
    });

    return {
      success: true,
      data: responsePayload,
    };
  }

  private async fetchTopCompanyMatch(
    companyName: string,
    apiKey: string,
  ): Promise<OpenCorporatesCompany | null> {
    const searchUrl = new URL(`${this.baseUrl}/companies/search`);
    searchUrl.searchParams.set('q', companyName);
    searchUrl.searchParams.set('api_token', apiKey);

    const response = await fetch(searchUrl);

    if (!response.ok) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'UPSTREAM_PROVIDER_ERROR',
        message: `OpenCorporates returned ${response.status}`,
      });
    }

    const payload = (await response.json()) as {
      results?: {
        companies?: Array<{
          company?: OpenCorporatesCompany;
        }>;
      };
    };

    return payload.results?.companies?.[0]?.company ?? null;
  }

  private evaluateRisk(company: OpenCorporatesCompany) {
    let score = 100;
    const riskFlags: string[] = [];

    const status = (company.current_status ?? '').toLowerCase();
    const incorporationDate = company.incorporation_date
      ? new Date(company.incorporation_date)
      : null;

    if (status && status !== 'active') {
      score -= 35;
      riskFlags.push('NON_ACTIVE_STATUS');
    }

    if (company.inactive) {
      score -= 25;
      riskFlags.push('INACTIVE_ENTITY');
    }

    if (company.branch) {
      score -= 10;
      riskFlags.push('BRANCH_ENTITY');
    }

    if (!company.company_number) {
      score -= 10;
      riskFlags.push('MISSING_REGISTRATION_NUMBER');
    }

    if (incorporationDate) {
      const ageInYears =
        (Date.now() - incorporationDate.getTime()) /
        (365 * 24 * 60 * 60 * 1000);
      if (ageInYears < 1) {
        score -= 20;
        riskFlags.push('NEW_ENTITY');
      }
    } else {
      score -= 10;
      riskFlags.push('MISSING_INCORPORATION_DATE');
    }

    const creditGrade = this.mapScoreToGrade(score);
    const summary = this.buildSummary(creditGrade, riskFlags, company);

    return {
      creditGrade,
      riskFlags,
      summary,
    };
  }

  private mapScoreToGrade(score: number) {
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  }

  private buildSummary(
    creditGrade: 'A' | 'B' | 'C' | 'D',
    riskFlags: string[],
    company: OpenCorporatesCompany,
  ) {
    if (riskFlags.length === 0) {
      return `Entity appears structurally stable based on public registry data. Current grade is ${creditGrade}.`;
    }

    return `Entity grade is ${creditGrade}. Registry review found the following risk flags: ${riskFlags.join(
      ', ',
    )}. Current status is ${company.current_status ?? 'Unknown'}.`;
  }

  private async logLookup(payload: Record<string, unknown>) {
    await this.supabaseService.insert('company_lookups', payload);
  }
}
