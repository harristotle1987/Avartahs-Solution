/**
 * Core Prospect Intelligence Validation, Normalization, and Messaging Utilities
 * Production-grade business discovery, contact extraction, and website quality engine.
 */

export type ContactEvidenceSourceType =
  | 'official_site'
  | 'public_directory'
  | 'public_social_profile'
  | 'public_map_listing'
  | 'search_result'
  | 'website_crawl'
  | 'contact_page'
  | 'osm_tag'
  | 'business_listing'
  | 'verified_search';

export type ContactEvidenceStatus =
  | 'FOUND'
  | 'FORMAT_VALID'
  | 'SOURCE_CONFIRMED'
  | 'INDEPENDENTLY_VERIFIED';

export interface ContactEvidence {
  contact_value: string;
  contact_type: 'email' | 'phone' | 'whatsapp' | 'social';
  source_url: string;
  source_type: ContactEvidenceSourceType;
  discovered_at: string;
  evidence_excerpt?: string;
  verification_status: ContactEvidenceStatus;
}

export interface ProspectContactData {
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp_link?: string | null;
  social_profiles?: Record<string, string | null> | null;
  website?: string | null;
  address_number?: string | null;
  contact_evidence?: ContactEvidence[];
}

export function inferSourceTypeFromUrl(sourceUrl: string): ContactEvidenceSourceType {
  const lower = (sourceUrl || '').toLowerCase();
  if (!lower || lower === 'public_listing' || lower.startsWith('osm')) return 'public_map_listing';
  if (lower.includes('duckduckgo.com') || lower.includes('bing.com/search')) return 'search_result';
  if (
    lower.includes('facebook.com') ||
    lower.includes('fb.com') ||
    lower.includes('instagram.com') ||
    lower.includes('linkedin.com') ||
    lower.includes('tiktok.com') ||
    lower.includes('twitter.com') ||
    lower.includes('x.com')
  ) {
    return 'public_social_profile';
  }
  if (isSocialOrDirectoryDomain(lower)) {
    return 'public_directory';
  }
  return 'official_site';
}

/**
 * Validates email syntax and filters out demonstrable placeholder/dummy emails.
 * Explicitly accepts legitimate generic business addresses (info@, sales@, etc.) with real domains.
 */
export function validateEmail(
  email?: string | null,
  sourceUrl: string = 'public_listing',
  opts?: {
    sourceType?: ContactEvidenceSourceType;
    excerpt?: string;
    sourceConfirmed?: boolean;
  }
): { 
  isValid: boolean; 
  isPlaceholder: boolean; 
  verificationStatus: ContactEvidenceStatus | 'INVALID'; 
  evidence?: ContactEvidence 
} {
  if (!email || typeof email !== 'string') {
    return { isValid: false, isPlaceholder: false, verificationStatus: 'INVALID' };
  }

  const trimmed = email.trim().toLowerCase();

  // Strict regex for valid email format according to RFC 5322 standard
  const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, isPlaceholder: false, verificationStatus: 'INVALID' };
  }

  // Reject image asset false positives such as hero@2x.png or sprite@3x.webp
  if (/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js)$/i.test(trimmed)) {
    return { isValid: false, isPlaceholder: false, verificationStatus: 'INVALID' };
  }

  // Check for demonstrable placeholder/dummy domains rather than rejecting valid generic prefixes
  const placeholderDomainPatterns = [
    /@.*businessname\.com$/i,
    /@example\.(com|org|net)$/i,
    /@domain\.(com|org|net)$/i,
    /@placeholder\.(com|org|net)$/i,
    /@yoursite\.(com|org|net)$/i,
    /@test\.(com|org|net)$/i,
    /@mycompany\.(com|org|net)$/i,
    /@sentry\.io$/i,
    /@wixpress\.com$/i,
    /@email\.com$/i,
    /@sample\.(com|org)$/i,
    /@greencleaners\.(com|org|net)$/i
  ];

  const isPlaceholder = placeholderDomainPatterns.some(pattern => pattern.test(trimmed));
  if (isPlaceholder) {
    return { isValid: false, isPlaceholder: true, verificationStatus: 'INVALID' };
  }

  const verificationStatus: ContactEvidenceStatus = opts?.sourceConfirmed
    ? 'SOURCE_CONFIRMED'
    : 'FOUND';

  const evidence: ContactEvidence = {
    contact_value: trimmed,
    contact_type: 'email',
    source_url: sourceUrl,
    source_type: opts?.sourceType || inferSourceTypeFromUrl(sourceUrl),
    discovered_at: new Date().toISOString(),
    ...(opts?.excerpt ? { evidence_excerpt: opts.excerpt.slice(0, 180) } : {}),
    verification_status: verificationStatus
  };

  return { 
    isValid: true, 
    isPlaceholder: false, 
    verificationStatus,
    evidence 
  };
}

/**
 * Standard 5-tier Evidence-Based Website Quality Categories
 */
export type WebsiteQualityCategory =
  | 'No website found'
  | 'Website inaccessible or apparently broken'
  | 'Website potentially outdated'
  | 'Website appears functional and current'
  | 'Assessment inconclusive';

export const WEBSITE_QUALITY_CATEGORIES: Record<string, WebsiteQualityCategory> = {
  NO_WEBSITE: 'No website found',
  BROKEN: 'Website inaccessible or apparently broken',
  OUTDATED: 'Website potentially outdated',
  CURRENT: 'Website appears functional and current',
  INCONCLUSIVE: 'Assessment inconclusive'
};

export function mapInternalStatusToCategory(status?: string | null): WebsiteQualityCategory {
  if (!status) return 'Assessment inconclusive';
  const upper = status.toUpperCase().trim();
  if (upper === 'NO_WEBSITE' || upper === 'NO WEBSITE FOUND') return 'No website found';
  if (upper === 'BROKEN_WEBSITE' || upper === 'BROKEN' || upper === 'WEBSITE INACCESSIBLE OR APPARENTLY BROKEN') return 'Website inaccessible or apparently broken';
  if (upper === 'OUTDATED_WEBSITE' || upper === 'OUTDATED' || upper === 'WEBSITE POTENTIALLY OUTDATED') return 'Website potentially outdated';
  if (upper === 'GOOD_WEBSITE' || upper === 'CURRENT' || upper === 'WEBSITE APPEARS FUNCTIONAL AND CURRENT') return 'Website appears functional and current';
  return 'Assessment inconclusive';
}

/**
 * Normalizes a URL to its base domain for deduplication.
 */
export function normalizeDomain(urlStr?: string | null): string | null {
  if (!urlStr || typeof urlStr !== 'string') return null;
  try {
    let clean = urlStr.trim();
    if (!/^https?:\/\//i.test(clean)) clean = `http://${clean}`;
    const parsed = new URL(clean);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Normalizes business name + location key for deduplication.
 */
export function normalizeBusinessKey(name: string, location: string): string {
  const cleanName = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanLoc = (location || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 25);
  return `${cleanName}__${cleanLoc}`;
}

const SOCIAL_OR_DIRECTORY_HOSTS = [
  'facebook.com',
  'fb.com',
  'm.facebook.com',
  'instagram.com',
  'linkedin.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'linktr.ee',
  'openstreetmap.org',
  'google.com',
  'goo.gl',
  'maps.app.goo.gl',
  'wa.me',
  'whatsapp.com',
  'youtube.com',
  'youtu.be',
  'pinterest.com',
  'yelp.com',
  'yellowpages.com',
  'foursquare.com',
  'tripadvisor.com'
];

/**
 * Checks whether a URL or domain belongs to a social media platform or public directory
 * rather than a business's standalone website.
 */
export function isSocialOrDirectoryDomain(urlOrDomain?: string | null): boolean {
  const domain = normalizeDomain(urlOrDomain);
  if (!domain) return false;
  return SOCIAL_OR_DIRECTORY_HOSTS.some(
    (host) => domain === host || domain.endsWith(`.${host}`)
  );
}

export interface CanonicalKeys {
  domain: string | null;
  phone: string | null;
  email: string | null;
  nameLocation: string;
  primaryKey: string;
}

/**
 * Builds canonical deduplication keys using safe hierarchy:
 * standalone domain -> normalized phone -> normalized email -> normalized name+location.
 * Social/directory domains are intentionally excluded from domain deduplication.
 */
export function extractCanonicalKeys(input: {
  name: string;
  location: string;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  countryContext?: string;
}): CanonicalKeys {
  const rawDomain = normalizeDomain(input.website);
  const domain = rawDomain && !isSocialOrDirectoryDomain(rawDomain) ? rawDomain : null;

  const phoneCheck = normalizeAndValidatePhone(
    input.phone,
    input.countryContext || input.location || ''
  );
  const phone = phoneCheck.isValid && !phoneCheck.isAddressNumber ? phoneCheck.normalizedPhone : null;

  const emailCheck = validateEmail(input.email);
  const email =
    emailCheck.isValid && !emailCheck.isPlaceholder && input.email
      ? input.email.trim().toLowerCase()
      : null;

  const nameLocation = normalizeBusinessKey(input.name || '', input.location || '');

  let primaryKey = `nameloc:${nameLocation}`;
  if (domain) primaryKey = `domain:${domain}`;
  else if (phone) primaryKey = `phone:${phone}`;
  else if (email) primaryKey = `email:${email}`;

  return {
    domain,
    phone,
    email,
    nameLocation,
    primaryKey
  };
}

/**
 * Normalizes international phone numbers with country awareness (including Nigeria +234, UK +44, US/CA +1).
 * Strictly rejects building/address numbers, year numbers, and repetitive dummy strings.
 */
export function normalizeAndValidatePhone(
  phone?: string | null,
  countryContext: string = '',
  sourceUrl: string = 'public_listing',
  opts?: {
    sourceType?: ContactEvidenceSourceType;
    excerpt?: string;
    sourceConfirmed?: boolean;
  }
): { 
  normalizedPhone: string | null; 
  isAddressNumber: boolean; 
  isValid: boolean; 
  verificationStatus: ContactEvidenceStatus | 'INVALID';
  isWhatsAppConfirmed: boolean;
  evidence?: ContactEvidence;
} {
  if (!phone || typeof phone !== 'string') {
    return { normalizedPhone: null, isAddressNumber: false, isValid: false, verificationStatus: 'INVALID', isWhatsAppConfirmed: false };
  }

  const trimmed = phone.trim();

  // Reject pure short digits (house/building numbers such as "12", "104", "45B")
  if (/^\d{1,4}[a-z]?$/i.test(trimmed)) {
    return { normalizedPhone: null, isAddressNumber: true, isValid: false, verificationStatus: 'INVALID', isWhatsAppConfirmed: false };
  }

  // Reject calendar years (e.g., 2020 to 2030)
  if (/^20[2-3]\d$/.test(trimmed)) {
    return { normalizedPhone: null, isAddressNumber: true, isValid: false, verificationStatus: 'INVALID', isWhatsAppConfirmed: false };
  }

  // Reject generic placeholders or text values
  if (
    /^n\/?a$/i.test(trimmed) ||
    /no phone/i.test(trimmed) ||
    /not available/i.test(trimmed) ||
    /check website/i.test(trimmed) ||
    trimmed.length < 6
  ) {
    return { normalizedPhone: null, isAddressNumber: false, isValid: false, verificationStatus: 'INVALID', isWhatsAppConfirmed: false };
  }

  const cleanDigits = trimmed.replace(/[^\d+]/g, '');
  const digitsOnly = cleanDigits.replace(/\D/g, '');

  // Reject dummy repetitive sequences (e.g. 1234567890, 0000000000, 9999999999)
  if (
    /^(\d)\1{6,}$/.test(digitsOnly) ||
    digitsOnly === '123456789' ||
    digitsOnly === '1234567890' ||
    digitsOnly === '0123456789'
  ) {
    return { normalizedPhone: null, isAddressNumber: false, isValid: false, verificationStatus: 'INVALID', isWhatsAppConfirmed: false };
  }

  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return { normalizedPhone: null, isAddressNumber: false, isValid: false, verificationStatus: 'INVALID', isWhatsAppConfirmed: false };
  }

  // Country-aware parsing
  const countryLower = countryContext.toLowerCase();
  const isNigeria = countryLower.includes('nigeria') || countryLower.includes('benin') || countryLower.includes('lagos') || countryLower.includes('abuja') || countryLower.includes('edo') || countryLower === 'ng' || (!countryContext && (/^0[789][01]\d{8}$/.test(digitsOnly)));
  const isUK = countryLower.includes('uk') || countryLower.includes('united kingdom') || countryLower.includes('london') || countryLower.includes('manchester') || countryLower.includes('bristol') || countryLower === 'gb';
  const isNorthAmerica = countryLower.includes('us') || countryLower.includes('usa') || countryLower.includes('united states') || countryLower.includes('canada') || countryLower === 'ca';

  let normalized = cleanDigits;

  if (!normalized.startsWith('+')) {
    if (isNigeria) {
      if (digitsOnly.startsWith('234') && digitsOnly.length === 13) {
        normalized = '+' + digitsOnly;
      } else if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
        normalized = '+234' + digitsOnly.slice(1);
      } else if (digitsOnly.length === 10) {
        normalized = '+234' + digitsOnly;
      } else {
        normalized = '+' + digitsOnly;
      }
    } else if (isUK) {
      if (digitsOnly.startsWith('44') && digitsOnly.length >= 11) {
        normalized = '+' + digitsOnly;
      } else if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
        normalized = '+44' + digitsOnly.slice(1);
      } else {
        normalized = '+' + digitsOnly;
      }
    } else if (isNorthAmerica && digitsOnly.length === 10) {
      normalized = '+1' + digitsOnly;
    } else if (digitsOnly.length === 10 && !isNigeria && !isUK) {
      // If unspecified 10-digit number and context isn't African/European, default to +1
      normalized = '+1' + digitsOnly;
    } else {
      normalized = '+' + digitsOnly;
    }
  }

  const verificationStatus: ContactEvidenceStatus = opts?.sourceConfirmed
    ? 'SOURCE_CONFIRMED'
    : 'FOUND';

  const evidence: ContactEvidence = {
    contact_value: normalized,
    contact_type: 'phone',
    source_url: sourceUrl,
    source_type: opts?.sourceType || inferSourceTypeFromUrl(sourceUrl),
    discovered_at: new Date().toISOString(),
    ...(opts?.excerpt ? { evidence_excerpt: opts.excerpt.slice(0, 180) } : {}),
    verification_status: verificationStatus
  };

  return {
    normalizedPhone: normalized,
    isAddressNumber: false,
    isValid: true,
    verificationStatus,
    isWhatsAppConfirmed: false,
    evidence
  };
}

