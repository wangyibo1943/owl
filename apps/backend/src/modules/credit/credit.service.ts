import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { chromium } from 'playwright';
import { CreditLookupDto } from './dto/credit-lookup.dto';
import { SupabaseService } from '../database/supabase.service';

type NormalizedCompanyRecord = {
  name: string;
  registrationNumber: string | null;
  lei: string | null;
  ticker: string | null;
  entityType: string | null;
  jurisdiction: string | null;
  status: string | null;
  incorporationDate: string | null;
  lastFilingDate: string | null;
  sicCode: string | null;
  sicDescription: string | null;
  website: string | null;
  websiteMatch: 'VERIFIED' | 'PROBABLE' | 'MISMATCH' | 'UNKNOWN';
  websiteProvided: boolean;
  sourceName:
    | 'California SOS'
    | 'SEC EDGAR'
    | 'GLEIF'
    | 'Delaware Registry'
    | 'Texas Comptroller';
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

type IdentityCheck = {
  status: 'VERIFIED' | 'REVIEW_REQUIRED';
  source_name: string;
  source_url: string | null;
  match_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  website_match: 'VERIFIED' | 'PROBABLE' | 'MISMATCH' | 'UNKNOWN';
  risk_flags: string[];
  summary: string;
};

type SanctionsMatch = {
  name: string;
  programs: string | null;
  remarks: string | null;
  score: number;
};

type SanctionsCheck = {
  status: 'CLEAR' | 'REVIEW_REQUIRED' | 'MATCHED';
  source_name: 'OFAC SDN';
  source_url: string;
  match_count: number;
  top_matches: SanctionsMatch[];
  summary: string;
};

type LitigationCase = {
  case_name: string;
  filed_at: string | null;
  court: string | null;
  docket_url: string | null;
  score: number;
};

type LitigationCheck = {
  status: 'CLEAR' | 'ELEVATED' | 'HIGH';
  source_name: 'CourtListener';
  source_url: string;
  case_count: number;
  recent_case_count: number;
  google_state_search_url: string;
  google_federal_search_url: string;
  top_cases: LitigationCase[];
  summary: string;
};

type PublicIntelligenceResultItem = {
  title: string;
  snippet: string | null;
  link: string;
  domain: string;
  negative_signal: boolean;
};

type PublicIntelligenceCheck = {
  status: 'CLEAR' | 'SIGNS_FOUND' | 'LINK_READY';
  source_name: 'Google Search';
  source_url: string;
  configured: boolean;
  result_count: number;
  negative_hit_count: number;
  google_company_search_url: string;
  google_lawsuit_search_url: string;
  google_complaint_search_url: string;
  top_results: PublicIntelligenceResultItem[];
  summary: string;
};

type CommercialCheck = {
  status: 'LINK_READY';
  source_name: 'OpenCorporates';
  source_url: string;
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

  private sanctionsCache:
    | {
        fetchedAt: number;
        records: Array<{
          name: string;
          programs: string | null;
          remarks: string | null;
        }>;
      }
    | null = null;

  private readonly supportedPrivateRegistryStates = new Set(['CA', 'DE', 'TX']);

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

    const identityEvaluation = this.evaluateRisk(company);
    const identityCheck = this.buildIdentityCheck(company, identityEvaluation);
    const commercialCheck = this.buildCommercialCheck(companyName, companyState);
    const [sanctionsCheck, litigationCheck, publicIntelligenceCheck] =
      await Promise.all([
      this.runSanctionsCheck(company.name),
      this.runLitigationCheck(company.name, companyState),
      this.runPublicIntelligenceCheck(company.name, companyState),
    ]);
    const aggregateEvaluation = this.buildAggregateEvaluation({
      company,
      identityEvaluation,
      sanctionsCheck,
      litigationCheck,
      publicIntelligenceCheck,
    });

    const responsePayload = {
      company_name: company.name,
      lei: company.lei,
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
      website_match: company.websiteMatch,
      credit_grade: aggregateEvaluation.creditGrade,
      risk_score: aggregateEvaluation.riskScore,
      risk_flags: aggregateEvaluation.riskFlags,
      transaction_risk_grade: aggregateEvaluation.creditGrade,
      transaction_risk_score: aggregateEvaluation.riskScore,
      match_confidence: company.matchConfidence,
      summary: aggregateEvaluation.summary,
      transaction_risk_summary: aggregateEvaluation.summary,
      source_name: company.sourceName,
      source_url: company.sourceUrl,
      overall_grade: aggregateEvaluation.creditGrade,
      overall_risk_score: aggregateEvaluation.riskScore,
      identity_check: identityCheck,
      commercial_check: commercialCheck,
      public_intelligence_check: publicIntelligenceCheck,
      sanctions_check: sanctionsCheck,
      litigation_check: litigationCheck,
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
      raw_payload: {
        identity_source: company.rawPayload,
        identity_check: identityCheck,
        commercial_check: commercialCheck,
        public_intelligence_check: publicIntelligenceCheck,
        sanctions_check: sanctionsCheck,
        litigation_check: litigationCheck,
      },
    });

    return {
      success: true,
      data: responsePayload,
    };
  }

  private buildIdentityCheck(
    company: NormalizedCompanyRecord,
    evaluation: RiskEvaluation,
  ): IdentityCheck {
    return {
      status:
        company.matchConfidence === 'LOW' ? 'REVIEW_REQUIRED' : 'VERIFIED',
      source_name: company.sourceName,
      source_url: company.sourceUrl,
      match_confidence: company.matchConfidence,
      website_match: company.websiteMatch,
      risk_flags: evaluation.riskFlags,
      summary: evaluation.summary,
    };
  }

  private buildAggregateEvaluation(input: {
    company: NormalizedCompanyRecord;
    identityEvaluation: RiskEvaluation;
    sanctionsCheck: SanctionsCheck;
    litigationCheck: LitigationCheck;
    publicIntelligenceCheck: PublicIntelligenceCheck;
  }): RiskEvaluation {
    let score = input.identityEvaluation.riskScore;
    const riskFlags = [...input.identityEvaluation.riskFlags];

    if (input.sanctionsCheck.status === 'MATCHED') {
      score -= 60;
      riskFlags.push('OFAC_POTENTIAL_MATCH');
    } else if (input.sanctionsCheck.status === 'REVIEW_REQUIRED') {
      score -= 20;
      riskFlags.push('OFAC_NAME_SCREENING_REVIEW');
    }

    if (input.litigationCheck.status === 'HIGH') {
      score -= 20;
      riskFlags.push('HIGH_LITIGATION_ACTIVITY');
    } else if (input.litigationCheck.status === 'ELEVATED') {
      score -= 10;
      riskFlags.push('ELEVATED_LITIGATION_ACTIVITY');
    }

    if (input.litigationCheck.recent_case_count > 0) {
      riskFlags.push('RECENT_LITIGATION_ACTIVITY');
    }

    if (input.publicIntelligenceCheck.negative_hit_count >= 3) {
      score -= 15;
      riskFlags.push('NEGATIVE_PUBLIC_INTELLIGENCE');
    } else if (input.publicIntelligenceCheck.negative_hit_count > 0) {
      score -= 8;
      riskFlags.push('PUBLIC_RISK_SIGNALS');
    }

    score = Math.max(0, Math.min(100, score));
    const creditGrade = this.mapScoreToGrade(score);
    const summary = this.buildAggregateSummary({
      company: input.company,
      creditGrade,
      sanctionsCheck: input.sanctionsCheck,
      litigationCheck: input.litigationCheck,
      publicIntelligenceCheck: input.publicIntelligenceCheck,
      riskFlags,
    });

    return {
      creditGrade,
      riskScore: score,
      riskFlags: [...new Set(riskFlags)],
      summary,
    };
  }

  private buildAggregateSummary(input: {
    company: NormalizedCompanyRecord;
    creditGrade: 'A' | 'B' | 'C' | 'D';
    sanctionsCheck: SanctionsCheck;
    litigationCheck: LitigationCheck;
    publicIntelligenceCheck: PublicIntelligenceCheck;
    riskFlags: string[];
  }) {
    return `Transaction risk grade is ${input.creditGrade}. Identity source is ${input.company.sourceName}. Public intelligence is ${input.publicIntelligenceCheck.status.toLowerCase()} with ${input.publicIntelligenceCheck.result_count} surfaced web results and ${input.publicIntelligenceCheck.negative_hit_count} negative signals. Sanctions screen is ${input.sanctionsCheck.status.toLowerCase()} with ${input.sanctionsCheck.match_count} potential matches. Litigation screen is ${input.litigationCheck.status.toLowerCase()} with ${input.litigationCheck.case_count} relevant public cases and ${input.litigationCheck.recent_case_count} recent cases. Current flags: ${input.riskFlags.join(', ') || 'none'}.`;
  }

  private async runPublicIntelligenceCheck(
    companyName: string,
    companyState: string | null,
  ): Promise<PublicIntelligenceCheck> {
    const companySearchQuery = `"${companyName}"`;
    const lawsuitQuery = this.buildStateCourtQuery(companyName, companyState);
    const complaintQuery = `${companyName} complaint OR scam OR fraud OR unpaid OR non-payment`;
    const googleCompanySearchUrl = this.buildGoogleSearchUrl(companySearchQuery);
    const googleLawsuitSearchUrl = this.buildGoogleSearchUrl(lawsuitQuery);
    const googleComplaintSearchUrl = this.buildGoogleSearchUrl(complaintQuery);
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
      return {
        status: 'LINK_READY',
        source_name: 'Google Search',
        source_url: 'https://developers.google.com/custom-search/v1/overview',
        configured: false,
        result_count: 0,
        negative_hit_count: 0,
        google_company_search_url: googleCompanySearchUrl,
        google_lawsuit_search_url: googleLawsuitSearchUrl,
        google_complaint_search_url: googleComplaintSearchUrl,
        top_results: [],
        summary:
          'Google public-intelligence automation is not configured yet. Use the included company, complaint, and lawsuit searches for manual review.',
      };
    }

    const queryResults = await Promise.all([
      this.searchGoogleProgrammable(companySearchQuery, apiKey, searchEngineId),
      this.searchGoogleProgrammable(lawsuitQuery, apiKey, searchEngineId),
      this.searchGoogleProgrammable(complaintQuery, apiKey, searchEngineId),
    ]);

    const items = queryResults
      .flatMap((result) => result.items)
      .map((item) => {
        const text = `${item.title} ${item.snippet ?? ''}`.toLowerCase();
        return {
          ...item,
          negative_signal: this.hasNegativePublicSignal(text),
        };
      });

    const deduped = Array.from(
      new Map(items.map((item) => [item.link, item])).values(),
    ).slice(0, 6);
    const negativeHitCount = deduped.filter((item) => item.negative_signal).length;
    const status: PublicIntelligenceCheck['status'] =
      negativeHitCount > 0 ? 'SIGNS_FOUND' : 'CLEAR';

    return {
      status,
      source_name: 'Google Search',
      source_url: 'https://developers.google.com/custom-search/v1/overview',
      configured: true,
      result_count: deduped.length,
      negative_hit_count: negativeHitCount,
      google_company_search_url: googleCompanySearchUrl,
      google_lawsuit_search_url: googleLawsuitSearchUrl,
      google_complaint_search_url: googleComplaintSearchUrl,
      top_results: deduped,
      summary:
        deduped.length === 0
          ? 'No relevant public-web search results were returned from Google Programmable Search.'
          : negativeHitCount > 0
            ? `Google public-intelligence search surfaced ${deduped.length} relevant results, including ${negativeHitCount} result${negativeHitCount === 1 ? '' : 's'} with complaint, fraud, or lawsuit-style wording that should be reviewed.`
            : `Google public-intelligence search surfaced ${deduped.length} relevant results without obvious complaint or fraud wording in the top snippets.`,
    };
  }

  private async searchGoogleProgrammable(
    query: string,
    apiKey: string,
    searchEngineId: string,
  ): Promise<{ items: PublicIntelligenceResultItem[] }> {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', searchEngineId);
    url.searchParams.set('q', query);
    url.searchParams.set('num', '3');
    url.searchParams.set('safe', 'off');

    const response = await fetch(url, {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return { items: [] };
    }

    const payload = (await response.json()) as {
      items?: Array<Record<string, unknown>>;
    };

    return {
      items: (payload.items ?? [])
        .map((item) => {
          const link = String(item.link ?? '').trim();
          if (!link) return null;
          return {
            title: String(item.title ?? '').trim() || link,
            snippet:
              item.snippet && String(item.snippet).trim().length > 0
                ? String(item.snippet).trim()
                : null,
            link,
            domain: this.extractHostname(link) ?? link,
            negative_signal: false,
          };
        })
        .filter(
          (item): item is PublicIntelligenceResultItem => Boolean(item),
        ),
    };
  }

  private hasNegativePublicSignal(text: string) {
    return [
      'lawsuit',
      'complaint',
      'fraud',
      'scam',
      'ripoff',
      'breach',
      'judgment',
      'debt',
      'unpaid',
      'non-payment',
      'default',
      'collections',
    ].some((keyword) => text.includes(keyword));
  }

  private async runSanctionsCheck(companyName: string): Promise<SanctionsCheck> {
    const target = this.normalizeCompanyName(companyName);
    const records = await this.getOfacRecords();
    const matches = records
      .map((record) => ({
        name: record.name,
        programs: record.programs,
        remarks: record.remarks,
        score: Math.max(
          this.scoreNameMatch(record.name, target),
          record.remarks && this.normalizeAliasName(record.remarks).includes(this.normalizeAliasName(companyName))
            ? 88
            : 0,
        ),
      }))
      .filter((entry) => entry.score >= 80)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

    const topMatches = matches.slice(0, 3);
    const status: SanctionsCheck['status'] =
      matches.some((entry) => entry.score >= 95)
        ? 'MATCHED'
        : matches.length > 0
          ? 'REVIEW_REQUIRED'
          : 'CLEAR';

    return {
      status,
      source_name: 'OFAC SDN',
      source_url: 'https://www.treasury.gov/ofac/downloads/sdn.csv',
      match_count: matches.length,
      top_matches: topMatches,
      summary:
        status === 'CLEAR'
          ? 'No close match was found in the official OFAC SDN list.'
          : `OFAC screening found ${matches.length} potential name match${matches.length === 1 ? '' : 'es'} that should be reviewed before transaction approval.`,
    };
  }

  private async getOfacRecords() {
    if (
      this.sanctionsCache &&
      Date.now() - this.sanctionsCache.fetchedAt < 6 * 60 * 60 * 1000
    ) {
      return this.sanctionsCache.records;
    }

    const response = await fetch('https://www.treasury.gov/ofac/downloads/sdn.csv', {
      headers: {
        accept: 'text/csv',
        'user-agent':
          process.env.OFAC_USER_AGENT ??
          'TradeGuard/0.1 (contact: founder@tradeguard.local)',
      },
    });

    if (!response.ok) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'UPSTREAM_PROVIDER_ERROR',
        message: `OFAC SDN export returned ${response.status}`,
      });
    }

    const text = await response.text();
    const records = text
      .split(/\r?\n/)
      .map((line) => this.parseCsvLine(line))
      .filter((row) => row.length >= 2 && row[1]?.trim().length > 0)
      .map((row) => ({
        name: row[1]!.trim(),
        programs: row[3]?.trim() || null,
        remarks: row[row.length - 1]?.trim() || null,
      }));

    this.sanctionsCache = {
      fetchedAt: Date.now(),
      records,
    };

    return records;
  }

  private async runLitigationCheck(
    companyName: string,
    companyState: string | null,
  ): Promise<LitigationCheck> {
    const searchUrl = new URL('https://www.courtlistener.com/api/rest/v4/search/');
    searchUrl.searchParams.set('type', 'r');
    searchUrl.searchParams.set('page_size', '20');
    searchUrl.searchParams.set('q', `"${companyName}"`);

    const response = await fetch(searchUrl, {
      headers: {
        accept: 'application/json',
        'user-agent':
          process.env.COURTLISTENER_USER_AGENT ??
          'TradeGuard/0.1 (contact: founder@tradeguard.local)',
      },
    });

    if (!response.ok) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'UPSTREAM_PROVIDER_ERROR',
        message: `CourtListener returned ${response.status}`,
      });
    }

    const payload = (await response.json()) as {
      results?: Array<Record<string, unknown>>;
    };
    const normalizedTarget = this.normalizeCompanyName(companyName);
    const topCases = (payload.results ?? [])
      .map((result) => {
        const caseName = String(result.caseName ?? '');
        return {
          case_name: caseName,
          filed_at:
            result.dateFiled && String(result.dateFiled).trim().length > 0
              ? String(result.dateFiled).slice(0, 10)
              : null,
          court:
            result.court && String(result.court).trim().length > 0
              ? String(result.court).trim()
              : null,
          docket_url:
            result.absolute_url && String(result.absolute_url).trim().length > 0
              ? `https://www.courtlistener.com${String(result.absolute_url).trim()}`
              : null,
          score: this.scoreNameMatch(caseName, normalizedTarget),
        };
      })
      .filter((entry) => entry.score >= 70)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

    const recentCaseCount = topCases.filter((entry) => {
      if (!entry.filed_at) return false;
      const filedAt = new Date(entry.filed_at);
      return Date.now() - filedAt.getTime() <= 3 * 365 * 24 * 60 * 60 * 1000;
    }).length;

    const status: LitigationCheck['status'] =
      topCases.length >= 8 || recentCaseCount >= 3
        ? 'HIGH'
        : topCases.length >= 3 || recentCaseCount >= 1
          ? 'ELEVATED'
          : 'CLEAR';

    return {
      status,
      source_name: 'CourtListener',
      source_url: 'https://www.courtlistener.com/api/rest/v4/search/',
      case_count: topCases.length,
      recent_case_count: recentCaseCount,
      google_state_search_url: this.buildGoogleSearchUrl(
        this.buildStateCourtQuery(companyName, companyState),
      ),
      google_federal_search_url: this.buildGoogleSearchUrl(
        `${companyName} lawsuit federal court`,
      ),
      top_cases: topCases.slice(0, 3),
      summary:
        topCases.length === 0
          ? 'No relevant public litigation results were found in CourtListener.'
          : `CourtListener returned ${topCases.length} relevant public litigation result${topCases.length === 1 ? '' : 's'}, including ${recentCaseCount} filed within the last three years.`,
    };
  }

  private buildCommercialCheck(
    companyName: string,
    companyState: string | null,
  ): CommercialCheck {
    const searchUrl = new URL('https://opencorporates.com/companies');
    searchUrl.searchParams.set('q', companyName);
    searchUrl.searchParams.set('type', 'companies');
    if (companyState) {
      const jurisdictionCode = this.toOpenCorporatesJurisdictionCode(companyState);
      if (jurisdictionCode) {
        searchUrl.searchParams.set('jurisdiction_code', jurisdictionCode);
      }
    }

    return {
      status: 'LINK_READY',
      source_name: 'OpenCorporates',
      source_url: searchUrl.toString(),
      summary:
        'OpenCorporates commercial-credit search link is ready. The site currently uses bot protection, so this layer opens as a manual business-credit review shortcut rather than a fully automated scrape.',
    };
  }

  private parseCsvLine(line: string) {
    if (!line) return [];

    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];

      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  }

  private async lookupCompany(
    companyName: string,
    companyState: string | null,
    website: string | null,
  ): Promise<NormalizedCompanyRecord | null> {
    const websiteProvided = Boolean(website);

    if (companyState && !this.supportedPrivateRegistryStates.has(companyState)) {
      throw new BadRequestException({
        success: false,
        error_code: 'UNSUPPORTED_STATE',
        message:
          'Private-company registry lookup currently supports California, Delaware, and Texas in this MVP',
      });
    }

    if (companyState === 'CA') {
      if (process.env.CALIFORNIA_SOS_API_KEY) {
        return this.lookupCaliforniaCompany(companyName);
      }

      throw new BadRequestException({
        success: false,
        error_code: 'CALIFORNIA_SOS_PENDING',
        message:
          'California private-company lookup is waiting for official California SOS API approval',
      });
    }

    if (companyState === 'DE') {
      return this.lookupDelawareCompany(companyName);
    }

    if (companyState === 'TX') {
      return this.lookupTexasCompany(companyName);
    }

    const secMatch = await this.lookupSecCompany(companyName, website);
    if (secMatch) {
      if (this.shouldAcceptMatch(secMatch, websiteProvided)) {
        return secMatch;
      }

      const gleifMatch = await this.lookupGleifCompany(companyName);
      if (gleifMatch && this.shouldAcceptMatch(gleifMatch, websiteProvided)) {
        return this.compareMatchPriority(gleifMatch, secMatch) > 0
          ? gleifMatch
          : secMatch;
      }

      return null;
    }

    const gleifMatch = await this.lookupGleifCompany(companyName);
    if (gleifMatch && this.shouldAcceptMatch(gleifMatch, websiteProvided)) {
      return gleifMatch;
    }

    const registryMatches = (
      await Promise.all([
        this.lookupDelawareCompany(companyName),
        this.lookupTexasCompany(companyName),
        process.env.CALIFORNIA_SOS_API_KEY
          ? this.lookupCaliforniaCompany(companyName)
          : Promise.resolve(null),
      ])
    ).filter(
      (entry): entry is NormalizedCompanyRecord => Boolean(entry),
    );

    if (registryMatches.length > 0) {
      return registryMatches.sort(
        (left, right) => this.compareMatchPriority(right, left),
      )[0]!;
    }

    if (process.env.CALIFORNIA_SOS_API_KEY) {
      return this.lookupCaliforniaCompany(companyName);
    }

    return null;
  }

  private async lookupDelawareCompany(
    companyName: string,
  ): Promise<NormalizedCompanyRecord | null> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto(
        'https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx',
        { waitUntil: 'domcontentloaded', timeout: 90000 },
      );
      await page.fill('#ctl00_ContentPlaceHolder1_frmEntityName', companyName);
      await page.click('#ctl00_ContentPlaceHolder1_btnSubmit');
      await page.waitForTimeout(2500);

      const linkTexts = await page
        .locator('a')
        .evaluateAll((nodes) =>
          nodes
            .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
            .filter(Boolean),
        );

      const candidate = this.pickBestScrapedLink(linkTexts, companyName);
      if (!candidate) {
        return null;
      }

      await page.click(`text=${candidate}`);
      await page.waitForTimeout(2500);

      const text = this.normalizeWhitespace(
        (await page.textContent('body')) ?? '',
      );

      return this.mapDelawareEntity(text, companyName);
    } catch {
      return null;
    } finally {
      await page.close();
      await browser.close();
    }
  }

  private mapDelawareEntity(
    pageText: string,
    companyName: string,
  ): NormalizedCompanyRecord | null {
    const name = this.extractTextValue(pageText, 'Entity Name:', 'Entity Kind:');
    const registrationNumber = this.extractTextValue(
      pageText,
      'File Number:',
      'Incorporation Date / Formation Date:',
    );
    const incorporationDate = this.extractTextValue(
      pageText,
      'Incorporation Date / Formation Date:',
      'Entity Name:',
    )?.replace(/\(mm\/dd\/yyyy\)/i, '')
      .trim();
    const entityKind = this.extractTextValue(
      pageText,
      'Entity Kind:',
      'Entity Type:',
    );
    const entityType = this.extractTextValue(
      pageText,
      'Entity Type:',
      'Residency:',
    );
    const residency = this.extractTextValue(pageText, 'Residency:', 'State:');
    const agentName = this.extractTextValue(pageText, 'Name:', 'Address:');
    const agentAddress = this.extractTextValue(pageText, 'Address:', 'City:');
    const agentCity = this.extractTextValue(pageText, 'City:', 'County:');
    const agentState = 'DE';
    const agentZipCode = this.extractTextValue(pageText, 'Postal Code:', 'Phone:');

    if (!name || !registrationNumber) {
      return null;
    }

    return {
      name,
      registrationNumber,
      lei: null,
      ticker: null,
      entityType: [entityKind, entityType].filter(Boolean).join(' / ') || null,
      jurisdiction: 'US-DE',
      status: 'ACTIVE',
      incorporationDate: this.normalizeDateString(incorporationDate ?? null),
      lastFilingDate: null,
      sicCode: null,
      sicDescription: null,
      website: null,
      websiteMatch: 'UNKNOWN',
      websiteProvided: false,
      sourceName: 'Delaware Registry',
      sourceUrl:
        'https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx',
      agentName,
      agentAddress1: agentAddress,
      agentAddress2: null,
      agentCity,
      agentState,
      agentZipCode,
      inactive: false,
      branch: false,
      supportsRegistryStatus: false,
      supportsIncorporationDate: true,
      matchConfidence: this.mapMatchConfidence(
        this.scoreNameMatch(name, this.normalizeCompanyName(companyName)),
      ),
      rawPayload: {
        source_text: pageText,
      },
    };
  }

  private async lookupTexasCompany(
    companyName: string,
  ): Promise<NormalizedCompanyRecord | null> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto(
        'https://comptroller.texas.gov/taxes/franchise/account-status/search',
        { waitUntil: 'domcontentloaded', timeout: 90000 },
      );
      await page.fill('#name', companyName);
      await page.click('#submitBtn');
      await page.waitForTimeout(2500);

      const links = await page.locator('a').evaluateAll((nodes) =>
        nodes
          .map((node) => ({
            text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
            href: (node as HTMLAnchorElement).href,
          }))
          .filter((entry) => entry.text.length > 0 && entry.href.includes('/search/')),
      );

      const candidate = this.pickBestScrapedLink(
        links.map((entry) => entry.text),
        companyName,
      );
      const match = links.find((entry) => entry.text === candidate);

      if (!match?.href) {
        return null;
      }

      await page.goto(match.href, {
        waitUntil: 'domcontentloaded',
        timeout: 90000,
      });
      await page.waitForTimeout(2500);

      const text = this.normalizeWhitespace(
        (await page.textContent('body')) ?? '',
      );

      return this.mapTexasEntity(text, match.text, companyName, match.href);
    } catch {
      return null;
    } finally {
      await page.close();
      await browser.close();
    }
  }

  private mapTexasEntity(
    pageText: string,
    matchedName: string,
    companyName: string,
    sourceUrl: string,
  ): NormalizedCompanyRecord | null {
    const registrationNumber = this.extractTextValue(
      pageText,
      'Taxpayer Number:',
      'Mailing Address:',
    );
    const formationState = this.extractTextValue(
      pageText,
      'State of Formation:',
      'SOS Registration Status',
    );
    const status = this.extractTextValue(
      pageText,
      'SOS Registration Status(SOS status updated each business day):',
      'Effective SOS Registration Date:',
    );
    const incorporationDate = this.extractTextValue(
      pageText,
      'Effective SOS Registration Date:',
      'Texas SOS File Number:',
    );
    const texasFileNumber = this.extractTextValue(
      pageText,
      'Texas SOS File Number:',
      'Registered Agent Name:',
    );
    const agentName = this.extractTextValue(
      pageText,
      'Registered Agent Name:',
      'Registered Office Street Address:',
    );
    const agentAddress = this.extractTextValue(
      pageText,
      'Registered Office Street Address:',
      'Public Information Report',
    );

    if (!registrationNumber) {
      return null;
    }

    return {
      name: matchedName,
      registrationNumber: texasFileNumber || registrationNumber,
      lei: null,
      ticker: null,
      entityType: 'Texas Taxable Entity',
      jurisdiction: this.normalizeUsJurisdiction(formationState) ?? 'US-TX',
      status,
      incorporationDate: this.normalizeDateString(incorporationDate ?? null),
      lastFilingDate: null,
      sicCode: null,
      sicDescription: null,
      website: null,
      websiteMatch: 'UNKNOWN',
      websiteProvided: false,
      sourceName: 'Texas Comptroller',
      sourceUrl,
      agentName,
      agentAddress1: agentAddress,
      agentAddress2: null,
      agentCity: null,
      agentState: 'TX',
      agentZipCode: null,
      inactive: status ? !this.isActiveStatus(status.toLowerCase()) : false,
      branch: formationState ? formationState.toUpperCase() !== 'TX' : false,
      supportsRegistryStatus: true,
      supportsIncorporationDate: true,
      matchConfidence: this.mapMatchConfidence(
        this.scoreNameMatch(matchedName, this.normalizeCompanyName(companyName)),
      ),
      rawPayload: {
        source_text: pageText,
        taxpayer_number: registrationNumber,
      },
    };
  }

  private pickBestScrapedLink(candidates: string[], companyName: string) {
    const normalizedTarget = this.normalizeCompanyName(companyName);

    return candidates
      .map((candidate) => ({
        candidate,
        score: this.scoreNameMatch(candidate, normalizedTarget),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)[0]?.candidate;
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
      lei: null,
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
      websiteMatch: 'UNKNOWN',
      websiteProvided: false,
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

    const requestedWebsite = this.normalizeWebsite(website);
    const websiteHost = this.extractHostname(requestedWebsite);
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
        const websiteMatch = this.classifyWebsiteMatch({
          requestedWebsite,
          requestedHost: websiteHost,
          authoritativeWebsite: secWebsite,
          companyName: company.title ?? '',
          ticker:
            company.ticker && String(company.ticker).trim().length > 0
              ? String(company.ticker).trim()
              : null,
        });
        const websiteScore = this.websiteMatchScore(websiteMatch);

        return {
          company,
          cik,
          score: score + websiteScore,
          submissions,
          secWebsite,
          websiteMatch,
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
      lei: null,
      ticker: bestCandidate.company.ticker ? String(bestCandidate.company.ticker) : null,
      entityType,
      jurisdiction: stateOfIncorporation ? `US-${stateOfIncorporation}` : 'US',
      status: 'SEC Reporting Entity',
      incorporationDate: null,
      lastFilingDate,
      sicCode: sic,
      sicDescription,
      website: bestCandidate.secWebsite,
      websiteMatch: bestCandidate.websiteMatch,
      websiteProvided: Boolean(requestedWebsite),
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

  private async lookupGleifCompany(
    companyName: string,
  ): Promise<NormalizedCompanyRecord | null> {
    const fuzzyUrl = new URL('https://api.gleif.org/api/v1/fuzzycompletions');
    fuzzyUrl.searchParams.set('field', 'entity.legalName');
    fuzzyUrl.searchParams.set('q', companyName);

    const fuzzyResponse = await fetch(fuzzyUrl, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!fuzzyResponse.ok) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'UPSTREAM_PROVIDER_ERROR',
        message: `GLEIF fuzzy search returned ${fuzzyResponse.status}`,
      });
    }

    const fuzzyPayload = (await fuzzyResponse.json()) as {
      data?: Array<{
        attributes?: {
          value?: string;
        };
        relationships?: {
          'lei-records'?: {
            data?: {
              id?: string;
            };
            links?: {
              related?: string;
            };
          };
        };
      }>;
    };

    const normalizedTarget = this.normalizeCompanyName(companyName);
    const candidates = (fuzzyPayload.data ?? [])
      .map((entry) => ({
        id: entry.relationships?.['lei-records']?.data?.id ?? null,
        related: entry.relationships?.['lei-records']?.links?.related ?? null,
        score: this.scoreNameMatch(entry.attributes?.value ?? '', normalizedTarget),
      }))
      .filter((entry) => entry.id && entry.related && entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);

    for (const candidate of candidates) {
      const detailResponse = await fetch(candidate.related!, {
        headers: {
          accept: 'application/json',
        },
      });

      if (!detailResponse.ok) {
        continue;
      }

      const detailPayload = (await detailResponse.json()) as {
        data?: {
          id?: string;
          attributes?: {
            entity?: Record<string, unknown>;
            registration?: Record<string, unknown>;
          };
        };
      };

      if (!detailPayload.data?.attributes?.entity) {
        continue;
      }

      return this.mapGleifEntity(
        detailPayload.data.id ?? null,
        detailPayload.data.attributes.entity,
        detailPayload.data.attributes.registration ?? {},
        candidate.score,
      );
    }

    return null;
  }

  private mapGleifEntity(
    lei: string | null,
    entity: Record<string, unknown>,
    registration: Record<string, unknown>,
    score: number,
  ): NormalizedCompanyRecord {
    const legalAddress =
      entity.legalAddress && typeof entity.legalAddress === 'object'
        ? (entity.legalAddress as Record<string, unknown>)
        : null;
    const headquartersAddress =
      entity.headquartersAddress && typeof entity.headquartersAddress === 'object'
        ? (entity.headquartersAddress as Record<string, unknown>)
        : null;

    return {
      name:
        entity.legalName &&
        typeof entity.legalName === 'object' &&
        'name' in entity.legalName
          ? String((entity.legalName as Record<string, unknown>).name)
          : 'Unknown Entity',
      registrationNumber:
        entity.registeredAs && String(entity.registeredAs).trim().length > 0
          ? String(entity.registeredAs).trim()
          : null,
      lei,
      ticker: null,
      entityType:
        entity.category && String(entity.category).trim().length > 0
          ? String(entity.category).trim()
          : null,
      jurisdiction:
        entity.jurisdiction && String(entity.jurisdiction).trim().length > 0
          ? String(entity.jurisdiction).trim().toUpperCase()
          : null,
      status:
        entity.status && String(entity.status).trim().length > 0
          ? String(entity.status).trim()
          : null,
      incorporationDate:
        entity.creationDate && String(entity.creationDate).trim().length > 0
          ? String(entity.creationDate).slice(0, 10)
          : null,
      lastFilingDate:
        registration.lastUpdateDate &&
        String(registration.lastUpdateDate).trim().length > 0
          ? String(registration.lastUpdateDate).slice(0, 10)
          : null,
      sicCode: null,
      sicDescription:
        registration.status && String(registration.status).trim().length > 0
          ? `LEI ${String(registration.status).trim()}`
          : null,
      website: null,
      websiteMatch: 'UNKNOWN',
      websiteProvided: false,
      sourceName: 'GLEIF',
      sourceUrl: lei
        ? `https://search.gleif.org/#/record/${encodeURIComponent(lei)}`
        : null,
      agentName: null,
      agentAddress1:
        Array.isArray(legalAddress?.addressLines) && legalAddress.addressLines.length > 0
          ? String(legalAddress.addressLines[0])
          : null,
      agentAddress2:
        Array.isArray(legalAddress?.addressLines) && legalAddress.addressLines.length > 1
          ? String(legalAddress.addressLines[1])
          : null,
      agentCity:
        legalAddress?.city && String(legalAddress.city).trim().length > 0
          ? String(legalAddress.city).trim()
          : headquartersAddress?.city && String(headquartersAddress.city).trim().length > 0
            ? String(headquartersAddress.city).trim()
            : null,
      agentState:
        legalAddress?.region && String(legalAddress.region).trim().length > 0
          ? String(legalAddress.region).trim()
          : null,
      agentZipCode:
        legalAddress?.postalCode && String(legalAddress.postalCode).trim().length > 0
          ? String(legalAddress.postalCode).trim()
          : null,
      inactive: String(entity.status ?? '').trim().toUpperCase() !== 'ACTIVE',
      branch: false,
      supportsRegistryStatus: true,
      supportsIncorporationDate: true,
      matchConfidence: this.mapMatchConfidence(score),
      rawPayload: {
        entity,
        registration,
      },
    };
  }

  private evaluateRisk(company: NormalizedCompanyRecord): RiskEvaluation {
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

    if (company.supportsRegistryStatus && !status) {
      score -= 10;
      riskFlags.push('MISSING_REGISTRY_STATUS');
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

    if (company.jurisdiction && !this.isUsJurisdiction(company.jurisdiction)) {
      score -= 20;
      riskFlags.push('NON_US_JURISDICTION');
    }

    if (company.sourceName === 'SEC EDGAR' && !company.website) {
      score -= 5;
      riskFlags.push('MISSING_PUBLIC_WEBSITE');
    }

    if (company.websiteMatch === 'MISMATCH') {
      score -= 25;
      riskFlags.push('WEBSITE_MISMATCH');
    }

    if (company.websiteProvided && company.websiteMatch === 'UNKNOWN') {
      score -= 5;
      riskFlags.push('INPUT_WEBSITE_NOT_VERIFIED');
    }

    if (company.sourceName === 'GLEIF' && !company.lei) {
      score -= 10;
      riskFlags.push('MISSING_LEI');
    }

    if (company.sourceName === 'SEC EDGAR' && !company.ticker) {
      score -= 5;
      riskFlags.push('MISSING_TICKER');
    }

    if (company.sourceName === 'SEC EDGAR' && !company.sicCode) {
      score -= 5;
      riskFlags.push('MISSING_INDUSTRY_CLASSIFICATION');
    }

    if (company.sourceName === 'SEC EDGAR' && !company.lastFilingDate) {
      score -= 15;
      riskFlags.push('MISSING_PUBLIC_FILING_HISTORY');
    }

    if (company.sourceName === 'GLEIF' && !company.registrationNumber) {
      score -= 10;
      riskFlags.push('MISSING_LOCAL_REGISTRY_NUMBER');
    }

    if (company.sourceName === 'GLEIF' && !company.lastFilingDate) {
      score -= 5;
      riskFlags.push('MISSING_REGISTRATION_REFRESH_DATE');
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

    if (
      company.sourceName === 'SEC EDGAR' &&
      company.website &&
      company.ticker &&
      company.sicCode &&
      company.matchConfidence === 'HIGH'
    ) {
      score += 5;
    }

    if (company.websiteMatch === 'VERIFIED') {
      score += 5;
    } else if (company.websiteMatch === 'PROBABLE') {
      score += 2;
    }

    if (
      company.sourceName === 'California SOS' &&
      company.supportsRegistryStatus &&
      status &&
      this.isActiveStatus(status)
    ) {
      score += 5;
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

  private mapScoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' {
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
      return `${company.sourceName} data indicates a structurally stable entity with high registry confidence. Current transaction risk grade is ${creditGrade}. Latest filing visibility and registry signals look healthy.`;
    }

    return `Transaction risk grade is ${creditGrade}. Source is ${company.sourceName}. Registry review found the following risk flags: ${riskFlags.join(
      ', ',
    )}. Current status is ${company.status ?? 'Unknown'}, jurisdiction is ${company.jurisdiction ?? 'not available'}, website match is ${company.websiteMatch.toLowerCase()}, match confidence is ${company.matchConfidence.toLowerCase()}, and latest filing date is ${company.lastFilingDate ?? 'not available'}.`;
  }

  private describeProvider(companyState: string | null) {
    if (companyState === 'CA') return 'California SOS';
    if (companyState === 'DE') return 'Delaware Registry';
    if (companyState === 'TX') return 'Texas Comptroller';
    return process.env.CALIFORNIA_SOS_API_KEY
      ? 'SEC EDGAR, GLEIF, Delaware Registry, Texas Comptroller, or California SOS'
      : 'SEC EDGAR, GLEIF, Delaware Registry, or Texas Comptroller';
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
        /\b(CORPORATION|CORP|INCORPORATED|INC|COMPANY|CO|LIMITED|LTD|LLC|L\.L\.C|LP|L\.P|PLC|HOLDINGS?|GROUP|GLOBAL|INTERNATIONAL|TECHNOLOGIES|TECHNOLOGY|SOLUTIONS|SYSTEMS|SERVICES)\b/g,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  private scoreNameMatch(candidate: string, normalizedTarget: string) {
    const normalizedCandidate = this.normalizeCompanyName(candidate);
    const normalizedCandidateAlias = this.normalizeAliasName(candidate);
    const normalizedTargetAlias = this.normalizeAliasName(normalizedTarget);
    const targetTokens = this.tokenizeName(normalizedTarget);
    const candidateTokens = this.tokenizeName(normalizedCandidate);
    const overlap = [...candidateTokens].filter((token) => targetTokens.has(token));
    const shorterTokenCount = Math.min(targetTokens.size, candidateTokens.size);

    if (!normalizedCandidate) return 0;
    if (normalizedCandidate === normalizedTarget) return 100;
    if (
      normalizedCandidateAlias &&
      normalizedTargetAlias &&
      normalizedCandidateAlias === normalizedTargetAlias
    ) {
      return 98;
    }

    if (
      shorterTokenCount >= 2 &&
      normalizedCandidate.length >= 6 &&
      normalizedTarget.length >= 6
    ) {
      if (normalizedCandidate.startsWith(normalizedTarget)) return 90;
      if (normalizedTarget.startsWith(normalizedCandidate)) return 85;
      if (normalizedCandidate.includes(normalizedTarget)) return 80;
      if (normalizedTarget.includes(normalizedCandidate)) return 75;
    }

    if (
      targetTokens.size > 0 &&
      candidateTokens.size > 0 &&
      overlap.length === targetTokens.size &&
      targetTokens.size === candidateTokens.size
    ) {
      return 92;
    }

    if (overlap.length >= 2) {
      return 70 + overlap.length * 5;
    }

    return overlap.length >= Math.max(1, targetTokens.size - 1)
      ? overlap.length * 10
      : 0;
  }

  private mapMatchConfidence(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (score >= 100) return 'HIGH';
    if (score >= 80) return 'MEDIUM';
    return 'LOW';
  }

  private shouldAcceptMatch(
    company: NormalizedCompanyRecord,
    websiteProvided: boolean,
  ) {
    if (company.matchConfidence === 'HIGH') {
      return true;
    }

    if (
      websiteProvided &&
      company.sourceName === 'SEC EDGAR' &&
      company.matchConfidence !== 'LOW' &&
      (company.websiteMatch === 'VERIFIED' || company.websiteMatch === 'PROBABLE')
    ) {
      return true;
    }

    return false;
  }

  private compareMatchPriority(
    left: NormalizedCompanyRecord,
    right: NormalizedCompanyRecord,
  ) {
    return this.matchPriority(left) - this.matchPriority(right);
  }

  private matchPriority(company: NormalizedCompanyRecord) {
    const confidenceWeight =
      company.matchConfidence === 'HIGH'
        ? 300
        : company.matchConfidence === 'MEDIUM'
          ? 200
          : 100;
    const websiteWeight =
      company.websiteMatch === 'VERIFIED'
        ? 30
        : company.websiteMatch === 'PROBABLE'
          ? 20
          : company.websiteMatch === 'UNKNOWN'
            ? 10
            : 0;
    const sourceWeight =
      company.sourceName === 'SEC EDGAR'
        ? 30
        : company.sourceName === 'California SOS'
          ? 20
          : 10;

    return confidenceWeight + websiteWeight + sourceWeight;
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

  private isUsJurisdiction(jurisdiction: string) {
    return jurisdiction.trim().toUpperCase().startsWith('US');
  }

  private normalizeUsJurisdiction(value: string | null) {
    if (!value) return null;

    const normalized = value.trim().toUpperCase();
    if (!normalized) return null;

    const directCode = normalized.match(/\b([A-Z]{2})\b/);
    if (directCode) {
      return `US-${directCode[1]}`;
    }

    const stateMap: Record<string, string> = {
      ALABAMA: 'AL',
      ALASKA: 'AK',
      ARIZONA: 'AZ',
      ARKANSAS: 'AR',
      CALIFORNIA: 'CA',
      COLORADO: 'CO',
      CONNECTICUT: 'CT',
      DELAWARE: 'DE',
      FLORIDA: 'FL',
      GEORGIA: 'GA',
      HAWAII: 'HI',
      IDAHO: 'ID',
      ILLINOIS: 'IL',
      INDIANA: 'IN',
      IOWA: 'IA',
      KANSAS: 'KS',
      KENTUCKY: 'KY',
      LOUISIANA: 'LA',
      MAINE: 'ME',
      MARYLAND: 'MD',
      MASSACHUSETTS: 'MA',
      MICHIGAN: 'MI',
      MINNESOTA: 'MN',
      MISSISSIPPI: 'MS',
      MISSOURI: 'MO',
      MONTANA: 'MT',
      NEBRASKA: 'NE',
      NEVADA: 'NV',
      'NEW HAMPSHIRE': 'NH',
      'NEW JERSEY': 'NJ',
      'NEW MEXICO': 'NM',
      'NEW YORK': 'NY',
      'NORTH CAROLINA': 'NC',
      'NORTH DAKOTA': 'ND',
      OHIO: 'OH',
      OKLAHOMA: 'OK',
      OREGON: 'OR',
      PENNSYLVANIA: 'PA',
      'RHODE ISLAND': 'RI',
      'SOUTH CAROLINA': 'SC',
      'SOUTH DAKOTA': 'SD',
      TENNESSEE: 'TN',
      TEXAS: 'TX',
      UTAH: 'UT',
      VERMONT: 'VT',
      VIRGINIA: 'VA',
      WASHINGTON: 'WA',
      'WEST VIRGINIA': 'WV',
      WISCONSIN: 'WI',
      WYOMING: 'WY',
      'DISTRICT OF COLUMBIA': 'DC',
    };

    for (const [stateName, stateCode] of Object.entries(stateMap)) {
      if (normalized.includes(stateName)) {
        return `US-${stateCode}`;
      }
    }

    return null;
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

  private buildGoogleSearchUrl(query: string) {
    const url = new URL('https://www.google.com/search');
    url.searchParams.set('q', query);
    return url.toString();
  }

  private stateSearchTerm(companyState: string | null) {
    if (!companyState) return 'state';

    const stateMap: Record<string, string> = {
      CA: 'california',
      DE: 'delaware',
      TX: 'texas',
      NY: 'new york',
      FL: 'florida',
    };

    return stateMap[companyState] ?? 'state';
  }

  private buildStateCourtQuery(companyName: string, companyState: string | null) {
    const stateTerm = this.stateSearchTerm(companyState);
    if (stateTerm === 'state') {
      return `${companyName} lawsuit state court`;
    }

    return `${companyName} lawsuit ${stateTerm} state court`;
  }

  private toOpenCorporatesJurisdictionCode(companyState: string) {
    const jurisdictionMap: Record<string, string> = {
      CA: 'us_ca',
      DE: 'us_de',
      TX: 'us_tx',
      NY: 'us_ny',
      FL: 'us_fl',
    };

    return jurisdictionMap[companyState] ?? '';
  }

  private normalizeWebsite(urlValue: string | null) {
    if (!urlValue) return null;

    try {
      const normalized = /^https?:\/\//i.test(urlValue)
        ? urlValue
        : `https://${urlValue}`;
      const url = new URL(normalized);
      return `${url.protocol}//${url.hostname}${url.pathname === '/' ? '' : url.pathname}`;
    } catch {
      return null;
    }
  }

  private normalizeWhitespace(value: string) {
    return value.replace(/\s+/g, ' ').trim();
  }

  private extractTextValue(
    text: string,
    startLabel: string,
    endLabel: string,
  ) {
    const startIndex = text.indexOf(startLabel);
    if (startIndex < 0) return null;

    const start = startIndex + startLabel.length;
    const nextIndex = text.indexOf(endLabel, start);
    const raw = (nextIndex >= 0 ? text.slice(start, nextIndex) : text.slice(start))
      .replace(/\s+/g, ' ')
      .trim();

    return raw.length > 0 ? raw : null;
  }

  private normalizeDateString(value: string | null) {
    if (!value) return null;

    const cleaned = value.replace(/\(.*?\)/g, '').trim();
    const parsed = new Date(cleaned);

    if (Number.isNaN(parsed.getTime())) {
      return cleaned || null;
    }

    return parsed.toISOString().slice(0, 10);
  }

  private classifyWebsiteMatch(input: {
    requestedWebsite: string | null;
    requestedHost: string | null;
    authoritativeWebsite: string | null;
    companyName: string;
    ticker: string | null;
  }): 'VERIFIED' | 'PROBABLE' | 'MISMATCH' | 'UNKNOWN' {
    const authoritativeHost = this.extractHostname(input.authoritativeWebsite);

    if (!input.requestedHost) {
      return authoritativeHost ? 'UNKNOWN' : 'UNKNOWN';
    }

    if (authoritativeHost) {
      return this.extractDomainRoot(authoritativeHost) ===
          this.extractDomainRoot(input.requestedHost)
        ? 'VERIFIED'
        : 'MISMATCH';
    }

    return this.domainMatchesEntity(
      input.requestedHost,
      input.companyName,
      input.ticker,
    )
      ? 'PROBABLE'
      : 'UNKNOWN';
  }

  private websiteMatchScore(
    websiteMatch: 'VERIFIED' | 'PROBABLE' | 'MISMATCH' | 'UNKNOWN',
  ) {
    switch (websiteMatch) {
      case 'VERIFIED':
        return 40;
      case 'PROBABLE':
        return 15;
      case 'MISMATCH':
        return -20;
      default:
        return 0;
    }
  }

  private domainMatchesEntity(
    hostname: string,
    companyName: string,
    ticker: string | null,
  ) {
    const root = this.extractDomainRoot(hostname);
    const normalizedName = this.normalizeCompanyName(companyName);
    const aliasName = this.normalizeAliasName(companyName);
    const tokens = [...this.tokenizeName(normalizedName)];

    if (ticker && root === ticker.trim().toLowerCase()) {
      return true;
    }

    if (aliasName && root.includes(aliasName.toLowerCase())) {
      return true;
    }

    if (tokens.length === 0) {
      return false;
    }

    const strongTokens = tokens.filter((token) => token.length >= 4);
    if (strongTokens.some((token) => root.includes(token.toLowerCase()))) {
      return true;
    }

    return tokens
      .filter((token) => token.length >= 3)
      .slice(0, 2)
      .some((token) => root.includes(token.toLowerCase()));
  }

  private normalizeAliasName(value: string) {
    return this.normalizeCompanyName(value).replace(/\s+/g, '');
  }

  private tokenizeName(value: string) {
    return value
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
      .reduce((set, token) => set.add(token), new Set<string>());
  }

  private extractDomainRoot(hostname: string) {
    const parts = hostname.toLowerCase().split('.').filter(Boolean);

    if (parts.length <= 2) {
      return parts[0] ?? hostname.toLowerCase();
    }

    return parts[parts.length - 2] ?? hostname.toLowerCase();
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
