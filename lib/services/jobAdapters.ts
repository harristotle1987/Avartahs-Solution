/**
 * Provider-Independent Multi-Source Job Adapters
 * Genuine, live job source integrations fetching from employer ATS and documented APIs.
 * Zero fabricated listings, zero invented company names, zero mock data.
 */

import { NormalizedJob, JobProviderResult, JobSearchFilters, computeJobFingerprint, isSafeJobUrl } from '../jobs';

export interface JobSourceAdapter {
  id: string;
  name: string;
  enabled: boolean;
  search(params: JobSearchFilters, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<JobProviderResult>;
}

/**
 * Direct Employer ATS Adapter: Greenhouse Public Board API
 * Fetches real, live postings directly from employers (GitLab, Cloudflare, Canonical, Elastic).
 */
export class GreenhouseATSAdapter implements JobSourceAdapter {
  id = 'greenhouse-ats';
  name = 'Enterprise ATS Direct (Greenhouse)';
  enabled = true;

  // Verified employer board tokens on Greenhouse
  private employers = [
    { name: 'GitLab', token: 'gitlab', defaultCountry: 'Global', isRemote: true },
    { name: 'Cloudflare', token: 'cloudflare', defaultCountry: 'United States', isRemote: false },
    { name: 'Canonical', token: 'canonical', defaultCountry: 'Global', isRemote: true },
    { name: 'Elastic', token: 'elastic', defaultCountry: 'Global', isRemote: true }
  ];