/**
 * Enforces the Real Contact Qualification Gate.
 * The business MUST have at least one usable, publicly sourced contact channel.
 */
export function passesContactGate(prospect: ProspectContactData, countryContext: string = ''): boolean {
  const emailResult = validateEmail(prospect.email);
  const phoneResult = normalizeAndValidatePhone(prospect.phone, countryContext);

  const hasValidEmail = emailResult.isValid && !emailResult.isPlaceholder;
  const hasValidPhone = phoneResult.isValid && !phoneResult.isAddressNumber;
  
  // WhatsApp link is validated against usable phone number
  const hasWhatsApp = Boolean(
    hasValidPhone &&
    prospect.whatsapp_link && 
    typeof prospect.whatsapp_link === 'string' && 
    (prospect.whatsapp_link.includes('wa.me') || prospect.whatsapp_link.includes('whatsapp.com'))
  );

  // Core qualification requirement: MUST have at least one independently validated public email or usable telephone number
  return hasValidEmail || hasValidPhone || hasWhatsApp;
}

/**
 * Builds prefilled mailto URL. Returns null if email is invalid or missing.
 */
export function buildMailtoUrl(email?: string | null, subject: string = 'Growth Proposal', body: string = ''): string | null {
  const emailRes = validateEmail(email);
  if (!emailRes.isValid || emailRes.isPlaceholder) {
    return null;
  }
  const encEmail = encodeURIComponent(email!.trim());
  const encSubject = encodeURIComponent(subject);
  const encBody = encodeURIComponent(body);
  return `mailto:${encEmail}?subject=${encSubject}&body=${encBody}`;
}

/**
 * Builds prefilled WhatsApp URL. Returns null if phone is invalid or missing.
 */
export function buildWhatsAppUrl(phone?: string | null, text: string = '', countryContext: string = ''): string | null {
  const phoneRes = normalizeAndValidatePhone(phone, countryContext);
  if (!phoneRes.isValid || phoneRes.isAddressNumber || !phoneRes.normalizedPhone) {
    return null;
  }
  const cleanNum = phoneRes.normalizedPhone.replace(/^\+/, '');
  const encText = encodeURIComponent(text);
  return `https://wa.me/${cleanNum}?text=${encText}`;
}

/**
 * Parses IPv4 string (including octal, hex, or single decimal formats) into 4 octets [a, b, c, d].
 */
export function parseIpv4ToOctets(ipStr: string): [number, number, number, number] | null {
  if (!ipStr || typeof ipStr !== 'string') return null;
  const trimmed = ipStr.trim();

  // Single integer / hex IP representation (e.g., 2130706433 or 0x7f000001)
  if (/^(0x[0-9a-f]+|\d+)$/i.test(trimmed)) {
    let num: number;
    if (trimmed.toLowerCase().startsWith('0x')) {
      num = parseInt(trimmed, 16);
    } else {
      num = parseInt(trimmed, 10);
    }
    if (isNaN(num) || num < 0 || num > 0xffffffff) return null;
    return [
      (num >>> 24) & 0xff,
      (num >>> 16) & 0xff,
      (num >>> 8) & 0xff,
      num & 0xff
    ];
  }

  const parts = trimmed.split('.');
  if (parts.length === 4) {
    const octets: number[] = [];
    for (const part of parts) {
      let num: number;
      if (/^0x[0-9a-f]+$/i.test(part)) {
        num = parseInt(part, 16);
      } else if (/^0[0-7]+$/.test(part) && part.length > 1) {
        num = parseInt(part, 8);
      } else if (/^\d+$/.test(part)) {
        num = parseInt(part, 10);
      } else {
        return null;
      }
      if (isNaN(num) || num < 0 || num > 255) return null;
      octets.push(num);
    }
    return octets as [number, number, number, number];
  }

  return null;
}

/**
 * Validates IPv4 octets against loopback, private, link-local, carrier-grade NAT, and reserved ranges.
 */
export function isSafeIpv4(octets: [number, number, number, number]): boolean {
  const [a, b, c, d] = octets;

  // 0.0.0.0/8 (Unspecified/Current Network)
  if (a === 0) return false;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return false;
  // 10.0.0.0/8 (Private)
  if (a === 10) return false;
  // 172.16.0.0/12 (Private)
  if (a === 172 && b >= 16 && b <= 31) return false;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return false;
  // 169.254.0.0/16 (Link-local & Cloud Metadata)
  if (a === 169 && b === 254) return false;
  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return false;
  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return false;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return false;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return false;
  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return false;
  // 224.0.0.0/4 (Multicast & Reserved)
  if (a >= 224) return false;

  return true;
}

/**
 * Validates IPv6 addresses against loopback, link-local, unique local, and IPv4-mapped private IPs.
 */
export function isSafeIpv6(ipStr: string): boolean {
  if (!ipStr || typeof ipStr !== 'string') return false;
  let clean = ipStr.toLowerCase().trim();
  if (clean.startsWith('[') && clean.endsWith(']')) {
    clean = clean.slice(1, -1);
  }

  // Loopback (::1, 0:0:0:0:0:0:0:1) & Unspecified (::, 0:0:0:0:0:0:0:0)
  if (clean === '::' || clean === '::1' || clean === '0:0:0:0:0:0:0:1' || clean === '0:0:0:0:0:0:0:0') {
    return false;
  }

  // Unique local addresses fc00::/7 (fc00:: - fdff::)
  if (clean.startsWith('fc') || clean.startsWith('fd')) {
    return false;
  }

  // Link-local fe80::/10 (fe8.., fe9.., fea.., feb..)
  if (/^fe[89ab]/i.test(clean)) {
    return false;
  }

  // IPv4-mapped / IPv4-translated IPv6 (e.g. ::ffff:127.0.0.1 or 64:ff9b::10.0.0.1)
  const v4Match = clean.match(/(?:ffff|64:ff9b):(?::[0-9a-f]{1,4}){0,4}:?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i) || clean.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (v4Match) {
    const octets = parseIpv4ToOctets(v4Match[1]);
    return octets ? isSafeIpv4(octets) : false;
  }

  return true;
}

/**
 * Determines whether an IP string (IPv4 or IPv6) is a safe public IP.
 */
export function isSafeIp(ipStr: string): boolean {
  if (!ipStr || typeof ipStr !== 'string') return false;
  const clean = ipStr.trim();

  const v4Octets = parseIpv4ToOctets(clean);
  if (v4Octets) {
    return isSafeIpv4(v4Octets);
  }

  return isSafeIpv6(clean);
}

/**
 * Resolves a hostname via DNS lookup and verifies that ALL returned IP addresses are public.
 */
