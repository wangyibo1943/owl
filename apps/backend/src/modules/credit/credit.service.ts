import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreditLookupDto } from './dto/credit-lookup.dto';
import { SupabaseService } from '../database/supabase.service';

type NormalizedCompanyRecord = {
  name: string;
  registrationNumber: string | null;
  ticker: string | null;
  entityType: string | null;
  jurisdiction: string | null;
  status: string | null;
  incorporationDate: string | null;
  lastFilingDate: string | null;
  sicCode: string | null;
  sicDescription: string | null;
  website: string | null;
  sourceName: 'California SOS' | 'SEC EDGAR';
  sourceUrl: string | null;
  agentName: string | null;
  agentAddress1: string | null;
  agentAddress2: string | null;
  agentCity: string | null;
  agentState: string | null;
  agentZipCode: string | null;
  inactive?: boolean;
  branch?: boolean;
  supportsRegistryStatus: boolean;
  supportsIncorporationDate: boolean;
  matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  rawPayload: Record<string, unknown>;
};

type RiskEvaluation = {
  creditGrade: 'A' | 'B' | 'C' | 'D';
  riskScore: number;
  riskFlags: string[];
  summary: string;
};

@Injectable()
export class CreditService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private readonly californiaBaseUrl =
    process.env.CALIFORNIA_SOS_BASE_URL ?? 'https://calico.sos.ca.gov/cbc/v1/api';

  private readonly secDataBaseUrl =
    process.env.SEC_DATA_BASE_URL ?? 'https://data.sec.gov';

  private readonly secTickersUrl =
    process.env.SEC_TICKERS_URL ?? 'https://www.sec.gov/files/company_tickers.json';

  async lookup(payload: CreditLookupDto) {
    const companyName = payload.company_name.trim();
    const companyState = payload.company_state?.trim().toUpperCase() ?? null;
    const company = await this.lookupCompany(
      companyName,
      companyState,
      payload.website ?? null,
    );

    if (!company) {
      await this.logLookup({
        company_name_input: companyName,
        ein: payload.ein ?? null,
        website: payload.website ?? null,
        credit_grade: null,
        risk_flags: [],
        source_name: this.describeProvider(companyState),
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
      company_name: company.name,
      ticker: company.ticker,
      entity_type: company.entityType,
      jurisdiction: company.jurisdiction,
      registration_number: company.registrationNumber,
      status: company.status ?? 'Unknown',
      incorporation_date: company.incorporationDate,
      last_filing_date: company.lastFilingDate,
      sic_code: company.sicCode,
      sic_description: company.sicDescription,
      website: company.website,
      credit_grade: evaluation.creditGrade,
      risk_score: evaluation.riskScore,
      risk_flags: evaluation.riskFlags,
      match_confidence: company.matchConfidence,
      summary: evaluation.summary,
      source_name: company.sourceName,
      source_url: company.sourceUrl,
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
      raw_payload: company.rawPayload,
    });

    return {
      success: true,
      data: responsePayload,
    };
  }

  private async lookupCompany(
    companyName: string,
    companyState: string | null,
    website: string | null,
  ): Promise<NormalizedCompanyRecord | null> {
    if (companyState && companyState !== 'CA') {
      throw new BadRequestException({
        success: false,
        error_code: 'UNSUPPORTED_STATE',
        message:
          'Only California state registry lookup is supported for private companies in this MVP',
      });
    }

    if (companyState === 'CA') {
      return this.lookupCaliforniaCompany(companyName);
    }

    const secMatch = await this.lookupSecCompany(companyName, website);
    if (secMatch) {
      return secMatch;
    }

    if (process.env.CALIFORNIA_SOS_API_KEY) {
      return this.lookupCaliforniaCompany(companyName);
    }

    return null;
  }

  private async lookupCaliforniaCompany(
    companyName: string,
  ): Promise<NormalizedCompanyRecord | null> {
    const apiKey = process.env.CALIFORNIA_SOS_API_KEY;

    if (!apiKey) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'CONFIGURATION_ERROR',
        message: 'California SOS API key is not configured',
      });
    }

    const searchUrl = new URL(
      `${this.californiaBaseUrl}/BusinessEntityKeywordSearch`,
    );
    searchUrl.searchParams.set('search-term', companyName);

    const response = await fetch(searchUrl, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'UPSTREAM_PROVIDER_ERROR',
        message: `California SOS returned ${response.status}`,
      });
    }

    const payload = (await response.json()) as {
      EntityData?: Array<Record<string, unknown>>;
    };

    const entities = payload.EntityData ?? [];
    const match = this.pickBestCaliforniaMatch(entities, companyName);

    if (!match) {
      return null;
    }

    const entityId = String(match.EntityID ?? '');
    const detailUrl = new URL(
      `${this.californiaBaseUrl}/BusinessEntityDetails`,
    );
    detailUrl.searchParams.set('entity-number', entityId);

    const detailResponse = await fetch(detailUrl, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        accept: 'application/json',
      },
    });

    if (!detailResponse.ok) {
      return this.mapCaliforniaEntity(match);
    }

    const detailPayload = (await detailResponse.json()) as Record<
      string,
      unknown
    >;

    return this.mapCaliforniaEntity(detailPayload);
  }

  private pickBestCaliforniaMatch(
    entities: Array<Record<string, unknown>>,
    companyName: string,
  ) {
    const normalizedTarget = this.normalizeCompanyName(companyName);

    return entities
      .map((entity) => ({
        entity,
        score: this.scoreNameMatch(
          String(entity.EntityName ?? ''),
          normalizedTarget,
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)[0]?.entity;
  }

  private mapCaliforniaEntity(
    entity: Record<string, unknown>,
  ): NormalizedCompanyRecord {
    return {
      name: String(entity.EntityName ?? 'Unknown Entity'),
      registrationNumber: entity.EntityID ? String(entity.EntityID) : null,
      ticker: null,
      entityType: entity.EntityType ? String(entity.EntityType) : null,
      jurisdiction: entity.Jurisdiction
        ? `US-${String(entity.Jurisdiction).slice(0, 2).toUpperCase()}`
        : 'US-CA',
      status: entity.StatusDescription
        ? String(entity.StatusDescription)
        : null,
      incorporationDate: entity.FilingDate
        ? String(entity.FilingDate).slice(0, 10)
        : null,
      lastFilingDate: entity.FilingDate ? String(entity.FilingDate).slice(0, 10) : null,
      sicCode: null,
      sicDescription: null,
      website: null,
      sourceName: 'California SOS',
      sourceUrl: entity.EntityID
        ? `https://bizfileonline.sos.ca.gov/search/business?filing=${encodeURIComponent(
            String(entity.EntityID),
          )}`
        : 'https://bizfileonline.sos.ca.gov/search/business',
      agentName: entity.AgentName ? String(entity.AgentName) : null,
      agentAddress1: entity.AgentAddress1 ? String(entity.AgentAddress1) : null,
      agentAddress2: entity.AgentAddress2 ? String(entity.AgentAddress2) : null,
      agentCity: entity.AgentCity ? String(entity.AgentCity) : null,
      agentState: entity.AgentState ? String(entity.AgentState) : null,
      agentZipCode: entity.AgentZipCode ? String(entity.AgentZipCode) : null,
      inactive: this.isCaliforniaInactive(entity.StatusDescription),
      branch: /foreign/i.test(String(entity.EntityType ?? '')),
      supportsRegistryStatus: true,
      supportsIncorporationDate: true,
      matchConfidence: 'HIGH',
      rawPayload: entity,
    };
  }

  private async lookupSecCompany(
    companyName: string,
    website: string | null,
  ): Promise<NormalizedCompanyRecord | null> {
    const response = await fetch(this.secTickersUrl, {
      headers: this.secHeaders(),
    });

    if (!response.ok) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'UPSTREAM_PROVIDER_ERROR',
        message: `SEC ticker index returned ${response.status}`,
      });
    }

    const payload = (await response.json()) as Record<
      string,
      {
        cik_str?: number | string;
        ticker?: string;
        title?: string;
      }
    >;

    const companies = Object.values(payload);
    const normalizedTarget = this.normalizeCompanyName(companyName);
    const candidates = companies
      .map((company) => ({
        company,
        score: this.scoreNameMatch(company.title ?? '', normalizedTarget),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

    if (candidates.length === 0) {
      return null;
    }

    const websiteHost = this.extractHostname(website);
    const enrichedCandidates = await Promise.all(
      candidates.map(async ({ company, score }) => {
        if (!company.cik_str) {
          return null;
        }

        const cik = String(company.cik_str).padStart(10, '0');
        const submissionsUrl = `${this.secDataBaseUrl}/submissions/CIK${cik}.json`;
        const submissionsResponse = await fetch(submissionsUrl, {
          headers: this.secHeaders(),
        });

        if (!submissionsResponse.ok) {
          throw new InternalServerErrorException({
            success: false,
            error_code: 'UPSTREAM_PROVIDER_ERROR',
            message: `SEC submissions returned ${submissionsResponse.status}`,
          });
        }

        const submissions = (await submissionsResponse.json()) as Record<
          string,
          unknown
        >;
        const secWebsite =
          submissions.website && String(submissions.website).trim().length > 0
            ? String(submissions.website).trim()
            : null;
        const websiteScore =
          websiteHost && secWebsite
            ? this.extractHostname(secWebsite) === websiteHost
              ? 40
              : 0
            : 0;

        return {
          company,
          cik,
          score: score + websiteScore,
          submissions,
          secWebsite,
        };
      }),
    );

    const bestCandidate = enrichedCandidates
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      )
      .sort((left, right) => right.score - left.score)[0];

    if (!bestCandidate) {
      return null;
    }

    const stateOfIncorporation =
      bestCandidate.submissions.stateOfIncorporation &&
      String(bestCandidate.submissions.stateOfIncorporation).trim().length > 0
        ? String(bestCandidate.submissions.stateOfIncorporation)
            .trim()
            .toUpperCase()
        : null;
    const lastFilingDate = this.extractLastFilingDate(bestCandidate.submissions);
    const sic =
      bestCandidate.submissions.sic &&
      String(bestCandidate.submissions.sic).trim().length > 0
        ? String(bestCandidate.submissions.sic).trim()
        : null;
    const sicDescription =
      bestCandidate.submissions.sicDescription &&
      String(bestCandidate.submissions.sicDescription).trim().length > 0
        ? String(bestCandidate.submissions.sicDescription).trim()
        : null;
    const entityType =
      bestCandidate.submissions.entityType &&
      String(bestCandidate.submissions.entityType).trim().length > 0
        ? String(bestCandidate.submissions.entityType).trim()
        : 'SEC Reporting Entity';

    return {
      name: String(
        bestCandidate.submissions.name ??
          bestCandidate.company.title ??
          companyName,
      ),
      registrationNumber: `CIK ${bestCandidate.cik}`,
      ticker: bestCandidate.company.ticker ? String(bestCandidate.company.ticker) : null,
      entityType,
      jurisdiction: stateOfIncorporation ? `US-${stateOfIncorporation}` : 'US',
      status: 'SEC Reporting Entity',
      incorporationDate: null,
      lastFilingDate,
      sicCode: sic,
      sicDescription,
      website: bestCandidate.secWebsite,
      sourceName: 'SEC EDGAR',
      sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${bestCandidate.cik}`,
      agentName: null,
      agentAddress1: null,
      agentAddress2: null,
      agentCity: null,
      agentState: null,
      agentZipCode: null,
      inactive: false,
      branch: false,
      supportsRegistryStatus: false,
      supportsIncorporationDate: false,
      matchConfidence: this.mapMatchConfidence(bestCandidate.score),
      rawPayload: bestCandidate.submissions,
    };
  }

  private evaluateRisk(company: NormalizedCompanyRecord) {
    let score = 100;
    const riskFlags: string[] = [];

    const status = (company.status ?? '').toLowerCase();
    const incorporationDate = company.incorporationDate
      ? new Date(company.incorporationDate)
      : null;

    if (
      company.supportsRegistryStatus &&
      status &&
      !this.isActiveStatus(status)
    ) {
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

    if (!company.registrationNumber) {
      score -= 10;
      riskFlags.push('MISSING_REGISTRATION_NUMBER');
    }

    if (this.hasPoBoxAgentAddress(company)) {
      score -= 15;
      riskFlags.push('PO_BOX_AGENT');
    }

    if (!company.jurisdiction || company.jurisdiction === 'US') {
      score -= 5;
      riskFlags.push('LIMITED_JURISDICTION_DATA');
    }

    if (company.sourceName === 'SEC EDGAR' && !company.website) {
      score -= 5;
      riskFlags.push('MISSING_PUBLIC_WEBSITE');
    }

    if (company.sourceName === 'SEC EDGAR' && !company.ticker) {
      score -= 5;
      riskFlags.push('MISSING_TICKER');
    }

    if (company.sourceName === 'SEC EDGAR' && !company.sicCode) {
      score -= 5;
      riskFlags.push('MISSING_INDUSTRY_CLASSIFICATION');
    }

    if (
      company.sourceName === 'California SOS' &&
      !company.agentAddress1 &&
      !company.agentCity
    ) {
      score -= 10;
      riskFlags.push('MISSING_AGENT_ADDRESS');
    }

    if (company.supportsIncorporationDate && incorporationDate) {
      const ageInYears =
        (Date.now() - incorporationDate.getTime()) /
        (365 * 24 * 60 * 60 * 1000);
      if (ageInYears < 1) {
        score -= 20;
        riskFlags.push('NEW_ENTITY');
      } else if (ageInYears >= 5) {
        score += 5;
      }
    } else if (company.supportsIncorporationDate) {
      score -= 10;
      riskFlags.push('MISSING_INCORPORATION_DATE');
    }

    if (company.matchConfidence === 'LOW') {
      score -= 15;
      riskFlags.push('LOW_MATCH_CONFIDENCE');
    } else if (company.matchConfidence === 'MEDIUM') {
      score -= 5;
      riskFlags.push('MEDIUM_MATCH_CONFIDENCE');
    }

    if (company.lastFilingDate) {
      const filingDate = new Date(company.lastFilingDate);
      const ageInDays =
        (Date.now() - filingDate.getTime()) / (24 * 60 * 60 * 1000);
      if (ageInDays > 540) {
        score -= 20;
        riskFlags.push('STALE_PUBLIC_FILINGS');
      } else if (ageInDays > 365) {
        score -= 10;
        riskFlags.push('AGING_PUBLIC_FILINGS');
      } else if (ageInDays <= 120) {
        score += 5;
      }
    }

    score = Math.max(0, Math.min(100, score));

    const creditGrade = this.mapScoreToGrade(score);
    const summary = this.buildSummary(creditGrade, riskFlags, company);

    return {
      creditGrade,
      riskScore: score,
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
    company: NormalizedCompanyRecord,
  ) {
    if (riskFlags.length === 0) {
      return `${company.sourceName} data indicates a structurally stable entity with high registry confidence. Current grade is ${creditGrade}. Latest filing visibility and registry signals look healthy.`;
    }

    return `Entity grade is ${creditGrade}. Registry review found the following risk flags: ${riskFlags.join(
      ', ',
    )}. Current status is ${company.status ?? 'Unknown'}, match confidence is ${company.matchConfidence.toLowerCase()}, and latest filing date is ${company.lastFilingDate ?? 'not available'}.`;
  }

  private describeProvider(companyState: string | null) {
    if (companyState === 'CA') return 'California SOS';
    return process.env.CALIFORNIA_SOS_API_KEY
      ? 'SEC EDGAR or California SOS'
      : 'SEC EDGAR';
  }

  private secHeaders() {
    return {
      accept: 'application/json',
      'user-agent':
        process.env.SEC_USER_AGENT ??
        'TradeGuard/0.1 (contact: founder@tradeguard.local)',
    };
  }

  private normalizeCompanyName(value: string) {
    return value
      .toUpperCase()
      .replace(/[.,'’&()/\-]/g, ' ')
      .replace(
        /\b(CORPORATION|CORP|INCORPORATED|INC|COMPANY|CO|LIMITED|LTD|LLC|L\.L\.C|LP|L\.P|PLC|HOLDINGS?)\b/g,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  private scoreNameMatch(candidate: string, normalizedTarget: string) {
    const normalizedCandidate = this.normalizeCompanyName(candidate);

    if (!normalizedCandidate) return 0;
    if (normalizedCandidate === normalizedTarget) return 100;
    if (normalizedCandidate.startsWith(normalizedTarget)) return 90;
    if (normalizedTarget.startsWith(normalizedCandidate)) return 85;
    if (normalizedCandidate.includes(normalizedTarget)) return 80;
    if (normalizedTarget.includes(normalizedCandidate)) return 75;

    const targetTokens = new Set(normalizedTarget.split(' '));
    const candidateTokens = normalizedCandidate.split(' ');
    const overlap = candidateTokens.filter((token) => targetTokens.has(token));

    return overlap.length >= Math.max(1, targetTokens.size - 1)
      ? overlap.length * 10
      : 0;
  }

  private mapMatchConfidence(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (score >= 100) return 'HIGH';
    if (score >= 80) return 'MEDIUM';
    return 'LOW';
  }

  private isCaliforniaInactive(statusDescription: unknown) {
    const status = String(statusDescription ?? '').toLowerCase();
    return (
      status.includes('suspend') ||
      status.includes('cancel') ||
      status.includes('terminate') ||
      status.includes('dissolve')
    );
  }

  private isActiveStatus(status: string) {
    return (
      status.includes('active') ||
      status.includes('good standing') ||
      status.includes('current')
    );
  }

  private hasPoBoxAgentAddress(company: NormalizedCompanyRecord) {
    const agentAddress = [
      company.agentAddress1,
      company.agentAddress2,
      company.agentCity,
      company.agentState,
      company.agentZipCode,
    ]
      .filter(Boolean)
      .join(' ')
      .toUpperCase();

    return /\bP\.?\s*O\.?\s+BOX\b/.test(agentAddress);
  }

  private extractHostname(urlValue: string | null) {
    if (!urlValue) return null;

    try {
      const normalized = /^https?:\/\//i.test(urlValue)
        ? urlValue
        : `https://${urlValue}`;
      return new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
      return null;
    }
  }

  private extractLastFilingDate(payload: Record<string, unknown>) {
    const filings = payload.filings;

    if (
      filings &&
      typeof filings === 'object' &&
      'recent' in filings &&
      filings.recent &&
      typeof filings.recent === 'object' &&
      'filingDate' in filings.recent &&
      Array.isArray(filings.recent.filingDate) &&
      filings.recent.filingDate.length > 0
    ) {
      return String(filings.recent.filingDate[0]).slice(0, 10);
    }

    return null;
  }

  private async logLookup(payload: Record<string, unknown>) {
    await this.supabaseService.insert('company_lookups', payload);
  }
}