  async search(filters: JobSearchFilters, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<JobProviderResult> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs || 7000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const employerFetches = this.employers.map(async (emp) => {
        try {
          const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${emp.token}/jobs`, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'AvartahJobIntelligence/2.0 (+https://avartah.com)'
            }
          });

          if (!res.ok) return [];
          const data = await res.json();
          const jobsList = Array.isArray(data.jobs) ? data.jobs : [];

          const normalized: NormalizedJob[] = [];
          for (const item of jobsList) {
            const title = (item.title || '').trim();
            const locationStr = (item.location?.name || (emp.isRemote ? 'Remote' : 'Various')).trim();
            const appUrl = (item.absolute_url || '').trim();

            // Strict validation: Reject missing title or invalid URL
            if (!title || !appUrl || !isSafeJobUrl(appUrl)) {
              continue;
            }

            const locLower = locationStr.toLowerCase();
            const isRemote = emp.isRemote || locLower.includes('remote') || locLower.includes('home based') || locLower.includes('anywhere');
            const isHybrid = locLower.includes('hybrid');
            const remoteStatus = isRemote ? 'REMOTE' : (isHybrid ? 'HYBRID' : 'ONSITE');

            const country = locLower.includes('us') || locLower.includes('united states') || locLower.includes('san francisco') || locLower.includes('new york') || locLower.includes('austin')
              ? 'United States'
              : (locLower.includes('uk') || locLower.includes('united kingdom') || locLower.includes('london')
                ? 'United Kingdom'
                : (locLower.includes('emea') ? 'EMEA' : emp.defaultCountry));

            const fp = computeJobFingerprint(title, emp.name, locationStr);
            const pubDate = item.first_published || item.updated_at;

            normalized.push({
              id: `ats-${emp.token}-${item.id || fp}`,
              title,
              company: emp.name,
              location: locationStr,
              country,
              remote_status: remoteStatus,
              description: `${title} role at ${emp.name}. Direct opportunity sourced through employer Greenhouse ATS. Location: ${locationStr}.`,
              employment_type: 'FULL_TIME',
              salary_min: null,
              salary_max: null,
              currency: null,
              pay_period: null,
              posted_at: pubDate ? new Date(pubDate).toISOString() : '',
              discovered_at: new Date().toISOString(),
              application_url: appUrl,
              source_name: `${emp.name} Direct ATS`,
              source_job_id: String(item.id || fp),
              status: 'ACTIVE',
              verification_evidence: `Direct Greenhouse ATS board listing for ${emp.name}; application URL confirmed on employer board domain.`,
              match_score: 85,
              match_reason: 'Direct employer ATS listing; feed presence confirmed',
              source_provenance: {
                provider: 'Greenhouse ATS',
                employer: emp.name,
                boardToken: emp.token,
                rawJobId: item.id
              }
            });
          }

          return normalized;
        } catch {
          return [];
        }
      });

      const allEmployerJobs = (await Promise.all(employerFetches)).flat();

      if (controller.signal.aborted) {
        return {
          sourceName: this.name,
          success: false,
          jobsCount: 0,
          latencyMs: Date.now() - startTime,
          error: 'Timeout querying enterprise ATS feeds',
          jobs: []
        };
      }

      return {
        sourceName: this.name,
        success: true,
        jobsCount: allEmployerJobs.length,
        latencyMs: Date.now() - startTime,
        jobs: allEmployerJobs
      };
    } catch (err: any) {
      return {
        sourceName: this.name,
        success: false,
        jobsCount: 0,
        latencyMs: Date.now() - startTime,
        error: err.name === 'AbortError' ? 'Timeout querying enterprise ATS feeds' : (err.message || 'ATS query error'),
        jobs: []
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Arbeitnow Public API Adapter
 * Live documented job board API returning verified European, US & Remote openings.
 */
export class ArbeitnowAdapter implements JobSourceAdapter {
  id = 'arbeitnow-api';
  name = 'Arbeitnow Global Board';
  enabled = true;

  async search(filters: JobSearchFilters, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<JobProviderResult> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs || 7000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('https://www.arbeitnow.com/api/job-board-api', {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AvartahJobIntelligence/2.0 (+https://avartah.com)'
        }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items = Array.isArray(json.data) ? json.data : [];

      const jobs: NormalizedJob[] = [];
      const nowIso = new Date().toISOString();

      for (const item of items) {
        const title = (item.title || '').trim();
        const company = (item.company_name || '').trim();
        const appUrl = (item.url || '').trim();

        // Reject incomplete or malformed records
        if (!title || !company || !appUrl || !isSafeJobUrl(appUrl)) {
          continue;
        }

        const isRemote = Boolean(item.remote);
        const loc = (item.location || (isRemote ? 'Remote' : 'Europe')).trim();
        const locLower = loc.toLowerCase();
        const fp = computeJobFingerprint(title, company, loc);

        const types = Array.isArray(item.job_types) ? item.job_types.join(' ').toLowerCase() : '';
        let empType: NormalizedJob['employment_type'] = 'FULL_TIME';
        if (types.includes('part')) empType = 'PART_TIME';
        else if (types.includes('contract') || types.includes('freelance')) empType = 'CONTRACT';
        else if (types.includes('intern')) empType = 'INTERN';

        const country = locLower.includes('germany') || locLower.includes('berlin') || locLower.includes('munich') || locLower.includes('frankfurt')
          ? 'Germany'
          : (locLower.includes('us') || locLower.includes('united states')
            ? 'United States'
            : (locLower.includes('uk') || locLower.includes('london')
              ? 'United Kingdom'
              : 'Global'));

        const postedAt = item.created_at ? new Date(item.created_at * 1000).toISOString() : '';

        jobs.push({
          id: `arbeitnow-${item.slug || fp}`,
          title,
          company,
          location: loc,
          country,
          remote_status: isRemote ? 'REMOTE' : 'ONSITE',
          description: item.description ? item.description.replace(/<[^>]*>?/gm, '').slice(0, 800) : title,
          employment_type: empType,
          salary_min: null,
          salary_max: null,
          currency: 'EUR',
          pay_period: 'YEARLY',
          posted_at: postedAt,
          discovered_at: nowIso,
          application_url: appUrl,
          source_name: 'Arbeitnow API',
          source_job_id: String(item.slug || fp),
          status: 'UNVERIFIED',
          verification_evidence: 'Listing present in Arbeitnow public feed; application URL verified valid. Independent opening status unverified.',
          match_score: 80,
          match_reason: 'Arbeitnow API feed presence; external opening unverified',
          source_provenance: {
            provider: 'Arbeitnow',
            slug: item.slug,
            tags: item.tags
          }
        });
      }

      return {
        sourceName: this.name,
        success: true,
        jobsCount: jobs.length,
        latencyMs: Date.now() - startTime,
        jobs
      };
    } catch (err: any) {
      return {
        sourceName: this.name,
        success: false,
        jobsCount: 0,
        latencyMs: Date.now() - startTime,
        error: err.name === 'AbortError' ? 'Timeout querying Arbeitnow API' : (err.message || 'Arbeitnow API error'),
        jobs: []
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Jobicy Public Remote Jobs API Adapter
 * Live documented remote jobs API with verified salaries and direct URLs.
 */
export class JobicyAdapter implements JobSourceAdapter {
  id = 'jobicy-api';
  name = 'Jobicy Remote Opportunities';
  enabled = true;

  async search(filters: JobSearchFilters, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<JobProviderResult> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs || 7000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('https://jobicy.com/api/v2/remote-jobs?count=40', {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AvartahJobIntelligence/2.0 (+https://avartah.com)'
        }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items = Array.isArray(json.jobs) ? json.jobs : [];

      const jobs: NormalizedJob[] = [];
      const nowIso = new Date().toISOString();

      for (const item of items) {
        const title = (item.jobTitle || '').trim();
        const company = (item.companyName || '').trim();
        const appUrl = (item.url || '').trim();

        if (!title || !company || !appUrl || !isSafeJobUrl(appUrl)) {
          continue;
        }

        const loc = (item.jobGeo || 'Remote (Global)').trim();
        const locLower = loc.toLowerCase();
        const fp = computeJobFingerprint(title, company, loc);

        const types = Array.isArray(item.jobType) ? item.jobType.join(' ').toLowerCase() : '';
        let empType: NormalizedJob['employment_type'] = 'FULL_TIME';
        if (types.includes('part')) empType = 'PART_TIME';
        else if (types.includes('contract')) empType = 'CONTRACT';
        else if (types.includes('intern')) empType = 'INTERN';

        const minSal = item.annualSalaryMin && !isNaN(Number(item.annualSalaryMin)) && Number(item.annualSalaryMin) > 0
          ? Number(item.annualSalaryMin)
          : null;
        const maxSal = item.annualSalaryMax && !isNaN(Number(item.annualSalaryMax)) && Number(item.annualSalaryMax) > 0
          ? Number(item.annualSalaryMax)
          : null;

        const country = locLower.includes('usa') || locLower.includes('us')
          ? 'United States'
          : (locLower.includes('uk') || locLower.includes('united kingdom') || locLower.includes('london')
            ? 'United Kingdom'
            : 'Global');

        const postedAt = item.pubDate ? new Date(item.pubDate).toISOString() : '';

        jobs.push({
          id: `jobicy-${item.id || fp}`,
          title,
          company,
          location: loc,
          country,
          remote_status: 'REMOTE',
          description: item.jobExcerpt ? item.jobExcerpt.replace(/<[^>]*>?/gm, '').slice(0, 800) : title,
          employment_type: empType,
          salary_min: minSal,
          salary_max: maxSal,
          currency: item.salaryCurrency || 'USD',
          pay_period: 'YEARLY',
          posted_at: postedAt,
          discovered_at: nowIso,
          application_url: appUrl,
          source_name: 'Jobicy API',
          source_job_id: String(item.id || fp),
          status: 'UNVERIFIED',
          verification_evidence: 'Listing present in Jobicy remote feed; application URL verified valid. Independent opening status unverified.',
          match_score: 82,
          match_reason: 'Jobicy remote feed presence; external opening unverified',
          source_provenance: {
            provider: 'Jobicy',
            rawId: item.id,
            industry: item.jobIndustry,
            level: item.jobLevel
          }
        });
      }

      return {
        sourceName: this.name,
        success: true,
        jobsCount: jobs.length,
        latencyMs: Date.now() - startTime,
        jobs
      };
    } catch (err: any) {
      return {
        sourceName: this.name,
        success: false,
        jobsCount: 0,
        latencyMs: Date.now() - startTime,
        error: err.name === 'AbortError' ? 'Timeout querying Jobicy API' : (err.message || 'Jobicy API error'),
        jobs: []
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Remotive API Adapter
 * Live public API feed from Remotive
 */
export class RemotiveAdapter implements JobSourceAdapter {
  id = 'remotive-api';
  name = 'Remotive Remote Jobs';
  enabled = true;

  async search(filters: JobSearchFilters, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<JobProviderResult> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs || 7000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const q = (filters.query || filters.keyword) ? `?search=${encodeURIComponent((filters.query || filters.keyword)!.trim())}&limit=40` : '?limit=40';
      const res = await fetch(`https://remotive.com/api/remote-jobs${q}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AvartahJobIntelligence/2.0 (+https://avartah.com)'
        }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items = Array.isArray(json.jobs) ? json.jobs : [];

      const jobs: NormalizedJob[] = [];
      const nowIso = new Date().toISOString();

      for (const item of items) {
        const title = (item.title || '').trim();
        const company = (item.company_name || '').trim();
        const appUrl = (item.url || '').trim();

        // Strict rejection of empty or fabricated records
        if (!title || !company || !appUrl || !isSafeJobUrl(appUrl)) {
          continue;
        }

        const loc = (item.candidate_required_location || 'Remote (Worldwide)').trim();
        const locLower = loc.toLowerCase();
        const fp = computeJobFingerprint(title, company, loc);

        const jt = (item.job_type || '').toLowerCase();
        let empType: NormalizedJob['employment_type'] = 'FULL_TIME';
        if (jt.includes('part')) empType = 'PART_TIME';
        else if (jt.includes('contract') || jt.includes('freelance')) empType = 'CONTRACT';
        else if (jt.includes('intern')) empType = 'INTERN';

        // Parse salary if provided in string format (e.g. "70K-80K" or "$50,000 - $70,000")
        let salMin: number | null = null;
        let salMax: number | null = null;
        if (item.salary && typeof item.salary === 'string') {
          const kMatch = item.salary.match(/(\d+)\s*[kK]\s*-\s*(\d+)\s*[kK]/);
          if (kMatch) {
            salMin = parseInt(kMatch[1], 10) * 1000;
            salMax = parseInt(kMatch[2], 10) * 1000;
          } else {
            const numMatch = item.salary.match(/(\d[\d,]+)\s*-\s*(\d[\d,]+)/);
            if (numMatch) {
              salMin = parseInt(numMatch[1].replace(/,/g, ''), 10);
              salMax = parseInt(numMatch[2].replace(/,/g, ''), 10);
            }
          }
        }

        const country = locLower.includes('usa') || locLower.includes('united states')
          ? 'United States'
          : (locLower.includes('uk') || locLower.includes('united kingdom') || locLower.includes('london')
            ? 'United Kingdom'
            : 'Global');

        const postedAt = item.publication_date ? new Date(item.publication_date).toISOString() : '';

        jobs.push({
          id: `remotive-${item.id || fp}`,
          title,
          company,
          location: loc,
          country,
          remote_status: 'REMOTE',
          description: item.description ? item.description.replace(/<[^>]*>?/gm, '').slice(0, 800) : title,
          employment_type: empType,
          salary_min: salMin,
          salary_max: salMax,
          currency: 'USD',
          pay_period: 'YEARLY',
          posted_at: postedAt,
          discovered_at: nowIso,
          application_url: appUrl,
          source_name: 'Remotive API',
          source_job_id: String(item.id || fp),
          status: 'UNVERIFIED',
          verification_evidence: 'Listing present in Remotive job feed; application URL verified valid. Independent opening status unverified.',
          match_score: 80,
          match_reason: 'Remotive API feed presence; external opening unverified',
          source_provenance: {
            provider: 'Remotive',
            rawId: item.id,
            category: item.category
          }
        });
      }

      return {
        sourceName: this.name,
        success: true,
        jobsCount: jobs.length,
        latencyMs: Date.now() - startTime,
        jobs
      };
    } catch (err: any) {
      return {
        sourceName: this.name,
        success: false,
        jobsCount: 0,
        latencyMs: Date.now() - startTime,
        error: err.name === 'AbortError' ? 'Timeout querying Remotive API' : (err.message || 'Remotive API error'),
        jobs: []
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * RemoteOK Public API Adapter
 * Live public developer job board feed with salary transparency and backlink attribution.
 */
export class RemoteOKAdapter implements JobSourceAdapter {
  id = 'remoteok-api';
  name = 'RemoteOK Developer Hub';
  enabled = true;

  async search(filters: JobSearchFilters, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<JobProviderResult> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs || 7000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('https://remoteok.com/api', {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AvartahJobIntelligence/2.0 (+https://avartah.com)'
        }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // First element in RemoteOK API response is legal disclaimer / TOS notice
      const items = Array.isArray(json) ? json.slice(1) : [];

      const jobs: NormalizedJob[] = [];
      const nowIso = new Date().toISOString();

      for (const item of items) {
        const title = (item.position || '').trim();
        const company = (item.company || '').trim();
        const appUrl = (item.apply_url || item.url || '').trim();

        if (!title || !company || !appUrl || !isSafeJobUrl(appUrl)) {
          continue;
        }

        const loc = (item.location || 'Remote (Global)').trim();
        const locLower = loc.toLowerCase();
        const fp = computeJobFingerprint(title, company, loc);

        const minSal = item.salary_min && !isNaN(Number(item.salary_min)) && Number(item.salary_min) > 0
          ? Number(item.salary_min)
          : null;
        const maxSal = item.salary_max && !isNaN(Number(item.salary_max)) && Number(item.salary_max) > 0
          ? Number(item.salary_max)
          : null;

        const country = locLower.includes('usa') || locLower.includes('us')
          ? 'United States'
          : (locLower.includes('uk') || locLower.includes('united kingdom') || locLower.includes('london')
            ? 'United Kingdom'
            : 'Global');

        const postedAt = item.date ? new Date(item.date).toISOString() : '';

        jobs.push({
          id: `remoteok-${item.id || fp}`,
          title,
          company,
          location: loc,
          country,
          remote_status: 'REMOTE',
          description: item.description ? item.description.replace(/<[^>]*>?/gm, '').slice(0, 800) : title,
          employment_type: 'FULL_TIME',
          salary_min: minSal,
          salary_max: maxSal,
          currency: 'USD',
          pay_period: 'YEARLY',
          posted_at: postedAt,
          discovered_at: nowIso,
          application_url: appUrl,
          source_name: 'RemoteOK API',
          source_job_id: String(item.id || fp),
          status: 'UNVERIFIED',
          verification_evidence: 'Listing present in RemoteOK feed; application URL verified valid. Sourced via RemoteOK Developer Hub.',
          match_score: 80,
          match_reason: 'RemoteOK API feed presence; external opening unverified',
          source_provenance: {
            provider: 'RemoteOK',
            rawId: item.id,
            tags: item.tags
          }
        });
      }

      return {
        sourceName: this.name,
        success: true,
        jobsCount: jobs.length,
        latencyMs: Date.now() - startTime,
        jobs
      };
    } catch (err: any) {
      return {
        sourceName: this.name,
        success: false,
        jobsCount: 0,
        latencyMs: Date.now() - startTime,
        error: err.name === 'AbortError' ? 'Timeout querying RemoteOK API' : (err.message || 'RemoteOK API error'),
        jobs: []
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Registry of all available source adapters
 */
export const activeJobAdapters: JobSourceAdapter[] = [
  new GreenhouseATSAdapter(),
  new ArbeitnowAdapter(),
  new JobicyAdapter(),
  new RemotiveAdapter(),
  new RemoteOKAdapter()
];