export async function resolveAndValidateHost(hostname: string): Promise<{ safe: boolean; addresses: string[]; reason?: string }> {
  try {
    if (!hostname || typeof hostname !== 'string') {
      return { safe: false, addresses: [], reason: 'Empty hostname' };
    }

    const cleanHost = hostname.toLowerCase().trim();

    // Check direct IPv4 format
    const directV4 = parseIpv4ToOctets(cleanHost);
    if (directV4) {
      const safe = isSafeIpv4(directV4);
      return { safe, addresses: [cleanHost], reason: safe ? undefined : 'Direct IPv4 address in restricted range' };
    }

    // Check direct IPv6 format
    if (cleanHost.includes(':')) {
      const safe = isSafeIpv6(cleanHost);
      return { safe, addresses: [cleanHost], reason: safe ? undefined : 'Direct IPv6 address in restricted range' };
    }

    // Block localhost and internal domain patterns explicitly
    if (
      cleanHost === 'localhost' ||
      cleanHost.endsWith('.local') ||
      cleanHost.endsWith('.internal') ||
      cleanHost.endsWith('.localhost') ||
      cleanHost.endsWith('.onion') ||
      cleanHost.includes('169.254') ||
      cleanHost.includes('metadata.google') ||
      cleanHost.includes('metadata.local') ||
      cleanHost.includes('instance-data')
    ) {
      return { safe: false, addresses: [], reason: 'Blocked restricted domain or keyword' };
    }

    // Browser context fallback: static format checks pass
    if (typeof window !== 'undefined') {
      return { safe: true, addresses: [] };
    }

    // Perform DNS lookup for IPv4 and IPv6 addresses in Node.js server context
    const { lookup } = await import('dns/promises');
    const addresses = await lookup(cleanHost, { all: true, verbatim: true });
    if (!addresses || addresses.length === 0) {
      return { safe: false, addresses: [], reason: 'DNS resolution returned no addresses' };
    }

    const ipList: string[] = [];
    for (const record of addresses) {
      ipList.push(record.address);
      if (!isSafeIp(record.address)) {
        return { safe: false, addresses: ipList, reason: `Resolved IP ${record.address} is in restricted range` };
      }
    }

    return { safe: true, addresses: ipList };
  } catch (err: any) {
    return { safe: false, addresses: [], reason: `DNS lookup failed: ${err.message || err}` };
  }
}

/**
 * Synchronously checks URL formatting, protocol (http/https), userinfo, and hostname structure.
 */
export function isSafeUrl(urlStr: string): boolean {
  try {
    if (!urlStr || typeof urlStr !== 'string') return false;
    const u = new URL(urlStr.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

    // Disallow userinfo
    if (u.username || u.password) return false;

    const host = u.hostname.toLowerCase();

    // Disallow direct IPv4 octal/hex or single-decimal loopbacks/privates
    const v4Octets = parseIpv4ToOctets(host);
    if (v4Octets) {
      return isSafeIpv4(v4Octets);
    }

    // Disallow direct IPv6
    if (host.includes(':')) {
      return isSafeIpv6(host);
    }

    // Disallow localhost and loopbacks
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '0' ||
      host === '::1' ||
      host === '[::1]' ||
      host === '[::]' ||
      host === '::'
    ) {
      return false;
    }

    // Disallow Cloud metadata services and internal domains
    if (
      host === '169.254.169.254' ||
      host === 'metadata.google.internal' ||
      host === 'metadata.local' ||
      host === 'instance-data' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.localhost') ||
      host.endsWith('.onion')
    ) {
      return false;
    }

    // Host must contain at least one dot separating labels for valid domain
    if (!host.includes('.')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Hardened HTTP Fetcher with manual redirect validation, DNS rebinding protection,
 * IP range checks at every hop, and response body size limits.
 */
export async function safeFetchWithRedirects(
  initialUrl: string,
  options: {
    maxRedirects?: number;
    timeoutMs?: number;
    maxResponseBodyBytes?: number;
    headers?: Record<string, string>;
  } = {}
): Promise<{ ok: boolean; status: number; text: string; finalUrl: string; error?: string }> {
  const maxRedirects = options.maxRedirects ?? 4;
  const timeoutMs = options.timeoutMs ?? 4000;
  const maxResponseBodyBytes = options.maxResponseBodyBytes ?? 2 * 1024 * 1024;
  const headers = options.headers || {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AvartahScraper/3.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  };

  let currentUrl = initialUrl;
  const visitedUrls = new Set<string>();

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    // 1. Validate URL structure
    if (!isSafeUrl(currentUrl)) {
      return { ok: false, status: 0, text: '', finalUrl: currentUrl, error: `Blocked unsafe URL: ${currentUrl}` };
    }

    if (visitedUrls.has(currentUrl)) {
      return { ok: false, status: 0, text: '', finalUrl: currentUrl, error: `Redirect loop detected at: ${currentUrl}` };
    }
    visitedUrls.add(currentUrl);

    // 2. Resolve DNS and validate actual IP addresses before opening socket connection
    const parsed = new URL(currentUrl);
    const hostValidation = await resolveAndValidateHost(parsed.hostname);
    if (!hostValidation.safe) {
      return { ok: false, status: 0, text: '', finalUrl: currentUrl, error: `SSRF Blocked: ${hostValidation.reason || 'Restricted host/IP'}` };
    }

    // 3. Perform manual fetch without automatic redirect following
    let res: Response;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      res = await fetch(currentUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'manual'
      });
    } catch (fetchErr: any) {
      clearTimeout(timer);
      return { ok: false, status: 0, text: '', finalUrl: currentUrl, error: fetchErr.message || 'Network request failed' };
    }
    clearTimeout(timer);

    // 4. Manually validate and follow 3xx HTTP Redirects
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        return { ok: false, status: res.status, text: '', finalUrl: currentUrl, error: 'Redirect response missing Location header' };
      }

      let nextUrl: string;
      try {
        nextUrl = new URL(location, currentUrl).href;
      } catch {
        return { ok: false, status: res.status, text: '', finalUrl: currentUrl, error: `Invalid redirect Location header: ${location}` };
      }

      // Enforce http: or https: protocols
      const nextParsed = new URL(nextUrl);
      if (nextParsed.protocol !== 'http:' && nextParsed.protocol !== 'https:') {
        return { ok: false, status: res.status, text: '', finalUrl: currentUrl, error: `Blocked prohibited redirect protocol: ${nextParsed.protocol}` };
      }

      currentUrl = nextUrl;
      continue; // Re-run validation for nextUrl and its DNS in the loop
    }

    if (!res.ok) {
      return { ok: false, status: res.status, text: '', finalUrl: currentUrl, error: `HTTP status ${res.status}` };
    }

    // 5. Read response text with size cap
    try {
      const rawText = await res.text();
      return {
        ok: true,
        status: res.status,
        text: rawText.slice(0, maxResponseBodyBytes),
        finalUrl: currentUrl
      };
    } catch (readErr: any) {
      return { ok: false, status: res.status, text: '', finalUrl: currentUrl, error: readErr.message || 'Error reading response body' };
    }
  }

  return { ok: false, status: 0, text: '', finalUrl: currentUrl, error: 'Exceeded maximum redirect depth limit' };
}

/**
 * Decodes Cloudflare email protection XOR hex strings (`data-cfemail="..."` or `/cdn-cgi/l/email-protection#...`).
 * Adapted cleanly from Leadfinder multi-tier HTML extraction without invoking external scripts.
 */
