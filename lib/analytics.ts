import { sql, isNeonConfigured } from './neon';
import { SiteAnalytics } from '../types';

// Safe ID Generator
const generateUUID = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return 'anon-' + Math.random().toString(36).substr(2, 9);
  }
};

let session: SiteAnalytics = {
  visitor_id: generateUUID(),
  session_start: new Date().toISOString(),
  duration_seconds: 0,
  cta_clicks: { hero: 0, footer: 0, navbar: 0 },
  form_progress: 0,
  submitted: false,
  exit_page: window.location.pathname,
  step_durations: {},
  is_pricing_sensitive: false,
  whatsapp_handshake: false,
  calendly_handshake: false
};

let stepStartTime = Date.now();
const ANALYTICS_KEY = 'avartah_current_session';

export const analytics = {
  init() {
    try {
      const saved = localStorage.getItem(ANALYTICS_KEY);
      if (saved) {
        session = { ...session, ...JSON.parse(saved) };
      } else {
        localStorage.setItem(ANALYTICS_KEY, JSON.stringify(session));
        this.syncInitial();
      }
      
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush();
        }
      });
    } catch (e) {
      console.warn('Analytics Init Failed', e);
    }
  },

  async syncInitial() {
    if (!isNeonConfigured) return;
    try {
      await sql`
        INSERT INTO site_analytics (visitor_id, session_start, cta_clicks, form_progress, submitted, exit_page, is_pricing_sensitive)
        VALUES (${session.visitor_id}, ${session.session_start}, ${JSON.stringify(session.cta_clicks)}, ${session.form_progress}, ${session.submitted}, ${session.exit_page}, false)
      `;
    } catch (e) {
      console.warn('Analytics Init Sync Failed', e);
    }
  },

  logCTAClick(source: 'hero' | 'footer' | 'navbar') {
    session.cta_clicks[source] = (session.cta_clicks[source] || 0) + 1;
    this.saveLocal();
    this.syncCurrent();
  },

  logHandshake(type: 'whatsapp' | 'calendly') {
    if (type === 'whatsapp') session.whatsapp_handshake = true;
    if (type === 'calendly') session.calendly_handshake = true;
    this.saveLocal();
    this.syncCurrent();
  },

  updateFormProgress(step: number) {
    const now = Date.now();
    const duration = Math.floor((now - stepStartTime) / 1000);
    
    const prevStep = session.form_progress;
    if (prevStep > 0 && session.step_durations) {
      session.step_durations[prevStep] = (session.step_durations[prevStep] || 0) + duration;
      if (prevStep === 4 && duration > 30) {
        session.is_pricing_sensitive = true;
      }
    }

    session.form_progress = step;
    stepStartTime = now;
    
    this.saveLocal();
    this.syncCurrent();
  },

  setSubmitted() {
    session.submitted = true;
    this.saveLocal();
    this.syncCurrent();
  },

  saveLocal() {
    try {
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(session));
    } catch (e) {
      // Storage full or unavailable
    }
  },

  async syncCurrent() {
    if (!isNeonConfigured) return;
    try {
      await sql`
        UPDATE site_analytics 
        SET 
          cta_clicks = ${JSON.stringify(session.cta_clicks)}, 
          form_progress = ${session.form_progress},
          submitted = ${session.submitted},
          is_pricing_sensitive = ${session.is_pricing_sensitive},
          step_durations = ${JSON.stringify(session.step_durations)},
          whatsapp_handshake = ${session.whatsapp_handshake},
          calendly_handshake = ${session.calendly_handshake}
        WHERE visitor_id = ${session.visitor_id}
      `;
    } catch (e) {
      console.warn('Analytics Sync Failed', e);
    }
  },

  flush() {
    const endTime = new Date();
    const startTime = new Date(session.session_start);
    session.duration_seconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    session.exit_page = window.location.pathname;

    if (isNeonConfigured) {
      // For flush on exit, we use a fire-and-forget approach
      // Neon's driver uses fetch internally so this should be relatively safe
      sql`
        UPDATE site_analytics 
        SET 
          duration_seconds = ${session.duration_seconds},
          exit_page = ${session.exit_page},
          cta_clicks = ${JSON.stringify(session.cta_clicks)}, 
          form_progress = ${session.form_progress},
          submitted = ${session.submitted},
          is_pricing_sensitive = ${session.is_pricing_sensitive},
          step_durations = ${JSON.stringify(session.step_durations)},
          whatsapp_handshake = ${session.whatsapp_handshake},
          calendly_handshake = ${session.calendly_handshake}
        WHERE visitor_id = ${session.visitor_id}
      `.catch(e => console.warn('Analytics Flush Failed', e));
    }
  }
};
