import { isSafeUrl, resolveAndValidateHost } from './prospects.js';

export interface AuditDiagnosticsResult {
  targetUrl: string;
  normalizedUrl: string;
  timestamp: string;
  executionTimeMs: number;
  httpProbe: {
    status: 'COMPLETED' | 'FAILED';
    statusCode?: number;
    statusText?: string;
    ttfbMs?: number;
    sslValid: boolean;
    protocol?: string;
    compression?: string;
    htmlSizeBytes?: number;
    hasMobileViewport: boolean;
    hasTitle: boolean;
    titleText?: string;
    hasMetaDescription: boolean;
    hasHtmlLang: boolean;
    htmlLangCode?: string;
    securityHeaders: {
      hsts: boolean;
      csp: boolean;
      xFrameOptions: boolean;
      xContentTypeOptions: boolean;
    };
    error?: string;
  };
  axeCore: {
    status: 'COMPLETED' | 'UNAVAILABLE' | 'FAILED';
    score: number | null;
    passedRulesCount: number;
    violationsCount: number;
    topViolations: Array<{
      id: string;
      impact: 'critical' | 'serious' | 'moderate' | 'minor' | 'unknown';
      help: string;
      description: string;
      nodeCount: number;
    }>;
    error?: string;
  };
  googlePageSpeed: {
    status: 'COMPLETED' | 'UNAVAILABLE' | 'FAILED';
    performanceScore: number | null;
    accessibilityScore: number | null;
    bestPracticesScore: number | null;
    seoScore: number | null;
    coreWebVitals: {
      fcp?: string;
      lcp?: string;
      cls?: string;
      speedIndex?: string;
      tbt?: string;
    };
    error?: string;
  };
  summary: {
    overallCategory: string;
    opportunityScore: number;
    bottlenecksDetected: string[];
    recommendedFixes: string[];
  };
}

/**
 * Validates and normalizes target URL, rejecting invalid or SSRF-risky URLs.
 */
export function validateAndNormalizeAuditUrl(rawUrl: string): { 
  valid: boolean; 
  normalizedUrl?: string; 
  error?: string 
} {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Website URL is required' };
  }

  let trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'Website URL cannot be empty' };
  }

  // Prepend https:// if protocol is omitted
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are supported' };
    }

    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return { valid: false, error: 'A fully qualified domain name (e.g., example.com) is required' };
    }

    // SSRF Security Protection: prevent queries against private ranges, localhost, and internal metadata
    if (!isSafeUrl(trimmed)) {
      return { valid: false, error: 'URL blocked: Private network, localhost, and metadata IPs are disallowed' };
    }

    return { valid: true, normalizedUrl: parsed.toString() };
  } catch (err: any) {
    return { valid: false, error: `Invalid URL format: ${err.message}` };
  }
}

/**
 * Executes a direct server-side HTTP probe to measure real TTFB, SSL, compression, and security headers.
 * Enforces SSRF protection via DNS resolution and manual per-hop redirect validation.
 */