export function decodeCloudflareEmail(hexStr?: string | null): string | null {
  if (!hexStr || typeof hexStr !== 'string') return null;
  const clean = hexStr.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6,}$/i.test(clean) || clean.length % 2 !== 0) return null;
  try {
    const key = parseInt(clean.slice(0, 2), 16);
    if (Number.isNaN(key)) return null;
    let decoded = '';
    for (let i = 2; i < clean.length; i += 2) {
      const byteVal = parseInt(clean.slice(i, i + 2), 16) ^ key;
      decoded += String.fromCharCode(byteVal);
    }
    const emailCheck = validateEmail(decoded);
    return emailCheck.isValid && !emailCheck.isPlaceholder ? decoded.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Decodes common lightweight visible email obfuscations (`[at]`, `(at)`, `[dot]`, `(dot)`, HTML entities)
 * in plain text blocks without guessing or permuting unprinted addresses.
 */
export function deobfuscateVisibleEmails(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/&#64;|&commat;|&#x40;/gi, '@')
    .replace(/&#46;|&period;|&#x2e;/gi, '.')
    .replace(/\s*(?:\[at\]|\(at\)|\{at\}|\s+at\s+)\s*/gi, '@')
    .replace(/\s*(?:\[dot\]|\(dot\)|\{dot\})\s*/gi, '.');
}

/**
 * Strips script/style tags and HTML markup to produce readable text for contextual extraction.
 */
export function stripHtmlToVisibleText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts public social media profile URLs (Facebook, Instagram, LinkedIn, Twitter/X, TikTok, WhatsApp)
 * while ignoring share/sharer widgets and platform chrome URLs.
 */
export function extractSocialLinksFromHtml(html: string): Record<string, string> {
  const profiles: Record<string, string> = {};
  if (!html || typeof html !== 'string') return profiles;

  const urlRegex = /href=["'](https?:\/\/[^"'\s<>]+)["']/gi;
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const rawUrl = m[1].trim();
    if (!isSafeUrl(rawUrl)) continue;
    try {
      const u = new URL(rawUrl);
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      const pathLower = u.pathname.toLowerCase();

      if (
        (host === 'facebook.com' || host === 'fb.com' || host === 'm.facebook.com') &&
        !pathLower.includes('sharer') &&
        !pathLower.includes('share.php') &&
        pathLower.length > 1 &&
        !profiles.facebook
      ) {
        profiles.facebook = rawUrl;
      } else if (
        host === 'instagram.com' &&
        !pathLower.startsWith('/p/') &&
        !pathLower.startsWith('/explore/') &&
        pathLower.length > 1 &&
        !profiles.instagram
      ) {
        profiles.instagram = rawUrl;
      } else if (
        host === 'linkedin.com' &&
        (pathLower.startsWith('/company/') || pathLower.startsWith('/in/')) &&
        !profiles.linkedin
      ) {
        profiles.linkedin = rawUrl;
      } else if (
        (host === 'twitter.com' || host === 'x.com') &&
        !pathLower.includes('/intent/') &&
        !pathLower.includes('/share') &&
        pathLower.length > 1 &&
        !profiles.twitter
      ) {
        profiles.twitter = rawUrl;
      } else if (
        host === 'tiktok.com' &&
        pathLower.startsWith('/@') &&
        !profiles.tiktok
      ) {
        profiles.tiktok = rawUrl;
      }
    } catch {
      // Ignore malformed URL
    }
  }
  return profiles;
}

/**
 * Extracts emails, phones, WhatsApp links, and public social links from raw HTML.
 * Supports mailto:, Cloudflare cfemail XOR, de-obfuscated text emails, tel:, contextual phone regex, and wa.me links.
 */
export function extractContactsFromHtml(
  html: string,
  sourceUrl: string = 'website',
  countryContext: string = ''
): { 
  email?: string; 
  phone?: string; 
  whatsapp?: string;
  socialProfiles?: Record<string, string>;
  contactEvidence: ContactEvidence[];
} {
  if (!html || typeof html !== 'string') return { contactEvidence: [] };

  let foundEmail: string | undefined;
  let foundPhone: string | undefined;
  let foundWhatsapp: string | undefined;
  const contactEvidence: ContactEvidence[] = [];
  const sourceType = inferSourceTypeFromUrl(sourceUrl);

  // 1. Mailto links
  const mailtoRegex = /href=["']mailto:([^"'\s?]+)/gi;
  let match;
  while ((match = mailtoRegex.exec(html)) !== null) {
    let email = match[1].trim();
    try { email = decodeURIComponent(email); } catch {}
    const val = validateEmail(email, sourceUrl, { sourceType, excerpt: 'Published mailto link' });
    if (val.isValid && !val.isPlaceholder) {
      foundEmail = email.trim().toLowerCase();
      if (val.evidence) contactEvidence.push(val.evidence);
      break;
    }
  }

  // 1b. Cloudflare email protection (data-cfemail or /cdn-cgi/l/email-protection#...)
  if (!foundEmail) {
    const cfPatterns = [
      /data-cfemail=["']([0-9a-f]{6,})["']/gi,
      /\/cdn-cgi\/l\/email-protection#([0-9a-f]{6,})/gi
    ];
    for (const pat of cfPatterns) {
      while ((match = pat.exec(html)) !== null) {
        const decoded = decodeCloudflareEmail(match[1]);
        if (decoded) {
          const val = validateEmail(decoded, sourceUrl, {
            sourceType,
            excerpt: 'Decoded Cloudflare cfemail token'
          });
          if (val.isValid && !val.isPlaceholder) {
            foundEmail = decoded;
            if (val.evidence) contactEvidence.push(val.evidence);
            break;
          }
        }
      }
      if (foundEmail) break;
    }
  }

  const visibleText = stripHtmlToVisibleText(html);

  // 1c. Fallback: search de-obfuscated visible text for published email
  if (!foundEmail) {
    const normalizedText = deobfuscateVisibleEmails(visibleText);
    const textEmailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}/g;
    while ((match = textEmailRegex.exec(normalizedText)) !== null) {
      const email = match[0].trim();
      const idx = match.index;
      const excerpt = normalizedText.slice(Math.max(0, idx - 35), Math.min(normalizedText.length, idx + email.length + 35));
      const val = validateEmail(email, sourceUrl, { sourceType, excerpt });
      if (val.isValid && !val.isPlaceholder) {
        foundEmail = email.toLowerCase();
        if (val.evidence) contactEvidence.push(val.evidence);
        break;
      }
    }
  }

  // 2. WhatsApp links
  const waRegex = /href=["'](https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/[^\s"']+)["']/i;
  const waMatch = html.match(waRegex);
  if (waMatch) {
    foundWhatsapp = waMatch[1];
    contactEvidence.push({
      contact_value: foundWhatsapp,
      contact_type: 'whatsapp',
      source_url: sourceUrl,
      source_type: sourceType,
      discovered_at: new Date().toISOString(),
      evidence_excerpt: 'Published WhatsApp link',
      verification_status: 'FOUND'
    });
  }

  // 3. Phone extraction from tel: links
  const telRegex = /href=["']tel:([^"']+)["']/gi;
  while ((match = telRegex.exec(html)) !== null) {
    let phoneStr = match[1].trim();
    try { phoneStr = decodeURIComponent(phoneStr); } catch {}
    const pVal = normalizeAndValidatePhone(phoneStr, countryContext, sourceUrl, {
      sourceType,
      excerpt: `tel:${phoneStr}`
    });
    if (pVal.isValid && !pVal.isAddressNumber && pVal.normalizedPhone) {
      foundPhone = pVal.normalizedPhone;
      if (pVal.evidence) contactEvidence.push(pVal.evidence);
      break;
    }
  }

  // 3b. Contextual visible-text phone fallback if no tel: link exists
  if (!foundPhone && visibleText) {
    const phoneTextRegex = /(?:\+?\d{1,3}[\s.-]?)?(?:\(0\)|0|\(\d{2,4}\))?[\d\s().-]{7,18}\d/g;
    while ((match = phoneTextRegex.exec(visibleText)) !== null) {
      const rawCand = match[0].trim();
      // Skip date-like strings such as 2024-05-12 or pixel sizes
      if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(rawCand)) continue;
      const digits = rawCand.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 15) continue;
      const contextWindow = visibleText
        .slice(Math.max(0, match.index - 35), Math.min(visibleText.length, match.index + rawCand.length + 35))
        .toLowerCase();
      const hasPhoneCue =
        rawCand.startsWith('+') ||
        /(?:tel|phone|call|mobile|whatsapp|hotline|enquir|contact|office)/i.test(contextWindow);
      if (!hasPhoneCue) continue;

      const pVal = normalizeAndValidatePhone(rawCand, countryContext, sourceUrl, {
        sourceType,
        excerpt: visibleText.slice(Math.max(0, match.index - 25), Math.min(visibleText.length, match.index + rawCand.length + 25))
      });
      if (pVal.isValid && !pVal.isAddressNumber && pVal.normalizedPhone) {
        foundPhone = pVal.normalizedPhone;
        if (pVal.evidence) contactEvidence.push(pVal.evidence);
        break;
      }
    }
  }

  // 4. Public social links
  const socialProfiles = extractSocialLinksFromHtml(html);

  return {
    email: foundEmail,
    phone: foundPhone,
    whatsapp: foundWhatsapp,
    ...(Object.keys(socialProfiles).length > 0 ? { socialProfiles } : {}),
    contactEvidence
  };
}

/**
 * Parses Schema.org JSON-LD blocks (<script type="application/ld+json">)
 * to locate published Organization/LocalBusiness emails, telephones, and sameAs social profiles.
 */
export function extractSchemaOrgContacts(
  html: string,
  sourceUrl: string,
  countryContext: string = ''
): { email?: string; phone?: string; socialProfiles?: Record<string, string>; evidence: ContactEvidence[] } {
  let email: string | undefined;
  let phone: string | undefined;
  const socialProfiles: Record<string, string> = {};
  const evidence: ContactEvidence[] = [];
  const sourceType = inferSourceTypeFromUrl(sourceUrl);

  const scriptRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const rawJson = match[1].trim();
      const parsed = JSON.parse(rawJson);
      const items = Array.isArray(parsed)
        ? parsed
        : parsed && Array.isArray(parsed['@graph'])
        ? parsed['@graph']
        : [parsed];

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;

        if (item.email && typeof item.email === 'string' && !email) {
          const val = validateEmail(item.email, sourceUrl, {
            sourceType,
            excerpt: 'Schema.org JSON-LD email',
            sourceConfirmed: true
          });
          if (val.isValid && !val.isPlaceholder) {
            email = item.email.trim().toLowerCase();
            if (val.evidence) evidence.push(val.evidence);
          }
        }

        if (item.telephone && typeof item.telephone === 'string' && !phone) {
          const pVal = normalizeAndValidatePhone(item.telephone, countryContext, sourceUrl, {
            sourceType,
            excerpt: 'Schema.org JSON-LD telephone',
            sourceConfirmed: true
          });
          if (pVal.isValid && !pVal.isAddressNumber && pVal.normalizedPhone) {
            phone = pVal.normalizedPhone;
            if (pVal.evidence) evidence.push(pVal.evidence);
          }
        }

        if (item.sameAs) {
          const sameAsList = Array.isArray(item.sameAs) ? item.sameAs : [item.sameAs];
          for (const sUrl of sameAsList) {
            if (typeof sUrl === 'string' && isSafeUrl(sUrl)) {
              const lower = sUrl.toLowerCase();
              if (lower.includes('facebook.com') && !socialProfiles.facebook) socialProfiles.facebook = sUrl;
              else if (lower.includes('instagram.com') && !socialProfiles.instagram) socialProfiles.instagram = sUrl;
              else if (lower.includes('linkedin.com') && !socialProfiles.linkedin) socialProfiles.linkedin = sUrl;
              else if ((lower.includes('twitter.com') || lower.includes('x.com')) && !socialProfiles.twitter) socialProfiles.twitter = sUrl;
            }
          }
        }

        if (item.contactPoint) {
          const points = Array.isArray(item.contactPoint) ? item.contactPoint : [item.contactPoint];
          for (const pt of points) {
            if (pt && typeof pt === 'object') {
              if (pt.email && typeof pt.email === 'string' && !email) {
                const val = validateEmail(pt.email, sourceUrl, {
                  sourceType,
                  excerpt: 'Schema.org contactPoint email',
                  sourceConfirmed: true
                });
                if (val.isValid && !val.isPlaceholder) {
                  email = pt.email.trim().toLowerCase();
                  if (val.evidence) evidence.push(val.evidence);
                }
              }
              if (pt.telephone && typeof pt.telephone === 'string' && !phone) {
                const pVal = normalizeAndValidatePhone(pt.telephone, countryContext, sourceUrl, {
                  sourceType,
                  excerpt: 'Schema.org contactPoint telephone',
                  sourceConfirmed: true
                });
                if (pVal.isValid && !pVal.isAddressNumber && pVal.normalizedPhone) {
                  phone = pVal.normalizedPhone;
                  if (pVal.evidence) evidence.push(pVal.evidence);
                }
              }
            }
          }
        }
      }
    } catch {
      // Non-fatal JSON parse error for malformed schema blocks
    }
  }

  return {
    email,
    phone,
    ...(Object.keys(socialProfiles).length > 0 ? { socialProfiles } : {}),
    evidence
  };
}

/**
 * Extracts emails and phone numbers from HTML <meta> tags.
 */
