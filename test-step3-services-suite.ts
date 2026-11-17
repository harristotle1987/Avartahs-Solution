import http from 'http';
import { AGENCY_SERVICES, getServiceBySlug, getEstablishedServices, getRoadmapServices } from './lib/servicesData';

function httpRequest(options: http.RequestOptions, postData?: any): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = postData ? (typeof postData === 'string' ? postData : JSON.stringify(postData)) : null;
    const headers = { ...(options.headers || {}) };
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({ ...options, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runStep3Tests() {
  console.log('====================================================');
  console.log('AVARTAH SOLUTIONS — STEP 3: SERVICES CATALOGUE TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, extra?: string) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc} ${extra ? `-> ${extra}` : ''}`);
      failed++;
    }
  }

  // TEST GROUP 1: Service Data Integrity
  console.log('--- TEST GROUP 1: Service Data Integrity & Catalog Completeness ---');
  assert('Services catalogue contains exactly 7 defined agency offerings', AGENCY_SERVICES.length === 7);

  const established = getEstablishedServices();
  const roadmap = getRoadmapServices();
  assert('Exactly 6 services are marked ESTABLISHED for immediate delivery', established.length === 6);
  assert('Exactly 1 service is marked ROADMAP for planned expansion', roadmap.length === 1 && roadmap[0].id === 'saas-platform-engineering');

  AGENCY_SERVICES.forEach((service) => {
    assert(
      `Service "${service.slug}" has all required fields populated`,
      Boolean(
        service.id &&
        service.slug &&
        service.title &&
        service.category &&
        service.badge &&
        service.summary.length > 20 &&
        service.businessProblem.length > 20 &&
        service.keyDeliverables.length >= 3 &&
        service.targetClients.length >= 2 &&
        service.techStack.length >= 2 &&
        service.typicalTimeline &&
        service.pricingEstimate
      )
    );

    if (service.status === 'ESTABLISHED') {
      const hasDualCurrency = service.pricingEstimate.includes('$') && service.pricingEstimate.includes('₦');
      assert(`Service "${service.slug}" quotes realistic international ($) and Nigerian (₦) pricing`, hasDualCurrency, service.pricingEstimate);
    }
  });

  const webDev = getServiceBySlug('website-design-development');
  assert('getServiceBySlug finds website-design-development correctly', webDev !== undefined && webDev.title === 'Website Design & Development');

  const aiService = getServiceBySlug('ai-integration-automation');
  assert('getServiceBySlug finds ai-integration-automation correctly', aiService !== undefined && aiService.category === 'Intelligent Systems');

  const invalidLookup = getServiceBySlug('non-existent-service');
  assert('getServiceBySlug returns undefined for unknown service slug', invalidLookup === undefined);

  // TEST GROUP 2: Frontend Route Serving
  console.log('\n--- TEST GROUP 2: Frontend Route Serving & Public Access ---');
  try {
    const resServices = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/services',
      method: 'GET'
    });
    assert('GET /services returns 200 OK (Public Service Catalogue)', resServices.statusCode === 200);
    assert('GET /services serves HTML document with scripts', resServices.body.includes('<!DOCTYPE html>') || resServices.body.includes('<html'));

    const resDetail = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/services/website-design-development',
      method: 'GET'
    });
    assert('GET /services/website-design-development returns 200 OK (SPA entry)', resDetail.statusCode === 200);

    const resAiDetail = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/services/ai-integration-automation',
      method: 'GET'
    });
    assert('GET /services/ai-integration-automation returns 200 OK (SPA entry)', resAiDetail.statusCode === 200);
  } catch (err: any) {
    assert('Frontend route serving error', false, err.message);
  }

  // TEST GROUP 3: Lead Capture with Service Context
  console.log('\n--- TEST GROUP 3: Lead Capture & Data Provenance with Service Context ---');
  try {
    const leadPayload = {
      session_id: `TEST-SRV-${Date.now()}`,
      target_url: 'Service: ecommerce-websites',
      user_email: 'service.client@example.com',
      user_phone: '+2348012345678',
      revenue_tier: '$1,000 - $5,000',
      core_problem: '[Service: E-Commerce Platforms & Stores] New Build: Custom Shopify store with Paystack/Flutterwave',
      cta_source: 'service-catalog:ecommerce-websites'
    };

    const leadRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/leads',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, leadPayload);

    assert('POST /api/leads with service-catalog source returns 200 OK', leadRes.statusCode === 200);
    const leadJson = JSON.parse(leadRes.body);
    assert('Lead response reports success: true', leadJson.success === true);
    assert('Lead response contains generated or preserved ID', Boolean(leadJson.id));
  } catch (err: any) {
    assert('Lead capture test failed', false, err.message);
  }

  // TEST GROUP 4: Security & Access Boundary Preservation
  console.log('\n--- TEST GROUP 4: Security Hardening & Admin Boundaries Intact ---');
  try {
    const adminRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/users',
      method: 'GET'
    });
    assert('GET /api/admin/users remains blocked without authentication (401)', adminRes.statusCode === 401);

    const prospectsRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/prospects',
      method: 'GET'
    });
    assert('GET /api/prospects remains protected (401)', prospectsRes.statusCode === 401);
  } catch (err: any) {
    assert('Security boundary test failed', false, err.message);
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep3Tests();