export async function executeDirectHttpProbe(
  url: string,
  timeoutMs: number = 8000,
  opts?: {
    maxRedirects?: number;
    maxResponseBodyBytes?: number;
    resolveHostFn?: typeof resolveAndValidateHost;
    fetchFn?: typeof fetch;
  }
): Promise<{
  probe: AuditDiagnosticsResult['httpProbe'];
  htmlContent: string | null;
}> {
  const startTime = Date.now();
  const maxRedirects = opts?.maxRedirects ?? 4;
  const maxResponseBodyBytes = opts?.maxResponseBodyBytes ?? 2 * 1024 * 1024;
  const resolveHost = opts?.resolveHostFn || resolveAndValidateHost;
  const doFetch = opts?.fetchFn || fetch;

  let currentUrl = url;
  const visitedUrls = new Set<string>();

  try {
    let finalRes: Response | null = null;
    let finalResolvedUrl = currentUrl;

    for (let hop = 0; hop <= maxRedirects; hop++) {
      if (!isSafeUrl(currentUrl)) {
        throw new Error('SSRF Blocked: Private, loopback, or metadata URLs are disallowed');
      }

      if (visitedUrls.has(currentUrl)) {
        throw new Error('Redirect loop detected');
      }
      visitedUrls.add(currentUrl);

      const parsed = new URL(currentUrl);
      const hostValidation = await resolveHost(parsed.hostname);
      if (!hostValidation.safe) {
        throw new Error(`SSRF Blocked: ${hostValidation.reason || 'Resolved IP belongs to restricted range'}`);
      }

      const elapsed = Date.now() - startTime;
      const remainingTimeout = Math.max(1000, timeoutMs - elapsed);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), remainingTimeout);

      let res: Response;
      try {
        res = await doFetch(currentUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AvartahAuditEngine/2.0; +https://avartah.com)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br'
          }
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) {
          throw new Error(`Redirect (HTTP ${res.status}) missing Location header`);
        }
        let nextUrl: string;
        try {
          nextUrl = new URL(location, currentUrl).href;
        } catch {
          throw new Error('Invalid redirect Location URL');
        }
        const nextParsed = new URL(nextUrl);
        if (nextParsed.protocol !== 'http:' && nextParsed.protocol !== 'https:') {
          throw new Error(`SSRF Blocked: Prohibited redirect protocol ${nextParsed.protocol}`);
        }
        if (!isSafeUrl(nextUrl)) {
          throw new Error('SSRF Blocked: Redirect target is in a restricted or private network');
        }
        currentUrl = nextUrl;
        finalResolvedUrl = nextUrl;
        continue;
      }

      finalRes = res;
      finalResolvedUrl = currentUrl;
      break;
    }

    if (!finalRes) {
      throw new Error('Exceeded maximum redirect limit');
    }

    const ttfbMs = Date.now() - startTime;
    const statusCode = finalRes.status;
    const statusText = finalRes.statusText;
    const sslValid = finalResolvedUrl.startsWith('https:');
    const protocol = finalResolvedUrl.startsWith('https:') ? 'HTTPS (TLS)' : 'HTTP (Plaintext)';

    // Inspect security headers
    const hsts = finalRes.headers.has('strict-transport-security');
    const csp = finalRes.headers.has('content-security-policy');
    const xFrameOptions = finalRes.headers.has('x-frame-options');
    const xContentTypeOptions = finalRes.headers.has('x-content-type-options');
    const compression = finalRes.headers.get('content-encoding') || 'none';

    // Retrieve HTML text bounded to 2MB to prevent memory exhaustion
    const rawHtmlFull = await finalRes.text();
    const rawHtml = rawHtmlFull.slice(0, maxResponseBodyBytes);
    const htmlSizeBytes = Buffer.byteLength(rawHtml, 'utf8');

    // DOM / Meta tags analysis using regex for rapid extraction
    const hasMobileViewport = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(rawHtml);
    const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
    const titleText = titleMatch ? titleMatch[1].trim() : undefined;
    const hasTitle = Boolean(titleText && titleText.length > 0);
    const hasMetaDescription = /<meta[^>]+name=["']description["'][^>]*content=["'][^"']+["'][^>]*>/i.test(rawHtml);
    const langMatch = rawHtml.match(/<html[^>]+lang=["']([^"']+)["'][^>]*>/i);
    const htmlLangCode = langMatch ? langMatch[1].trim() : undefined;
    const hasHtmlLang = Boolean(htmlLangCode);

    return {
      probe: {
        status: 'COMPLETED',
        statusCode,
        statusText,
        ttfbMs,
        sslValid,
        protocol,
        compression,
        htmlSizeBytes,
        hasMobileViewport,
        hasTitle,
        titleText,
        hasMetaDescription,
        hasHtmlLang,
        htmlLangCode,
        securityHeaders: {
          hsts,
          csp,
          xFrameOptions,
          xContentTypeOptions
        }
      },
      htmlContent: rawHtml
    };
  } catch (err: any) {
    const errorMsg = err.name === 'AbortError'
      ? `Connection timed out after ${timeoutMs}ms`
      : (err.message || 'Network connection failed');

    return {
      probe: {
        status: 'FAILED',
        sslValid: false,
        hasMobileViewport: false,
        hasTitle: false,
        hasMetaDescription: false,
        hasHtmlLang: false,
        securityHeaders: {
          hsts: false,
          csp: false,
          xFrameOptions: false,
          xContentTypeOptions: false
        },
        error: errorMsg
      },
      htmlContent: null
    };
  }
}

/**
 * Runs axe-core accessibility analysis against the fetched HTML using JSDOM.
 */