export function extractMetaTagContacts(
  html: string,
  sourceUrl: string,
  countryContext: string = ''
): { email?: string; phone?: string; evidence: ContactEvidence[] } {
  let email: string | undefined;
  let phone: string | undefined;
  const evidence: ContactEvidence[] = [];
  const sourceType = inferSourceTypeFromUrl(sourceUrl);

  const emailMetaRegex = /<meta\s+[^>]*(?:name|property)=["'](?:og:email|email|contact:email)["'][^>]*content=["']([^"']+)["']/gi;
  let match;
  while ((match = emailMetaRegex.exec(html)) !== null) {
    const val = validateEmail(match[1], sourceUrl, { sourceType, excerpt: 'HTML meta email tag' });
    if (val.isValid && !val.isPlaceholder) {
      email = match[1].trim().toLowerCase();
      if (val.evidence) evidence.push(val.evidence);
      break;
    }
  }

  const phoneMetaRegex = /<meta\s+[^>]*(?:name|property)=["'](?:telephone|phone|contact:phone_number|og:phone_number)["'][^>]*content=["']([^"']+)["']/gi;
  while ((match = phoneMetaRegex.exec(html)) !== null) {
    const pVal = normalizeAndValidatePhone(match[1], countryContext, sourceUrl, {
      sourceType,
      excerpt: 'HTML meta phone tag'
    });
    if (pVal.isValid && !pVal.isAddressNumber && pVal.normalizedPhone) {
      phone = pVal.normalizedPhone;
      if (pVal.evidence) evidence.push(pVal.evidence);
      break;
    }
  }

  return { email, phone, evidence };
}

/**
 * Deep Crawls target business website: homepage + bounded same-domain contact subpages
 * (/contact, /contact-us, /about, /about-us, /enquiries, /booking, /reach-us)
 * + Schema.org JSON-LD + meta tags with strict SSRF bounds.
 */
export async function deepScrapeWebsiteContacts(
  rawUrl: string,
  countryContext: string = '',
  opts?: {
    safeFetchFn?: typeof safeFetchWithRedirects;
    maxSubpages?: number;
    timeoutMs?: number;
  }
): Promise<{
  email?: string;
  phone?: string;
  whatsapp?: string;
  socialProfiles?: Record<string, string>;
  contactEvidence: ContactEvidence[];
  pagesScraped: string[];
  error?: string;
}> {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { contactEvidence: [], pagesScraped: [] };
  }

  let cleanUrl = rawUrl.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }

  if (!isSafeUrl(cleanUrl)) {
    return { contactEvidence: [], pagesScraped: [], error: 'URL blocked by SSRF security rules' };
  }

  const fetcher = opts?.safeFetchFn || safeFetchWithRedirects;
  const maxSubpages = Math.min(Math.max(opts?.maxSubpages ?? 3, 1), 4);
  const timeoutMs = opts?.timeoutMs ?? 4500;

  let foundEmail: string | undefined;
  let foundPhone: string | undefined;
  let foundWhatsapp: string | undefined;
  const socialProfiles: Record<string, string> = {};
  const allEvidence: ContactEvidence[] = [];
  const pagesScraped: string[] = [];

  const absorbHtml = (html: string, pageUrl: string) => {
    const schemaContacts = extractSchemaOrgContacts(html, pageUrl, countryContext);
    if (schemaContacts.email && !foundEmail) foundEmail = schemaContacts.email;
    if (schemaContacts.phone && !foundPhone) foundPhone = schemaContacts.phone;
    if (schemaContacts.socialProfiles) Object.assign(socialProfiles, schemaContacts.socialProfiles);
    allEvidence.push(...schemaContacts.evidence);

    const metaContacts = extractMetaTagContacts(html, pageUrl, countryContext);
    if (metaContacts.email && !foundEmail) foundEmail = metaContacts.email;
    if (metaContacts.phone && !foundPhone) foundPhone = metaContacts.phone;
    allEvidence.push(...metaContacts.evidence);

    const baseContacts = extractContactsFromHtml(html, pageUrl, countryContext);
    if (baseContacts.email && !foundEmail) foundEmail = baseContacts.email;
    if (baseContacts.phone && !foundPhone) foundPhone = baseContacts.phone;
    if (baseContacts.whatsapp && !foundWhatsapp) foundWhatsapp = baseContacts.whatsapp;
    if (baseContacts.socialProfiles) {
      for (const [k, v] of Object.entries(baseContacts.socialProfiles)) {
        if (!socialProfiles[k]) socialProfiles[k] = v;
      }
    }
    allEvidence.push(...baseContacts.contactEvidence);
  };

  try {
    // 1. Fetch Root Page securely via safeFetchFn
    const rootFetch = await fetcher(cleanUrl, { timeoutMs, maxRedirects: 4 });
    if (!rootFetch.ok) {
      return { contactEvidence: [], pagesScraped: [], error: rootFetch.error || `HTTP ${rootFetch.status}` };
    }

    const actualUrl = rootFetch.finalUrl || cleanUrl;
    pagesScraped.push(actualUrl);
    const rootHtml = rootFetch.text;
    absorbHtml(rootHtml, actualUrl);

    // 2. Discover & crawl bounded same-domain contact subpages if email or phone is missing
    if (!foundEmail || !foundPhone) {
      try {
        const parsedOrigin = new URL(actualUrl).origin;
        const subpageCandidates = new Set<string>();

        const linkRegex = /href=["']((?:\/|(?:https?:\/\/[^"'\s/]+)?\/)(?:contact|contact-us|about|about-us|enquiries|enquiry|booking|bookings|reach-us|get-in-touch)[^"'\s?]*)["']/gi;
        let linkMatch;
        while ((linkMatch = linkRegex.exec(rootHtml)) !== null) {
          let subUrl = linkMatch[1].trim();
          if (subUrl.startsWith('/')) {
            subUrl = `${parsedOrigin}${subUrl}`;
          }
          try {
            const u = new URL(subUrl);
            if (u.origin === parsedOrigin && u.href !== actualUrl && isSafeUrl(subUrl)) {
              subpageCandidates.add(subUrl);
            }
          } catch {}
          if (subpageCandidates.size >= maxSubpages) break;
        }

        for (const subUrl of Array.from(subpageCandidates).slice(0, maxSubpages)) {
          if (foundEmail && foundPhone) break;
          try {
            const subRes = await fetcher(subUrl, { timeoutMs: Math.min(timeoutMs, 3500), maxRedirects: 3 });
            if (subRes.ok) {
              const subActualUrl = subRes.finalUrl || subUrl;
              if (!pagesScraped.includes(subActualUrl)) {
                pagesScraped.push(subActualUrl);
              }
              absorbHtml(subRes.text, subActualUrl);
            }
          } catch {
            // Ignore subpage failure and proceed
          }
        }
      } catch {
        // Ignore subpage crawling errors
      }
    }
  } catch (err: any) {
    return {
      email: foundEmail,
      phone: foundPhone,
      whatsapp: foundWhatsapp,
      ...(Object.keys(socialProfiles).length > 0 ? { socialProfiles } : {}),
      contactEvidence: allEvidence,
      pagesScraped,
      error: err.message || 'Scrape request failed'
    };
  }

  // Deduplicate evidence items
  const seenEvidence = new Set<string>();
  const uniqueEvidence = allEvidence.filter(e => {
    const key = `${e.contact_type}:${e.contact_value}:${e.source_url}`;
    if (seenEvidence.has(key)) return false;
    seenEvidence.add(key);
    return true;
  });

  return {
    email: foundEmail,
    phone: foundPhone,
    whatsapp: foundWhatsapp,
    ...(Object.keys(socialProfiles).length > 0 ? { socialProfiles } : {}),
    contactEvidence: uniqueEvidence,
    pagesScraped
  };
}

export interface PublicContactResearchInput {
  businessName: string;
  location: string;
  city?: string;
  countryContext?: string;
  existingEmail?: string | null;
  existingPhone?: string | null;
  socialUrls?: string[];
}

export interface PublicContactResearchDeps {
  fetchFn?: typeof fetch;
  safeFetchFn?: typeof safeFetchWithRedirects;
  sleepFn?: (ms: number) => Promise<void>;
  nowFn?: () => number;
  signal?: AbortSignal;
  jobSeenQueries?: Set<string>;
  jobSeenUrls?: Set<string>;
  timeoutMs?: number;
  maxSearchQueries?: number;
  maxFollowupPages?: number;
}

export interface PublicContactResearchResult {
  email?: string;
  phone?: string;
  whatsapp?: string;
  socialProfiles: Record<string, string>;
  contactEvidence: ContactEvidence[];
  sourcesChecked: string[];
  pagesChecked: string[];
  queriesExecuted: number;
  providerFailures: string[];
}

function tokenizeIdentity(raw: string): string[] {
  const stopWords = new Set(['the', 'and', 'ltd', 'limited', 'llc', 'inc', 'plc', 'co', 'company', 'services', 'service', 'center', 'centre']);
  return (raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !stopWords.has(t));
}

function blockMatchesBusinessIdentity(blockText: string, businessName: string, locality: string): boolean {
  const textLower = (blockText || '').toLowerCase();
  const nameTokens = tokenizeIdentity(businessName);
  if (nameTokens.length === 0) return false;
  const matchedNameCount = nameTokens.filter((t) => textLower.includes(t)).length;
  const requiredNameMatches = nameTokens.length === 1 ? 1 : Math.min(2, nameTokens.length);
  if (matchedNameCount < requiredNameMatches) return false;

  const locTokens = tokenizeIdentity(locality);
  if (locTokens.length > 0) {
    const locMatched = locTokens.some((t) => textLower.includes(t));
    if (!locMatched && matchedNameCount < nameTokens.length) return false;
  }
  return true;
}

function parseDuckDuckGoHtmlBlocks(html: string): Array<{ title: string; url: string; snippet: string; fullText: string }> {
  const blocks: Array<{ title: string; url: string; snippet: string; fullText: string }> = [];
  if (!html) return blocks;

  // DuckDuckGo HTML format (<div class="result...">...<a class="result__a" href="...">Title</a>...<a class="result__snippet">...</a>)
  const chunkRegex = /<div[^>]*class=["'][^"']*result\b[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]*class=["'][^"']*result\b|$)/gi;
  let m;
  while ((m = chunkRegex.exec(html)) !== null) {
    const chunk = m[1];
    const linkMatch = chunk.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const title = linkMatch ? stripHtmlToVisibleText(linkMatch[2]) : '';
    let resultUrl = linkMatch ? linkMatch[1].trim() : '';
    // Unwrap DuckDuckGo uddg redirect parameter cleanly without external call
    if (resultUrl.includes('uddg=')) {
      try {
        const parsed = new URL(resultUrl.startsWith('http') ? resultUrl : `https://duckduckgo.com${resultUrl}`);
        const target = parsed.searchParams.get('uddg');
        if (target) resultUrl = target;
      } catch {}
    }
    const snippetMatch = chunk.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);
    const snippet = snippetMatch ? stripHtmlToVisibleText(snippetMatch[1]) : stripHtmlToVisibleText(chunk);
    const fullText = `${title} ${snippet}`.trim();
    if (fullText) {
      blocks.push({ title, url: resultUrl, snippet, fullText });
    }
  }

  // Fallback for DuckDuckGo Lite / generic table blocks
  if (blocks.length === 0) {
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    while ((m = trRegex.exec(html)) !== null) {
      const text = stripHtmlToVisibleText(m[1]);
      if (text.length < 25) continue;
      const hrefMatch = m[1].match(/href=["'](https?:\/\/[^"']+)["']/i);
      blocks.push({
        title: text.slice(0, 80),
        url: hrefMatch ? hrefMatch[1] : '',
        snippet: text,
        fullText: text
      });
    }
  }

  return blocks;
}

function parseBingHtmlBlocks(html: string): Array<{ title: string; url: string; snippet: string; fullText: string }> {
  const blocks: Array<{ title: string; url: string; snippet: string; fullText: string }> = [];
  if (!html) return blocks;

  const liRegex = /<li[^>]*class=["'][^"']*b_algo[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRegex.exec(html)) !== null) {
    const chunk = m[1];
    const linkMatch = chunk.match(/<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const url = linkMatch ? linkMatch[1].trim() : '';
    const title = linkMatch ? stripHtmlToVisibleText(linkMatch[2]) : '';
    const snippetMatch = chunk.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = snippetMatch ? stripHtmlToVisibleText(snippetMatch[1]) : stripHtmlToVisibleText(chunk);
    const fullText = `${title} ${snippet}`.trim();
    if (fullText) {
      blocks.push({ title, url, snippet, fullText });
    }
  }
  return blocks;
}

/**
 * Bounded, lawful public contact research for small businesses without an official website.
 * Stage 1: Inspect permitted public social/directory URLs already present on the listing (honoring 401/403 login walls).
 * Stage 2: Query public search snippets (DuckDuckGo HTML/Lite primary, Bing fallback only if DDG fails/returns nothing)
 *          with query deduplication, name+location snippet verification, optional 1-2 safe follow-up pages, and ZERO guessing.
 */
export async function researchPublicContactsForBusiness(
  input: PublicContactResearchInput,
  deps: PublicContactResearchDeps = {}
): Promise<PublicContactResearchResult> {
  const fetchFn = deps.fetchFn || fetch;
  const safeFetchFn = deps.safeFetchFn || safeFetchWithRedirects;
  const countryContext = input.countryContext || input.location || '';
  const locality = (input.city || input.location.split(',')[0] || input.location || '').trim();
  const timeoutMs = deps.timeoutMs ?? 4000;
  const maxSearchQueries = Math.min(Math.max(deps.maxSearchQueries ?? 2, 1), 3);
  const maxFollowupPages = Math.min(Math.max(deps.maxFollowupPages ?? 2, 0), 3);

  let foundEmail = input.existingEmail ? input.existingEmail.trim().toLowerCase() : undefined;
  let foundPhone = input.existingPhone ? input.existingPhone.trim() : undefined;
  let foundWhatsapp: string | undefined;
  const socialProfiles: Record<string, string> = {};
  const contactEvidence: ContactEvidence[] = [];
  const sourcesChecked: string[] = [];
  const pagesChecked: string[] = [];
  const providerFailures: string[] = [];
  const discoveredFollowupUrls: string[] = [];
  let queriesExecuted = 0;

  const seenQueries = deps.jobSeenQueries || new Set<string>();
  const seenUrls = deps.jobSeenUrls || new Set<string>();

  const recordEvidence = (ev?: ContactEvidence) => {
    if (!ev) return;
    const exists = contactEvidence.some(
      (x) => x.contact_type === ev.contact_type && x.contact_value === ev.contact_value && x.source_url === ev.source_url
    );
    if (!exists) contactEvidence.push(ev);
  };

  // Stage 1: Permitted public social/directory URLs already linked on the candidate
  for (const rawUrl of (input.socialUrls || []).slice(0, 2)) {
    if (deps.signal?.aborted || (foundEmail && foundPhone)) break;
    const cleanUrl = (rawUrl || '').trim();
    if (!cleanUrl || !isSafeUrl(cleanUrl) || seenUrls.has(cleanUrl)) continue;
    seenUrls.add(cleanUrl);

    const host = normalizeDomain(cleanUrl) || 'public_directory';
    const isSocial = isSocialOrDirectoryDomain(cleanUrl);
    sourcesChecked.push(`${isSocial ? 'public_social_profile' : 'public_directory'}:${host}`);

    try {
      const res = await safeFetchFn(cleanUrl, { timeoutMs, maxRedirects: 3 });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          providerFailures.push(`${host} access restricted (HTTP ${res.status}; login/wall respected)`);
        }
        continue;
      }
      const actualUrl = res.finalUrl || cleanUrl;
      pagesChecked.push(actualUrl);
      const visible = stripHtmlToVisibleText(res.text);
      const identityConfirmed = blockMatchesBusinessIdentity(visible, input.businessName, locality);
      if (!identityConfirmed) continue;

      const extracted = extractContactsFromHtml(res.text, actualUrl, countryContext);
      if (extracted.email && !foundEmail) foundEmail = extracted.email;
      if (extracted.phone && !foundPhone) foundPhone = extracted.phone;
      if (extracted.whatsapp && !foundWhatsapp) foundWhatsapp = extracted.whatsapp;
      if (extracted.socialProfiles) Object.assign(socialProfiles, extracted.socialProfiles);
      for (const ev of extracted.contactEvidence) {
        recordEvidence({
          ...ev,
          verification_status: 'SOURCE_CONFIRMED'
        });
      }
    } catch {
      // Non-fatal
    }
  }

  // Stage 2: Bounded public search snippet research (DuckDuckGo HTML primary -> Bing fallback)
  if ((!foundEmail || !foundPhone) && input.businessName.trim() && !deps.signal?.aborted) {
    const queryCandidates = [
      `"${input.businessName.trim()}" "${locality}" contact email phone`,
      `"${input.businessName.trim()}" "${locality}" Facebook Instagram WhatsApp`
    ].slice(0, maxSearchQueries);

    for (const q of queryCandidates) {
      if (deps.signal?.aborted || (foundEmail && foundPhone)) break;
      const normQ = q.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seenQueries.has(normQ)) continue;
      seenQueries.add(normQ);

      let searchBlocks: Array<{ title: string; url: string; snippet: string; fullText: string }> = [];
      let searchSourceUrl = '';

      // Primary: DuckDuckGo HTML
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
      sourcesChecked.push(`search_result:duckduckgo.com`);
      queriesExecuted++;
      try {
        const ddgRes = await fetchFn(ddgUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AvartahResearchBot/1.0)',
            Accept: 'text/html,application/xhtml+xml'
          },
          signal: deps.signal ? deps.signal : AbortSignal.timeout(timeoutMs)
        });
        if (ddgRes.ok) {
          const ddgHtml = await ddgRes.text();
          searchBlocks = parseDuckDuckGoHtmlBlocks(ddgHtml);
          searchSourceUrl = ddgUrl;
        } else {
          providerFailures.push(`duckduckgo HTTP ${ddgRes.status}`);
        }
      } catch (err: any) {
        if (deps.signal?.aborted) break;
        providerFailures.push(`duckduckgo ${err?.message || 'error'}`);
      }

      // Fallback: Bing HTML search ONLY if DuckDuckGo failed or returned zero blocks
      if (searchBlocks.length === 0 && !deps.signal?.aborted) {
        const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
        sourcesChecked.push(`search_result:bing.com`);
        queriesExecuted++;
        try {
          const bingRes = await fetchFn(bingUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; AvartahResearchBot/1.0)',
              Accept: 'text/html,application/xhtml+xml'
            },
            signal: deps.signal ? deps.signal : AbortSignal.timeout(timeoutMs)
          });
          if (bingRes.ok) {
            const bingHtml = await bingRes.text();
            searchBlocks = parseBingHtmlBlocks(bingHtml);
            searchSourceUrl = bingUrl;
          } else {
            providerFailures.push(`bing HTTP ${bingRes.status}`);
          }
        } catch (err: any) {
          if (!deps.signal?.aborted) {
            providerFailures.push(`bing ${err?.message || 'error'}`);
          }
        }
      }

      // Evaluate snippet blocks matching business identity + locality
      for (const blk of searchBlocks.slice(0, 8)) {
        const resultSource = blk.url && isSafeUrl(blk.url) ? blk.url : searchSourceUrl;
        if (blk.url && isSafeUrl(blk.url)) {
          const host = normalizeDomain(blk.url);
          if (host === 'facebook.com' && !socialProfiles.facebook) socialProfiles.facebook = blk.url;
          else if (host === 'instagram.com' && !socialProfiles.instagram) socialProfiles.instagram = blk.url;
          else if (host === 'linkedin.com' && !socialProfiles.linkedin) socialProfiles.linkedin = blk.url;
          else if ((host === 'twitter.com' || host === 'x.com') && !socialProfiles.twitter) socialProfiles.twitter = blk.url;

          if (
            discoveredFollowupUrls.length < maxFollowupPages &&
            !seenUrls.has(blk.url) &&
            blockMatchesBusinessIdentity(blk.fullText, input.businessName, locality)
          ) {
            discoveredFollowupUrls.push(blk.url);
          }
        }

        if (!blockMatchesBusinessIdentity(blk.fullText, input.businessName, locality)) {
          continue;
        }

        const normalizedSnippet = deobfuscateVisibleEmails(blk.fullText);
        const excerpt = blk.snippet.slice(0, 140);

        if (!foundEmail) {
          const emailMatch = normalizedSnippet.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}/);
          if (emailMatch) {
            const eVal = validateEmail(emailMatch[0], resultSource, {
              sourceType: 'search_result',
              excerpt,
              sourceConfirmed: true
            });
            if (eVal.isValid && !eVal.isPlaceholder) {
              foundEmail = emailMatch[0].trim().toLowerCase();
              recordEvidence(eVal.evidence);
            }
          }
        }

        if (!foundPhone) {
          const phoneMatch = blk.fullText.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(0\)|0|\(\d{2,4}\))?[\d\s().-]{7,18}\d/);
          if (phoneMatch) {
            const pVal = normalizeAndValidatePhone(phoneMatch[0], countryContext, resultSource, {
              sourceType: 'search_result',
              excerpt,
              sourceConfirmed: true
            });
            if (pVal.isValid && !pVal.isAddressNumber && pVal.normalizedPhone) {
              foundPhone = pVal.normalizedPhone;
              recordEvidence(pVal.evidence);
            }
          }
        }

        if (foundEmail && foundPhone) break;
      }
    }

    // Stage 2b: Optional bounded follow-up crawl on 1-2 safe matched public directory/social result pages
    for (const fUrl of discoveredFollowupUrls.slice(0, maxFollowupPages)) {
      if (deps.signal?.aborted || (foundEmail && foundPhone)) break;
      if (seenUrls.has(fUrl) || !isSafeUrl(fUrl)) continue;
      seenUrls.add(fUrl);

      const host = normalizeDomain(fUrl) || 'public_directory';
      const sourceLabel = isSocialOrDirectoryDomain(fUrl) ? 'public_directory' : 'official_site';
      sourcesChecked.push(`${sourceLabel}:${host}`);

      try {
        const pageRes = await safeFetchFn(fUrl, { timeoutMs, maxRedirects: 3 });
        if (!pageRes.ok) {
          if (pageRes.status === 401 || pageRes.status === 403) {
            providerFailures.push(`${host} access restricted (HTTP ${pageRes.status})`);
          }
          continue;
        }
        const finalUrl = pageRes.finalUrl || fUrl;
        pagesChecked.push(finalUrl);
        const visible = stripHtmlToVisibleText(pageRes.text);
        if (!blockMatchesBusinessIdentity(visible, input.businessName, locality)) {
          continue;
        }

        const extracted = extractContactsFromHtml(pageRes.text, finalUrl, countryContext);
        const schema = extractSchemaOrgContacts(pageRes.text, finalUrl, countryContext);

        const candEmail = schema.email || extracted.email;
        const candPhone = schema.phone || extracted.phone;
        if (candEmail && !foundEmail) foundEmail = candEmail;
        if (candPhone && !foundPhone) foundPhone = candPhone;
        if (extracted.whatsapp && !foundWhatsapp) foundWhatsapp = extracted.whatsapp;
        if (extracted.socialProfiles) Object.assign(socialProfiles, extracted.socialProfiles);
        if (schema.socialProfiles) Object.assign(socialProfiles, schema.socialProfiles);

        for (const ev of [...schema.evidence, ...extracted.contactEvidence]) {
          recordEvidence({ ...ev, verification_status: 'SOURCE_CONFIRMED' });
        }
      } catch {
        // Non-fatal
      }
    }
  }

  return {
    email: foundEmail,
    phone: foundPhone,
    whatsapp: foundWhatsapp,
    socialProfiles,
    contactEvidence,
    sourcesChecked: Array.from(new Set(sourcesChecked)),
    pagesChecked: Array.from(new Set(pagesChecked)),
    queriesExecuted,
    providerFailures
  };
}

