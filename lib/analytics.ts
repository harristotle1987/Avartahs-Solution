import { initAnalytics, syncAnalytics } from './api';
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

export const analytics = {
  init() {
    try {
      this.syncInitial();
      
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
    try {
      await initAnalytics(session);
    } catch (e) {
      console.warn('Analytics Init Sync Failed', e);
    }
  },

  logCTAClick(source: 'hero' | 'footer' | 'navbar') {
    session.cta_clicks[source] = (session.cta_clicks[source] || 0) + 1;
    this.syncCurrent();
  },

  logHandshake(type: 'whatsapp' | 'calendly') {
    if (type === 'whatsapp') session.whatsapp_handshake = true;
    if (type === 'calendly') session.calendly_handshake = true;
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
    
    this.syncCurrent();
  },

  setSubmitted() {
    session.submitted = true;
    this.syncCurrent();
  },

  async syncCurrent() {
    try {
      await syncAnalytics(session);
    } catch (e) {
      console.warn('Analytics Sync Failed', e);
    }
  },

  flush() {
    const endTime = new Date();
    const startTime = new Date(session.session_start);
    session.duration_seconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    session.exit_page = window.location.pathname;

    // Use sendBeacon or similar for exit tracking if needed, 
    // but syncAnalytics is called on transition anyway.
    syncAnalytics(session).catch(e => console.warn('Analytics Flush Failed', e));
  }
};