export async function executeAxeCoreAudit(
  html: string, 
  url: string
): Promise<AuditDiagnosticsResult['axeCore']> {
  if (!html || !html.trim()) {
    return {
      status: 'UNAVAILABLE',
      score: null,
      passedRulesCount: 0,
      violationsCount: 0,
      topViolations: [],
      error: 'No HTML content available for axe-core evaluation'
    };
  }

  let dom: { window: { document: Document; close: () => void } } | null = null;
  try {
    const [{ JSDOM, VirtualConsole }, axeModule] = await Promise.all([
      import('jsdom'),
      import('axe-core')
    ]);
    const axe = (axeModule as any).default || axeModule;

    // Virtual console suppresses noise from parsed web content
    const virtualConsole = new VirtualConsole();
    dom = new JSDOM(html, {
      url,
      virtualConsole,
      runScripts: 'outside-only'
    });

    const axeResults = await axe.run(dom.window.document.documentElement, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'best-practice']
      }
    });

    const passedRulesCount = axeResults.passes ? axeResults.passes.length : 0;
    const rawViolations = axeResults.violations || [];
    const violationsCount = rawViolations.length;

    // Calculate genuine percentage score based on evaluated rules
    const totalTested = passedRulesCount + violationsCount;
    const score = totalTested > 0 
      ? Math.round((passedRulesCount / totalTested) * 100) 
      : 100;

    const topViolations = rawViolations.slice(0, 5).map((v: any) => ({
      id: v.id,
      impact: (v.impact as any) || 'unknown',
      help: v.help,
      description: v.description,
      nodeCount: v.nodes ? v.nodes.length : 1
    }));

    return {
      status: 'COMPLETED',
      score,
      passedRulesCount,
      violationsCount,
      topViolations
    };
  } catch (err: any) {
    return {
      status: 'FAILED',
      score: null,
      passedRulesCount: 0,
      violationsCount: 0,
      topViolations: [],
      error: `axe-core analysis error: ${err.message}`
    };
  } finally {
    try {
      dom?.window?.close();
    } catch {
      // Ignore cleanup errors on failed JSDOM teardown
    }
  }
}

/**
 * Queries the official Google PageSpeed Insights API v5.
 * Strictly reports real data if available, or records status as UNAVAILABLE/FAILED with exact error.
 */