/**
 * Value-First Conversion Pitch Generator (Deterministic Fallback / Standalone Engine)
 * Synthesizes genuine audit signals (speed, responsiveness, booking system) into high-converting copy.
 */
export function generateValueFirstPitch(prospect: {
  business_name: string;
  location?: string | null;
  niche?: string | null;
  website_url?: string | null;
  website_quality_category?: string | null;
  website_quality_score?: number | null;
  website_evidence?: string | null;
}): {
  email: { subject: string; body: string };
  whatsappMessage: string;
} {
  const name = prospect.business_name || 'Business Owner';
  const loc = prospect.location || 'your area';
  const niche = prospect.niche || 'business';
  const score = prospect.website_quality_score ?? 50;
  const web = prospect.website_url;
  const category = prospect.website_quality_category || '';

  const isNoWeb = !web || category === 'No website found';
  const isBroken = category.includes('broken') || category.includes('inaccessible');
  const isOutdated = category.includes('outdated') || score < 60;

  // 1. WhatsApp Pitch: punchy, mobile-optimized (under 100 words), direct value
  let waMsg = '';
  if (isNoWeb) {
    waMsg = `Hello ${name} team! Harrison from Avartah Solutions here. We saw your business in ${loc} and love your work in the ${niche} space. We noticed you don't currently have a dedicated mobile booking website. We build high-converting web systems that capture clients and automate appointments. Would you be open to a quick 5-minute chat this week?`;
  } else if (isBroken) {
    waMsg = `Hi ${name} team! Harrison from Avartah Solutions here. While reviewing local ${niche} providers in ${loc}, our technical audit flagged that ${web} is currently inaccessible or experiencing downtime. We help businesses restore and modernize their web infrastructure with zero downtime. Are you open to a brief conversation?`;
  } else if (isOutdated) {
    waMsg = `Hello ${name} team! Harrison from Avartah here. We completed a quick digital performance audit of ${web} (scored ${score}/100) and spotted 2 immediate fixes to accelerate mobile loading and client booking rates. Would you be open to a 5-minute review call this week?`;
  } else {
    waMsg = `Hello ${name} team! Harrison from Avartah Solutions here. Impressed by your reputation in ${loc}! We help premier ${niche} brands scale client conversion and local search dominance with bespoke web systems. Are you open to a brief chat regarding digital expansion?`;
  }

  // 2. Email Pitch: structured, consultative, audit-grounded
  let emailSubject = '';
  let emailBody = '';

  if (isNoWeb) {
    emailSubject = `Digital Booking Engine & Growth Architecture for ${name}`;
    emailBody = `Dear ${name} Leadership,

I came across ${name} in ${loc} and was genuinely impressed by your client reputation in the ${niche} market.

While analyzing the local search landscape for your area, I noticed that ${name} does not yet have a dedicated, mobile-optimized website or automated booking portal. In today's digital climate, local businesses in your category capture up to 68% of new clients via direct mobile bookings.

At Avartah Solutions, we engineer high-performance web systems and automated intake pipelines built to:
1. Turn search visitors into confirmed client bookings 24/7.
2. Establish search authority and dominate local search rankings in ${loc}.
3. Eliminate manual scheduling overhead via instant WhatsApp and calendar sync.

Would you have 10 minutes this Thursday or Friday for a brief consultation to review our bespoke growth recommendations for ${name}?

Warm regards,

Harrison Oyeghe
Principal Systems Architect | Avartah Solutions
harrison@avartah.com | https://avartah.com`;
  } else if (isBroken) {
    emailSubject = `Urgent Infrastructure & Uptime Recovery Notice for ${name} (${web})`;
    emailBody = `Dear ${name} Team,

I am reaching out from Avartah Solutions regarding your registered online address: ${web}.

Our automated digital monitoring platform identified that your domain is currently inaccessible or encountering severe server downtime (${prospect.website_evidence || 'HTTP connection failure'}). For a respected business like ${name} in ${loc}, prolonged digital downtime creates immediate client friction and directly redirects potential customers to local competitors.

We specialize in rapid web infrastructure recovery, zero-downtime cloud migration, and modern conversion architecture.

We would be pleased to assist your team in restoring and modernizing your platform today. Would you be available for a brief 10-minute diagnostic call?

Best regards,

Harrison Oyeghe
Principal Systems Architect | Avartah Solutions
harrison@avartah.com | https://avartah.com`;
  } else {
    emailSubject = `Performance Audit & Conversion Opportunities for ${name} (${score}/100)`;
    emailBody = `Dear ${name} Leadership,

I recently completed an evidence-based digital performance audit of ${name}'s website (${web}) in ${loc}.

Overall Digital Health Score: ${score}/100
Audit Findings: ${prospect.website_evidence || 'Mobile responsiveness and conversion funnel optimizations identified'}

While your brand presence is strong, our analysis identified high-leverage opportunities to significantly boost your visitor-to-client conversion rate:
• Mobile Viewport & Page Speed: Enhancing touch-target ergonomics and Core Web Vitals to prevent mobile visitor bounce.
• Automated Client Funnels: Embedding interactive consultation and appointment scheduling directly into the primary viewport.
• Authority & Schema Architecture: Structuring local business meta data for search engine supremacy in ${loc}.

At Avartah Solutions, we partner with industry leaders to transform standard websites into high-speed revenue engines.

Would you be open to a quick 10-minute walk-through this week where I can share our complete audit report and tactical recommendations?

Warm regards,

Harrison Oyeghe
Principal Systems Architect | Avartah Solutions
harrison@avartah.com | https://avartah.com`;
  }

  return {
    email: { subject: emailSubject, body: emailBody },
    whatsappMessage: waMsg
  };
}

