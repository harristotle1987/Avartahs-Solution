export interface ServiceItem {
  id: string;
  slug: string;
  title: string;
  category: 'Web Solutions' | 'Commerce Platforms' | 'Intelligent Systems' | 'Custom Software' | 'Business Intelligence' | 'Product Engineering';
  status: 'ESTABLISHED' | 'ROADMAP';
  badge: string;
  summary: string;
  businessProblem: string;
  keyDeliverables: string[];
  targetClients: string[];
  techStack: string[];
  typicalTimeline: string;
  pricingEstimate: string;
  iconName: string;
}

export const AGENCY_SERVICES: ServiceItem[] = [
  {
    id: 'web-design-dev',
    slug: 'website-design-development',
    title: 'Website Design & Development',
    category: 'Web Solutions',
    status: 'ESTABLISHED',
    badge: 'Core Service',
    summary: 'Bespoke, responsive, and performance-tuned web applications engineered for speed, high conversion, and accessibility.',
    businessProblem: 'Businesses with slow, visually dated, or unresponsive websites bleed prospective customers to competitors, suffer from high bounce rates, and rank poorly on international search engines.',
    keyDeliverables: [
      'Tailored responsive frontend built with React / TypeScript and Tailwind CSS',
      'Mobile-first layout optimized for Nigerian mobile networks and global high-speed connections',
      'Core Web Vitals compliance achieving <1.5s First Contentful Paint',
      'Technical SEO architecture (schema.org JSON-LD, OpenGraph tags, sitemaps)',
      'Secure SSL, analytics integration, and automated contact pipelines'
    ],
    targetClients: [
      'Professional services, legal, medical, and consulting firms',
      'Nigerian companies expanding to international markets',
      'Early-stage tech startups requiring an authoritative web presence'
    ],
    techStack: ['React 19', 'TypeScript', 'Tailwind CSS', 'Vite', 'Express.js', 'PostgreSQL'],
    typicalTimeline: '2 – 3 Weeks',
    pricingEstimate: 'From $450 / ₦650,000',
    iconName: 'Layout'
  },
  {
    id: 'ecommerce-websites',
    slug: 'ecommerce-websites',
    title: 'E-commerce Platforms & Storefronts',
    category: 'Commerce Platforms',
    status: 'ESTABLISHED',
    badge: 'Core Service',
    summary: 'Custom digital storefronts designed for high conversion, frictionless mobile checkout, and multi-currency global sales.',
    businessProblem: 'Complicated checkout journeys, lack of localized African payment rails (Paystack/Flutterwave), and clunky inventory systems cause high cart abandonment and lost repeat revenue.',
    keyDeliverables: [
      'Clean product catalog with multi-variant filtering, search, and inventory tracking',
      'Dual payment rails: Local Nigerian processing (Paystack/Flutterwave/Bank Transfer) and Global processing (Stripe)',
      'Automated customer receipts and WhatsApp order notification handshakes',
      'Streamlined 2-step checkout flow optimized for mobile conversions',
      'Full administrative ledger to manage orders, customer accounts, and stock levels'
    ],
    targetClients: [
      'Direct-to-Consumer (DTC) fashion, cosmetics, and lifestyle brands',
      'Wholesale merchants and regional distributors moving online',
      'Specialty retailers wanting independence from closed marketplace platforms'
    ],
    techStack: ['React', 'Node.js', 'PostgreSQL', 'Paystack API', 'Stripe API', 'Tailwind CSS'],
    typicalTimeline: '3 – 5 Weeks',
    pricingEstimate: 'From $800 / ₦1,200,000',
    iconName: 'ShoppingCart'
  },
  {
    id: 'website-redesign',
    slug: 'website-redesign-maintenance',
    title: 'Website Redesign & Continuous Maintenance',
    category: 'Web Solutions',
    status: 'ESTABLISHED',
    badge: 'Core Service',
    summary: 'Transform existing underperforming sites into modern growth engines with proactive maintenance, security patches, and performance tuning.',
    businessProblem: 'Legacy WordPress or template sites suffer from plugin bloat, vulnerability exploits, broken mobile layouts, and declining search engine rankings over time.',
    keyDeliverables: [
      'Full UX audit and identification of conversion bottlenecks and drop-off points',
      'Modern design overhaul retaining hard-earned SEO domain authority and URLs',
      'Routine dependency security patching, database backups, and SSL renewals',
      'Uptime and response-time monitoring with proactive bug fixing SLAs',
      'Content updates and speed re-optimizations on a monthly cadence'
    ],
    targetClients: [
      'Established businesses whose web presence has fallen behind current standards',
      'Companies wanting dedicated technical oversight without hiring in-house developers',
      'Sites experiencing sluggish load times or high bounce rates'
    ],
    techStack: ['Next.js/React', 'Cloudflare CDN', 'PostgreSQL', 'Sentry', 'TypeScript'],
    typicalTimeline: '1 – 3 Weeks',
    pricingEstimate: 'From $350 / ₦500,000',
    iconName: 'RefreshCw'
  },
  {
    id: 'ai-automation',
    slug: 'ai-integration-automation',
    title: 'AI Integration & Business Automation',
    category: 'Intelligent Systems',
    status: 'ESTABLISHED',
    badge: 'Specialized',
    summary: 'Custom LLM-powered assistants, automated customer qualification workflows, and intelligent business process automation.',
    businessProblem: 'Manual customer intake, repetitive email drafting, and delayed lead response times waste operational hours and result in lost high-value enquiries.',
    keyDeliverables: [
      'Conversational AI assistants for customer intake, pre-qualification, and FAQs',
      'Automated multi-channel response generation for Email and WhatsApp outreach',
      'Document parsing and structured data extraction from invoices and customer briefs',
      'Smart lead routing and CRM synchronization triggered immediately upon enquiry',
      'Internal knowledge base retrieval systems grounded in company SOPs'
    ],
    targetClients: [
      'B2B sales teams seeking faster inbound response times',
      'Customer support and reservation departments with high query volume',
      'Agencies and consultancies streamlining administrative pipelines'
    ],
    techStack: ['Gemini 2.5 Flash', 'NVIDIA NIM', 'Express.js', 'PostgreSQL', 'TypeScript'],
    typicalTimeline: '2 – 4 Weeks',
    pricingEstimate: 'From $650 / ₦950,000',
    iconName: 'Cpu'
  },
  {
    id: 'custom-business-apps',
    slug: 'business-software-applications',
    title: 'Business Software & Custom Web Applications',
    category: 'Custom Software',
    status: 'ESTABLISHED',
    badge: 'Custom Build',
    summary: 'Bespoke web applications and internal tools designed around your exact business logic, data models, and team permissions.',
    businessProblem: 'Off-the-shelf software rarely fits proprietary business operations, and per-user SaaS subscription pricing escalates rapidly as teams grow.',
    keyDeliverables: [
      'Tailored administrative dashboards with multi-tier Role-Based Access Control (RBAC)',
      'Secure relational PostgreSQL database architecture with automated backups',
      'Client portals with document sharing, booking logs, and status trackers',
      'Real-time data synchronization and live event tracking',
      'Comprehensive RESTful API documentation for internal and external integrations'
    ],
    targetClients: [
      'Logistics, supply chain, and fleet operators',
      'Healthcare and educational institutions managing client records',
      'Financial services, asset managers, and specialized consultancies'
    ],
    techStack: ['React 19', 'Express 5', 'Neon PostgreSQL', 'Tailwind CSS', 'TypeScript'],
    typicalTimeline: '4 – 8 Weeks',
    pricingEstimate: 'From $1,200 / ₦1,800,000',
    iconName: 'AppWindow'
  },
  {
    id: 'digital-solutions-bi',
    slug: 'digital-business-solutions',
    title: 'Digital Business Solutions & BI Dashboards',
    category: 'Business Intelligence',
    status: 'ESTABLISHED',
    badge: 'Analytics & Growth',
    summary: 'Interactive business intelligence dashboards, visitor funnel tracking, and automated KPI reporting to guide revenue decisions.',
    businessProblem: 'Business leaders make strategic bets without unified analytics, flying blind to visitor drop-off rates, marketing return on ad spend (ROAS), and sales velocity.',
    keyDeliverables: [
      'Interactive executive dashboards monitoring real-time visitors, bookings, and lead velocity',
      'Conversion funnel tracking mapping progress from landing through submission',
      'Automated email KPI digest reports generated for executives and department heads',
      'Geospatial customer distribution maps and audience segmentation',
      'Data ledger exports formatted for financial audits and management reviews'
    ],
    targetClients: [
      'Managing directors and executive teams requiring daily operational metrics',
      'Performance marketing agencies requiring transparent attribution tracking',
      'Multi-branch retail and service organizations'
    ],
    techStack: ['PostgreSQL', 'Chart.js / SVG Visualizers', 'React', 'TypeScript', 'Node.js'],
    typicalTimeline: '2 – 4 Weeks',
    pricingEstimate: 'From $550 / ₦800,000',
    iconName: 'BarChart3'
  },
  {
    id: 'saas-platform-engineering',
    slug: 'saas-platform-engineering',
    title: 'Multi-Tenant SaaS Platform Engineering',
    category: 'Product Engineering',
    status: 'ROADMAP',
    badge: 'Proposed / Upcoming Q2 2027',
    summary: 'End-to-end architecture transformation to turn proven internal tools into self-service, multi-tenant software-as-a-service products.',
    businessProblem: 'Agencies and software entrepreneurs want to commercialize their proprietary workflows as software subscriptions but lack multi-tenant database partitioning, automated billing, and workspace isolation.',
    keyDeliverables: [
      'Tenant isolation schemas (PostgreSQL Row-Level Security and workspace IDs)',
      'Stripe Billing / Paystack Subscriptions integration with tier quotas',
      'Self-service team invitation and role management (Owner, Admin, Member, Guest)',
      'Tenant-level audit logs and rate-limiting enforcement',
      'Custom subdomain / white-label routing architecture'
    ],
    targetClients: [
      'Software entrepreneurs and agency owners productizing services',
      'Companies with proven internal software seeking secondary recurring revenue streams'
    ],
    techStack: ['Neon PostgreSQL RLS', 'React 19', 'Stripe Billing', 'Express 5', 'Docker'],
    typicalTimeline: 'Currently in Planned Roadmap (Inquire for Early Discovery)',
    pricingEstimate: 'Roadmap Milestone — Early Discovery Available',
    iconName: 'Layers'
  }
];

export const SERVICE_CATEGORIES = [
  'All Services',
  'Web Solutions',
  'Commerce Platforms',
  'Intelligent Systems',
  'Custom Software',
  'Business Intelligence',
  'Product Engineering'
] as const;

export const SERVICES_CATALOGUE = AGENCY_SERVICES;

export function getServiceBySlug(slug: string): ServiceItem | undefined {
  return AGENCY_SERVICES.find((s: ServiceItem) => s.slug === slug || s.id === slug);
}

export function getEstablishedServices(): ServiceItem[] {
  return AGENCY_SERVICES.filter((s: ServiceItem) => s.status === 'ESTABLISHED');
}

export function getRoadmapServices(): ServiceItem[] {
  return AGENCY_SERVICES.filter((s: ServiceItem) => s.status === 'ROADMAP');
}