export async function executeGooglePageSpeedAudit(
  url: string,
  timeoutMs: number = 14000
): Promise<AuditDiagnosticsResult['googlePageSpeed']> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const apiKey = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY || '';
  const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO&strategy=mobile${keyParam}`;

  try {
    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const apiErrMsg = errJson?.error?.message || `HTTP ${res.status} ${res.statusText}`;

      return {
        status: res.status === 429 || res.status === 403 ? 'UNAVAILABLE' : 'FAILED',
        performanceScore: null,
        accessibilityScore: null,
        bestPracticesScore: null,
        seoScore: null,
        coreWebVitals: {},
        error: `PageSpeed Insights: ${apiErrMsg}`
      };
    }

    const data = await res.json();
    const lighthouse = data?.lighthouseResult;
    const categories = lighthouse?.categories;
    const audits = lighthouse?.audits;

    const performanceScore = categories?.performance?.score != null 
      ? Math.round(categories.performance.score * 100) 
      : null;

    const accessibilityScore = categories?.accessibility?.score != null 
      ? Math.round(categories.accessibility.score * 100) 
      : null;

    const bestPracticesScore = categories?.['best-practices']?.score != null 
      ? Math.round(categories['best-practices'].score * 100) 
      : null;

    const seoScore = categories?.seo?.score != null 
      ? Math.round(categories.seo.score * 100) 
      : null;

    const coreWebVitals = {
      fcp: audits?.['first-contentful-paint']?.displayValue,
      lcp: audits?.['largest-contentful-paint']?.displayValue,
      cls: audits?.['cumulative-layout-shift']?.displayValue,
      speedIndex: audits?.['speed-index']?.displayValue,
      tbt: audits?.['total-blocking-time']?.displayValue
    };

    return {
      status: 'COMPLETED',
      performanceScore,
      accessibilityScore,
      bestPracticesScore,
      seoScore,
      coreWebVitals
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    return {
      status: 'FAILED',
      performanceScore: null,
      accessibilityScore: null,
      bestPracticesScore: null,
      seoScore: null,
      coreWebVitals: {},
      error: isTimeout ? `PageSpeed audit timed out after ${timeoutMs}ms` : (err.message || 'Network error querying PageSpeed')
    };
  }
}

/**
 * Orchestrates complete genuine diagnostics: HTTP probe + axe-core + Google PageSpeed.
 */
export async function runFullAuditDiagnostics(targetUrl: string): Promise<AuditDiagnosticsResult> {
  const startTime = Date.now();
  const urlCheck = validateAndNormalizeAuditUrl(targetUrl);
  if (!urlCheck.valid || !urlCheck.normalizedUrl) {
    throw new Error(urlCheck.error || 'Invalid URL');
  }

  const normalizedUrl = urlCheck.normalizedUrl;

  // Execute direct HTTP probe first to fetch live HTML and measure actual TTFB
  const httpResult = await executeDirectHttpProbe(normalizedUrl, 8000);

  // Run axe-core and Google PageSpeed concurrently
  const [axeResult, pageSpeedResult] = await Promise.all([
    httpResult.htmlContent 
      ? executeAxeCoreAudit(httpResult.htmlContent, normalizedUrl)
      : Promise.resolve<AuditDiagnosticsResult['axeCore']>({
          status: 'UNAVAILABLE',
          score: null,
          passedRulesCount: 0,
          violationsCount: 0,
          topViolations: [],
          error: httpResult.probe.error || 'Could not fetch target page'
        }),
    executeGooglePageSpeedAudit(normalizedUrl, 12000)
  ]);

  // Compute synthesized bottleneck and opportunity assessment based strictly on genuine findings
  const bottlenecksDetected: string[] = [];
  const recommendedFixes: string[] = [];

  if (httpResult.probe.status === 'FAILED') {
    bottlenecksDetected.push(`Domain unreachable or failed to respond: ${httpResult.probe.error}`);
    recommendedFixes.push('Resolve DNS, hosting network latency, and SSL certificate bindings');
  } else {
    if (httpResult.probe.ttfbMs && httpResult.probe.ttfbMs > 800) {
      bottlenecksDetected.push(`High Time to First Byte (${httpResult.probe.ttfbMs}ms) - slow server response`);
      recommendedFixes.push('Implement edge caching and server-side compute optimization');
    }
    if (!httpResult.probe.sslValid) {
      bottlenecksDetected.push('Insecure connection (Missing valid TLS / HTTPS)');
      recommendedFixes.push('Enforce modern TLS v1.3 encryption and automated certificate renewal');
    }
    if (!httpResult.probe.securityHeaders.hsts) {
      bottlenecksDetected.push('Missing HSTS security policy (vulnerable to downgrade attacks)');
      recommendedFixes.push('Deploy Strict-Transport-Security headers with preload readiness');
    }
    if (!httpResult.probe.hasMobileViewport) {
      bottlenecksDetected.push('Missing mobile viewport configuration (poor mobile layout rendering)');
      recommendedFixes.push('Configure responsive meta viewport with dynamic device scaling');
    }
    if (httpResult.probe.compression === 'none') {
      bottlenecksDetected.push('HTML payload uncompressed (unnecessary payload weight)');
      recommendedFixes.push('Enable Brotli or Gzip wire compression on web server');
    }
  }

  if (axeResult.status === 'COMPLETED' && axeResult.violationsCount > 0) {
    bottlenecksDetected.push(`axe-core detected ${axeResult.violationsCount} accessibility violations (${axeResult.topViolations.map(v => v.id).join(', ')})`);
    recommendedFixes.push('Remediate WCAG 2.2 AA contrast, missing alt attributes, and ARIA landmarks');
  }

  if (pageSpeedResult.status === 'COMPLETED') {
    if (pageSpeedResult.performanceScore != null && pageSpeedResult.performanceScore < 60) {
      bottlenecksDetected.push(`Low Google PageSpeed Performance score (${pageSpeedResult.performanceScore}/100)`);
      recommendedFixes.push('Eliminate render-blocking resources and optimize Largest Contentful Paint (LCP)');
    }
  }

  let overallCategory = 'Optimized Architecture';
  let opportunityScore = 15;

  if (httpResult.probe.status === 'FAILED') {
    overallCategory = 'Broken / Inaccessible Website';
    opportunityScore = 95;
  } else if (bottlenecksDetected.length >= 3 || (axeResult.score != null && axeResult.score < 70)) {
    overallCategory = 'Poor-Performing Website';
    opportunityScore = 80;
  } else if (bottlenecksDetected.length > 0) {
    overallCategory = 'Suboptimal Web System';
    opportunityScore = 55;
  }

  return {
    targetUrl,
    normalizedUrl,
    timestamp: new Date().toISOString(),
    executionTimeMs: Date.now() - startTime,
    httpProbe: httpResult.probe,
    axeCore: axeResult,
    googlePageSpeed: pageSpeedResult,
    summary: {
      overallCategory,
      opportunityScore,
      bottlenecksDetected,
      recommendedFixes
    }
  };
}