/**
 * Escapes characters for Overpass QL regex queries to prevent injection.
 */
export function escapeOverpassValue(val: string): string {
  if (!val) return '';
  return val
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\^$.|?*+(){}\[\]]/g, '\\$&');
}

/**
 * Maps business category into expanded search synonyms and OSM tag pairs.
 * E.g., "spas" -> spa, wellness, massage, beauty salon.
 * E.g., "eateries" -> restaurant, cafe, diner, food establishment.
 */
export function expandBusinessCategory(categoryInput: string): {
  normalizedNiche: string;
  expandedTerms: string[];
  osmTagClauses: string[];
} {
  const raw = categoryInput.trim().toLowerCase();
  
  // Singularize common plural suffixes
  let baseNiche = raw;
  if (baseNiche.endsWith('ies')) {
    baseNiche = baseNiche.slice(0, -3) + 'y';
  } else if (baseNiche.endsWith('es') && !baseNiche.endsWith('ees') && !baseNiche.endsWith('oes') && !baseNiche.endsWith('ses')) {
    baseNiche = baseNiche.slice(0, -2);
  } else if (baseNiche.endsWith('s') && !baseNiche.endsWith('ss') && !baseNiche.endsWith('us')) {
    baseNiche = baseNiche.slice(0, -1);
  }

  const expansionMap: Record<string, { terms: string[]; osmClauses: string[] }> = {
    'spa': {
      terms: ['spa', 'wellness', 'massage', 'beauty salon', 'sauna'],
      osmClauses: [
        'nwr["leisure"="spa"]',
        'nwr["amenity"="spa"]',
        'nwr["shop"="massage"]',
        'nwr["shop"="beauty"]'
      ]
    },
    'wellness': {
      terms: ['wellness', 'spa', 'massage', 'therapy'],
      osmClauses: ['nwr["leisure"="spa"]', 'nwr["shop"="massage"]', 'nwr["healthcare"="alternative"]']
    },
    'massage': {
      terms: ['massage', 'spa', 'wellness', 'physiotherapy'],
      osmClauses: ['nwr["shop"="massage"]', 'nwr["leisure"="spa"]']
    },
    'eatery': {
      terms: ['restaurant', 'cafe', 'diner', 'bistro', 'food'],
      osmClauses: [
        'nwr["amenity"="restaurant"]',
        'nwr["amenity"="cafe"]',
        'nwr["amenity"="fast_food"]',
        'nwr["amenity"="food_court"]'
      ]
    },
    'restaurant': {
      terms: ['restaurant', 'diner', 'eatery', 'bistro', 'cafe'],
      osmClauses: [
        'nwr["amenity"="restaurant"]',
        'nwr["amenity"="cafe"]',
        'nwr["amenity"="fast_food"]'
      ]
    },
    'cafe': {
      terms: ['cafe', 'coffee shop', 'bakery', 'tea house'],
      osmClauses: ['nwr["amenity"="cafe"]', 'nwr["shop"="bakery"]', 'nwr["shop"="coffee"]']
    },
    'hotel': {
      terms: ['hotel', 'guest house', 'motel', 'resort', 'lodge'],
      osmClauses: [
        'nwr["tourism"="hotel"]',
        'nwr["tourism"="guest_house"]',
        'nwr["tourism"="motel"]',
        'nwr["tourism"="resort"]'
      ]
    },
    'gym': {
      terms: ['gym', 'fitness centre', 'fitness', 'sports centre', 'crossfit'],
      osmClauses: [
        'nwr["leisure"="fitness_centre"]',
        'nwr["leisure"="sports_centre"]'
      ]
    },
    'clinic': {
      terms: ['clinic', 'doctors', 'dental clinic', 'medical center', 'health center'],
      osmClauses: [
        'nwr["amenity"="clinic"]',
        'nwr["amenity"="doctors"]',
        'nwr["amenity"="dentist"]',
        'nwr["amenity"="hospital"]'
      ]
    },
    'dentist': {
      terms: ['dentist', 'dental clinic', 'orthodontist'],
      osmClauses: ['nwr["amenity"="dentist"]', 'nwr["amenity"="clinic"]']
    },
    'barber': {
      terms: ['barber', 'hairdresser', 'barbershop', 'salon'],
      osmClauses: ['nwr["shop"="hairdresser"]', 'nwr["shop"="beauty"]']
    },
    'salon': {
      terms: ['salon', 'beauty salon', 'hairdresser', 'spa'],
      osmClauses: ['nwr["shop"="beauty"]', 'nwr["shop"="hairdresser"]', 'nwr["leisure"="spa"]']
    },
    'pharmacy': {
      terms: ['pharmacy', 'chemist', 'drugstore'],
      osmClauses: ['nwr["amenity"="pharmacy"]']
    },
    'bakery': {
      terms: ['bakery', 'pastry shop', 'confectionery'],
      osmClauses: ['nwr["shop"="bakery"]', 'nwr["shop"="pastry"]']
    },
    'supermarket': {
      terms: ['supermarket', 'grocery', 'mini mart', 'convenience store'],
      osmClauses: [
        'nwr["shop"="supermarket"]',
        'nwr["shop"="convenience"]',
        'nwr["shop"="grocery"]'
      ]
    },
    'school': {
      terms: ['school', 'college', 'academy', 'kindergarten'],
      osmClauses: ['nwr["amenity"="school"]', 'nwr["amenity"="college"]']
    },
    'law firm': {
      terms: ['solicitors', 'lawyers', 'solicitor', 'law firm', 'lawyer', 'attorney', 'legal services', 'advocate'],
      osmClauses: [
        'nwr["office"="lawyer"]',
        'nwr["office"="legal"]',
        'nwr["office"~"law|legal",i]'
      ]
    },
    'law firms': {
      terms: ['solicitors', 'lawyers', 'solicitor', 'law firm', 'lawyer', 'attorney', 'legal services'],
      osmClauses: [
        'nwr["office"="lawyer"]',
        'nwr["office"="legal"]'
      ]
    },
    'lawyer': {
      terms: ['solicitors', 'solicitor', 'lawyer', 'lawyers', 'law firm', 'attorney', 'legal counsel'],
      osmClauses: ['nwr["office"="lawyer"]', 'nwr["office"="legal"]']
    },
    'solicitor': {
      terms: ['solicitors', 'solicitor', 'law firm', 'lawyer', 'legal services'],
      osmClauses: ['nwr["office"="lawyer"]', 'nwr["office"="legal"]']
    },
    'attorney': {
      terms: ['attorney', 'law firm', 'lawyer', 'legal services'],
      osmClauses: ['nwr["office"="lawyer"]', 'nwr["office"="legal"]']
    },
    'legal': {
      terms: ['legal services', 'solicitors', 'law firm', 'lawyer', 'attorney', 'solicitor'],
      osmClauses: ['nwr["office"="lawyer"]', 'nwr["office"="legal"]']
    },
    'furniture': {
      terms: ['furniture', 'furniture store', 'home decor', 'carpentry', 'interior design', 'sofa', 'cabinet maker'],
      osmClauses: [
        'nwr["shop"="furniture"]',
        'nwr["craft"="carpenter"]',
        'nwr["shop"="interior_decoration"]'
      ]
    },
    'auto repair': {
      terms: ['car repair', 'mechanic', 'auto repair', 'garage', 'tyre shop', 'car service'],
      osmClauses: [
        'nwr["shop"="car_repair"]',
        'nwr["shop"="car_parts"]',
        'nwr["shop"="tyres"]'
      ]
    },
    'mechanic': {
      terms: ['mechanic', 'car repair', 'auto repair', 'motor repair'],
      osmClauses: ['nwr["shop"="car_repair"]', 'nwr["shop"="car"]']
    },
    'real estate': {
      terms: ['real estate', 'estate agent', 'property management', 'realtor', 'letting agent'],
      osmClauses: ['nwr["office"="estate_agent"]', 'nwr["office"="property_management"]']
    },
    'accounting': {
      terms: ['accountant', 'accounting firm', 'tax consultant', 'bookkeeper', 'audit firm'],
      osmClauses: ['nwr["office"="accountant"]', 'nwr["office"="tax_advisor"]']
    },
    'accountant': {
      terms: ['accountant', 'accounting firm', 'tax advisor', 'financial consultant'],
      osmClauses: ['nwr["office"="accountant"]']
    },
    'cleaning': {
      terms: ['cleaning service', 'dry cleaner', 'laundry', 'commercial cleaning', 'janitorial'],
      osmClauses: ['nwr["shop"="laundry"]', 'nwr["shop"="dry_cleaning"]', 'nwr["craft"="cleaning"]']
    },
    'plumber': {
      terms: ['plumber', 'plumbing service', 'drainage', 'heating engineer'],
      osmClauses: ['nwr["craft"="plumber"]', 'nwr["craft"="hvac"]']
    },
    'electrician': {
      terms: ['electrician', 'electrical contractor', 'wiring service'],
      osmClauses: ['nwr["craft"="electrician"]']
    },
    'photography': {
      terms: ['photographer', 'photo studio', 'wedding photographer', 'video production'],
      osmClauses: ['nwr["shop"="photo"]', 'nwr["craft"="photographer"]']
    }
  };

  const matched = expansionMap[baseNiche];
  if (matched) {
    return {
      normalizedNiche: baseNiche,
      expandedTerms: matched.terms,
      osmTagClauses: matched.osmClauses
    };
  }

  // Default fallback for custom or unlisted categories
  const escaped = escapeOverpassValue(baseNiche);
  return {
    normalizedNiche: baseNiche,
    expandedTerms: [baseNiche],
    osmTagClauses: [
      `nwr["shop"~"${escaped}",i]`,
      `nwr["amenity"~"${escaped}",i]`,
      `nwr["tourism"~"${escaped}",i]`,
      `nwr["leisure"~"${escaped}",i]`,
      `nwr["craft"~"${escaped}",i]`,
      `nwr["office"~"${escaped}",i]`,
      `nwr["name"~"${escaped}",i]`
    ]
  };
}

/**
 * Splits a free-form search query into niche/business category and location/city independently.
 */
export function cleanQueryParts(query: string): { niche: string; location: string } {
  if (!query) return { niche: 'business', location: '' };

  const trimmed = query.trim();

  // Pattern: "<niche> in <location>"
  const inMatch = trimmed.match(/^(.+?)\s+in\s+(.+)$/i);
  if (inMatch) {
    return { niche: inMatch[1].trim(), location: inMatch[2].trim() };
  }

  // Pattern: "<niche>, <location>"
  const commaMatch = trimmed.match(/^(.+?),\s*(.+)$/);
  if (commaMatch && commaMatch[2].trim().length > 1) {
    return { niche: commaMatch[1].trim(), location: commaMatch[2].trim() };
  }

  // Pattern: "<location> <niche>" (e.g., "Benin City spas", "London restaurants", "Lagos law firms")
  const words = trimmed.split(/\s+/);
  if (words.length >= 3) {
    const lastTwo = `${words[words.length - 2]} ${words[words.length - 1]}`;
    const { expandedTerms } = expandBusinessCategory(lastTwo);
    if (expandedTerms.length > 1) {
      return { niche: lastTwo, location: words.slice(0, words.length - 2).join(' ') };
    }
  }

  if (words.length >= 2) {
    const lastWord = words[words.length - 1];
    const { expandedTerms } = expandBusinessCategory(lastWord);
    if (expandedTerms.length > 1 || ['spa', 'spas', 'gym', 'gyms', 'hotel', 'hotels', 'eatery', 'eateries', 'restaurant', 'restaurants', 'clinic', 'dentist', 'furniture', 'salon'].includes(lastWord.toLowerCase())) {
      return { niche: lastWord, location: words.slice(0, words.length - 1).join(' ') };
    }
  }

  return { niche: trimmed, location: trimmed };
}

/**
 * Parses an OpenStreetMap element (Node/Way/Relation) into standard discovery candidate format,
 * preserving published phone, email, website, and social contact tags.
 */
export function parseOsmElementToBusiness(element: any, defaultLocation: string = ''): {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  whatsapp_link: string | null;
  social_profiles?: Record<string, string>;
  type: string;
  source: string;
  source_provenance: {
    provider: string;
    osm_id: string | number;
    osm_type: string;
  };
} | null {
  if (!element || (!element.tags && !element.extratags)) return null;

  const tags = { ...(element.extratags || {}), ...(element.tags || {}) };
  const name = tags.name || tags['name:en'] || tags.brand || element.name || element.display_name?.split(',')[0];
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return null;
  }

  const lat = parseFloat(element.lat || element.center?.lat || 0);
  const lon = parseFloat(element.lon || element.center?.lon || 0);

  const houseNum = tags['addr:housenumber'] || '';
  const street = tags['addr:street'] || '';
  const city = tags['addr:city'] || tags['addr:suburb'] || tags['addr:town'] || defaultLocation;
  const addressParts = [houseNum, street, city].filter(Boolean);
  const location = addressParts.length > 0 ? addressParts.join(', ') : (element.display_name || defaultLocation);

  const rawPhone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || tags['phone:mobile'] || null;
  const rawEmail = tags.email || tags['contact:email'] || null;
  const rawWebsite = tags.website || tags['contact:website'] || tags.url || null;
  const rawWhatsapp = tags.whatsapp || tags['contact:whatsapp'] || null;

  const socialProfiles: Record<string, string> = {};
  const fb = tags['contact:facebook'] || tags.facebook;
  const ig = tags['contact:instagram'] || tags.instagram;
  const li = tags['contact:linkedin'] || tags.linkedin;
  const tw = tags['contact:twitter'] || tags.twitter;
  if (typeof fb === 'string' && fb.trim()) socialProfiles.facebook = fb.trim().startsWith('http') ? fb.trim() : `https://facebook.com/${fb.trim().replace(/^@/, '')}`;
  if (typeof ig === 'string' && ig.trim()) socialProfiles.instagram = ig.trim().startsWith('http') ? ig.trim() : `https://instagram.com/${ig.trim().replace(/^@/, '')}`;
  if (typeof li === 'string' && li.trim()) socialProfiles.linkedin = li.trim().startsWith('http') ? li.trim() : `https://linkedin.com/${li.trim().replace(/^\//, '')}`;
  if (typeof tw === 'string' && tw.trim()) socialProfiles.twitter = tw.trim().startsWith('http') ? tw.trim() : `https://x.com/${tw.trim().replace(/^@/, '')}`;

  let whatsappLink: string | null = null;
  if (typeof rawWhatsapp === 'string' && rawWhatsapp.trim()) {
    const waTrim = rawWhatsapp.trim();
    if (/^https?:\/\/(?:wa\.me|api\.whatsapp\.com)\//i.test(waTrim)) {
      whatsappLink = waTrim;
    } else {
      const digits = waTrim.replace(/\D/g, '');
      if (digits.length >= 7) whatsappLink = `https://wa.me/${digits}`;
    }
  }

  const type = tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.craft || tags.office || 'Business';
  const osmId = element.id || element.osm_id || 'item';
  const osmType = element.type || element.osm_type || 'node';
  const stableId = `osm-${osmType}-${osmId}`;

  return {
    id: stableId,
    name: name.trim(),
    location: location.trim(),
    latitude: lat,
    longitude: lon,
    phone: rawPhone ? String(rawPhone).trim() : null,
    email: rawEmail ? String(rawEmail).trim().toLowerCase() : null,
    website_url: rawWebsite ? String(rawWebsite).trim() : null,
    whatsapp_link: whatsappLink,
    ...(Object.keys(socialProfiles).length > 0 ? { social_profiles: socialProfiles } : {}),
    type,
    source: 'osm-overpass',
    source_provenance: {
      provider: 'osm-overpass',
      osm_id: osmId,
      osm_type: osmType
    }
  };
}
