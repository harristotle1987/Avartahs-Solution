import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  MapPin,
  Globe,
  Briefcase,
  DollarSign,
  ExternalLink,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
  Filter,
  RefreshCw,
  RotateCcw,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { NormalizedJob, JobSearchFilters, isSafeJobUrl } from '../lib/jobs';
import { buildAuthHeaders } from '../lib/auth';

export const JobFinderPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [country, setCountry] = useState('');
  const [remotePreference, setRemotePreference] = useState('all');
  const [jobType, setJobType] = useState('all');
  const [experienceLevel, setExperienceLevel] = useState('all');
  const [datePosted, setDatePosted] = useState('all');

  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [submittedCriteria, setSubmittedCriteria] = useState<JobSearchFilters | null>(null);

  const [results, setResults] = useState<NormalizedJob[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [sourcesTelemetry, setSourcesTelemetry] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ totalDiscovered: 0, totalUnique: 0, sourcesQueried: 0 });
  const [searchTimestamp, setSearchTimestamp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getAuthHeaders = (): Record<string, string> => {
    return buildAuthHeaders();
  };

  // Only fetch bookmarks on page mount - strictly no provider search on mount
  const fetchSavedJobs = async () => {
    try {
      const res = await fetch('/api/jobs/saved', {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSavedJobs(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch saved jobs:', e);
    }
  };

  useEffect(() => {
    fetchSavedJobs();
  }, []);

  // Explicit user-triggered search action only
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Prevent uncontrolled duplicate requests while in progress
    if (loading) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setCurrentPage(1);

    const activeFilters: JobSearchFilters = {
      query: query.trim(),
      location: location.trim(),
      country: country.trim(),
      remotePreference,
      jobType,
      experienceLevel,
      datePosted
    };

    setSubmittedCriteria(activeFilters);

    try {
      const res = await fetch('/api/jobs/search', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(activeFilters),
        signal: controller.signal
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Search failed with status ${res.status}`);
      }

      const data = await res.json();
      setResults(Array.isArray(data.jobs) ? data.jobs : (Array.isArray(data.results) ? data.results : []));
      setSourcesTelemetry(Array.isArray(data.sourcesTelemetry) ? data.sourcesTelemetry : []);
      setMetrics(data.metrics || { totalDiscovered: 0, totalUnique: 0, sourcesQueried: 0 });
      setSearchTimestamp(data.searchTimestamp || new Date().toISOString());
      setHasSearched(true);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Error communicating with live job providers');
        setHasSearched(true);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  };

  const handleResetFilters = () => {
    setQuery('');
    setLocation('');
    setCountry('');
    setRemotePreference('all');
    setJobType('all');
    setExperienceLevel('all');
    setDatePosted('all');
    setResults([]);
    setError(null);
    setHasSearched(false);
    setSubmittedCriteria(null);
    setCurrentPage(1);
  };

  const handleSaveJob = async (job: NormalizedJob) => {
    try {
      const res = await fetch('/api/jobs/save', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ jobId: job.id, job })
      });
      if (res.ok) {
        showToast(`Saved "${job.title}" at ${job.company}`);
        fetchSavedJobs();
      } else {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to save job');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoveSaved = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/save/${encodeURIComponent(jobId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        showToast('Removed job from bookmarks');
        fetchSavedJobs();
      } else {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to remove bookmark');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to remove bookmark', 'error');
    }
  };

  const isJobSaved = (jobId: string) => {
    return savedJobs.some(s => s.job_id === jobId || s.id === jobId);
  };

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, results.length);
  const paginatedResults = results.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }
  };

  // Source telemetry status breakdown
  const failedSources = sourcesTelemetry.filter(s => !s.success);
  const successfulSources = sourcesTelemetry.filter(s => s.success);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navigation */}
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black text-lg shadow-lg shadow-emerald-500/20">
              A
            </div>
            <div>
              <span className="font-black text-lg tracking-tighter uppercase">Avartah Solutions</span>
              <span className="block text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Multi-Source Job Intelligence</span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'search' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Live Job Search
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'saved' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Saved Jobs ({savedJobs.length})
            </button>
          </div>
          <Link
            to="/"
            className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
          >
            Back to Home
          </Link>
        </div>
      </header>

      {/* Hero Search Section */}
      <section className="relative px-6 py-10 md:py-14 bg-gradient-to-b from-emerald-950/30 via-slate-950 to-slate-950 border-b border-white/10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Live Multi-Source Aggregator
          </div>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white mb-3">
            Find High-Impact Roles Across Verified Sources
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto font-medium">
            Search genuine openings across enterprise ATS boards (GitLab, Cloudflare, Canonical, Elastic), Remotive, Arbeitnow, Jobicy, and RemoteOK. Direct application destinations and zero invented listings.
          </p>
        </div>

        {/* Search Bar Form */}
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSearch} className="bg-slate-900/90 border border-white/15 rounded-3xl p-3 md:p-4 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row gap-3">
            <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
              <Search className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
              <label htmlFor="job-query-input" className="sr-only">Job title or keyword</label>
              <input
                id="job-query-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Job title, skill, or keyword (e.g. React, Engineer, Designer)..."
                className="w-full bg-transparent text-sm font-bold text-white placeholder:text-slate-500 outline-none"
              />
            </div>

            <div className="w-full md:w-44 flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
              <MapPin className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
              <label htmlFor="job-location-input" className="sr-only">City or region</label>
              <input
                id="job-location-input"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City / Region..."
                className="w-full bg-transparent text-sm font-bold text-white placeholder:text-slate-500 outline-none"
              />
            </div>

            <div className="w-full md:w-36 flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
              <Globe className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
              <label htmlFor="job-country-input" className="sr-only">Country</label>
              <input
                id="job-country-input"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country (e.g. UK, US)..."
                className="w-full bg-transparent text-sm font-bold text-white placeholder:text-slate-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                disabled={loading}
                aria-label="Search Jobs"
                className="w-full md:w-auto px-7 py-3.5 bg-emerald-500 hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
                <span>{loading ? 'Searching…' : 'Search Jobs'}</span>
              </button>

              <button
                type="button"
                onClick={handleResetFilters}
                aria-label="Reset Search Filters"
                title="Reset all search criteria and filters"
                className="p-3.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-2xl transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </form>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-4 px-2">
            <div className="flex flex-wrap items-center gap-3">
              {/* Remote Preference */}
              <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                  Remote:
                </span>
                {['all', 'remote', 'hybrid', 'onsite'].map((pref) => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => setRemotePreference(pref)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer focus-visible:ring-1 focus-visible:ring-emerald-400 ${remotePreference === pref ? 'bg-emerald-500 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  >
                    {pref}
                  </button>
                ))}
              </div>

              {/* Job Type Dropdown */}
              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                <Briefcase className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <label htmlFor="job-type-select" className="sr-only">Job Type</label>
                <select
                  id="job-type-select"
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-200 uppercase tracking-wider outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-white">All Job Types</option>
                  <option value="full_time" className="bg-slate-900 text-white">Full-Time</option>
                  <option value="part_time" className="bg-slate-900 text-white">Part-Time</option>
                  <option value="contract" className="bg-slate-900 text-white">Contract</option>
                  <option value="intern" className="bg-slate-900 text-white">Internship</option>
                </select>
              </div>

              {/* Experience Level Dropdown */}
              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <label htmlFor="experience-level-select" className="sr-only">Experience Level</label>
                <select
                  id="experience-level-select"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-200 uppercase tracking-wider outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-white">All Levels</option>
                  <option value="entry" className="bg-slate-900 text-white">Entry / Junior</option>
                  <option value="mid" className="bg-slate-900 text-white">Mid Level</option>
                  <option value="senior" className="bg-slate-900 text-white">Senior / Lead</option>
                </select>
              </div>

              {/* Date Posted Dropdown */}
              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                <Clock className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <label htmlFor="date-posted-select" className="sr-only">Date Posted</label>
                <select
                  id="date-posted-select"
                  value={datePosted}
                  onChange={(e) => setDatePosted(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-200 uppercase tracking-wider outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-white">Any Time</option>
                  <option value="24h" className="bg-slate-900 text-white">Past 24 Hours</option>
                  <option value="7d" className="bg-slate-900 text-white">Past 7 Days</option>
                  <option value="30d" className="bg-slate-900 text-white">Past 30 Days</option>
                </select>
              </div>
            </div>

            {searchTimestamp && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Search Freshness: {new Date(searchTimestamp).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Active Submitted Criteria Display */}
          {submittedCriteria && (
            <div className="mt-4 px-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-bold text-slate-300">Active Criteria:</span>
              <span>Keyword: &quot;{submittedCriteria.query || 'Any'}&quot;</span>
              <span aria-hidden="true">·</span>
              <span>Location: &quot;{submittedCriteria.location || 'Any'}&quot;</span>
              {submittedCriteria.country && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Country: &quot;{submittedCriteria.country}&quot;</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>Remote: {submittedCriteria.remotePreference}</span>
              <span aria-hidden="true">·</span>
              <span>Type: {submittedCriteria.jobType}</span>
              <span aria-hidden="true">·</span>
              <span>Level: {submittedCriteria.experienceLevel}</span>
              <span aria-hidden="true">·</span>
              <span>Posted: {submittedCriteria.datePosted}</span>
            </div>
          )}
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        {activeTab === 'search' ? (
          <div className="space-y-8">
            {/* Sources Telemetry Banner */}
            {sourcesTelemetry.length > 0 && (
              <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">Live Source Telemetry & Status</h3>
                    <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                      Discovered {metrics.totalDiscovered} raw listings across {metrics.sourcesQueried} providers; deduplicated into {metrics.totalUnique} unique opportunities.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                      Live Verified API Feeds
                    </span>
                  </div>
                </div>

                {/* Partial Provider Outage Notice */}
                {failedSources.length > 0 && (
                  <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-2.5 text-amber-300 text-xs font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" aria-hidden="true" />
                    <span>
                      Notice: {failedSources.length} of {sourcesTelemetry.length} sources ({failedSources.map(s => s.sourceName).join(', ')}) experienced temporary latency. Results from active providers are displayed below.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sourcesTelemetry.map((src, i) => (
                    <div key={i} className="p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-black text-white flex items-center gap-1.5">
                          {src.success ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                          )}
                          <span>{src.sourceName}</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1">
                          {src.success ? `${src.jobsCount} listings · ${src.latencyMs}ms` : (src.error || 'Provider timeout')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error banner with Retry Action */}
            {error && (
              <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-red-400 text-xs font-bold">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSearch()}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500 hover:text-white border border-red-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer w-fit"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Retry Search</span>
                </button>
              </div>
            )}

            {/* Results Section */}
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-white">
                    Search Results ({results.length})
                  </h3>
                  {results.length > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Showing {startIndex + 1}–{endIndex} of {results.length} genuine vacancies
                    </p>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  Direct employer & verified source links
                </span>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-400" aria-hidden="true" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Querying live job providers concurrently...</p>
                </div>
              ) : !hasSearched ? (
                /* Initial state before user has clicked search */
                <div className="text-center py-24 bg-slate-900/40 border border-white/10 rounded-[2.5rem]">
                  <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" aria-hidden="true" />
                  <h4 className="text-base font-black uppercase text-white mb-1">Ready to Discover Roles</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Enter keywords, location, or remote preference and click &quot;Search Jobs&quot; to fetch live vacancies directly from verified providers.
                  </p>
                </div>
              ) : results.length === 0 ? (
                /* Genuine empty state */
                <div className="text-center py-24 bg-slate-900/40 border border-white/10 rounded-[2.5rem]">
                  <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-4" aria-hidden="true" />
                  <h4 className="text-sm font-black uppercase text-white mb-1">No matching opportunities found</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                    No active listings matched the exact query and filters. Try broadening keywords, removing specific country filters, or setting remote preference to &quot;all&quot;.
                  </p>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Clear All Filters
                  </button>
                </div>
              ) : (
                <>
                  {/* Results Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {paginatedResults.map((job, idx) => {
                      const saved = isJobSaved(job.id);
                      const safeUrl = isSafeJobUrl(job.application_url);

                      return (
                        <div
                          key={`job-${job.id || 'id'}-${idx}`}
                          className="bg-slate-900/80 border border-white/10 rounded-[2rem] p-6 hover:border-emerald-500/50 transition-all flex flex-col justify-between shadow-lg relative group"
                        >
                          <div>
                            {/* Card Header: Source & Bookmark */}
                            <div className="flex justify-between items-start gap-4 mb-2">
                              <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                                  {job.source_name}
                                </span>
                                <h4 className="text-lg font-black text-white tracking-tight mt-1 group-hover:text-emerald-400 transition-colors">
                                  {job.title}
                                </h4>
                              </div>

                              <button
                                type="button"
                                onClick={() => (saved ? handleRemoveSaved(job.id) : handleSaveJob(job))}
                                aria-label={saved ? `Remove bookmark for ${job.title}` : `Bookmark ${job.title}`}
                                className={`p-3 rounded-2xl border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 ${saved ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
                                title={saved ? 'Remove saved job' : 'Save job'}
                              >
                                {saved ? <BookmarkCheck className="w-4 h-4" aria-hidden="true" /> : <Bookmark className="w-4 h-4" aria-hidden="true" />}
                              </button>
                            </div>

                            {/* Clean unboxed metadata with typographic separators */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-3">
                              <span className="font-bold text-slate-200">{job.company}</span>
                              <span aria-hidden="true">·</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                                {job.location || 'Remote'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{job.remote_status}</span>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-400">
                                {job.posted_at ? new Date(job.posted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Undated listing'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className={job.status === 'ACTIVE' ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                                {job.status === 'ACTIVE' ? 'Direct ATS Active' : 'Public Feed Listing'}
                              </span>
                            </div>

                            {/* Salary (if provided) */}
                            {job.salary_min && (
                              <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 mb-3">
                                <DollarSign className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>
                                  {job.salary_min.toLocaleString()}
                                  {job.salary_max ? ` – ${job.salary_max.toLocaleString()}` : '+'} {job.currency || 'USD'}
                                </span>
                              </div>
                            )}

                            {/* Description snippet */}
                            <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed mb-6">
                              {job.description ? job.description.replace(/<[^>]*>?/gm, '') : job.title}
                            </p>
                          </div>

                          {/* Card Footer: Match score & Safe application link */}
                          <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                              Match: <strong className="text-emerald-400">{job.match_score}%</strong> ({job.match_reason})
                            </span>

                            {safeUrl ? (
                              <a
                                href={job.application_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Apply for ${job.title} at ${job.company} on external site`}
                                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-emerald-500 hover:text-slate-950 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md focus-visible:ring-2 focus-visible:ring-emerald-400"
                              >
                                <span>Apply on Site</span>
                                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                              </a>
                            ) : (
                              <button
                                disabled
                                aria-disabled="true"
                                className="px-5 py-2.5 bg-white/5 text-slate-500 rounded-xl text-xs font-bold uppercase tracking-wider opacity-60 cursor-not-allowed"
                                title="Application URL is not available or failed safety verification"
                              >
                                <span>Link Unavailable</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <nav
                      aria-label="Job Search Results Pagination"
                      className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-900/60 border border-white/10 rounded-2xl"
                    >
                      <div className="text-xs font-bold text-slate-400">
                        Page {currentPage} of {totalPages} ({results.length} total vacancies)
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage <= 1}
                          aria-label="Previous Page"
                          className="px-3.5 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                          <span>Prev</span>
                        </button>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                            .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                            .map((page, idx, arr) => {
                              const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                              return (
                                <React.Fragment key={`page-btn-${page}`}>
                                  {showEllipsis && <span className="px-2 text-slate-500 text-xs">…</span>}
                                  <button
                                    type="button"
                                    onClick={() => handlePageChange(page)}
                                    aria-current={currentPage === page ? 'page' : undefined}
                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${currentPage === page ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                  >
                                    {page}
                                  </button>
                                </React.Fragment>
                              );
                            })}
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage >= totalPages}
                          aria-label="Next Page"
                          className="px-3.5 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </nav>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          /* Saved Jobs Tab */
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white">Bookmarked Opportunities</h3>
                <p className="text-xs text-slate-400 mt-0.5">Private bookmarks associated with your authenticated session</p>
              </div>
              <span className="text-xs font-bold text-slate-400">{savedJobs.length} Saved Roles</span>
            </div>

            {savedJobs.length === 0 ? (
              <div className="text-center py-24 bg-slate-900/40 border border-white/10 rounded-[2.5rem]">
                <Bookmark className="w-12 h-12 text-slate-600 mx-auto mb-4" aria-hidden="true" />
                <h4 className="text-sm font-black uppercase text-white mb-1">No Saved Jobs Yet</h4>
                <p className="text-xs text-slate-400">Click the bookmark icon on any job card in the search tab to save it to your dashboard.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {savedJobs.map((job, idx) => {
                  const safeUrl = isSafeJobUrl(job.application_url);
                  return (
                    <div key={`saved-${job.saved_id || job.id || 'job'}-${idx}`} className="bg-slate-900/80 border border-white/10 rounded-[2rem] p-6 flex flex-col justify-between shadow-lg">
                      <div>
                        <div className="flex justify-between items-start gap-4 mb-2">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                              {job.source_name || 'Verified Source'}
                            </span>
                            <h4 className="text-lg font-black text-white tracking-tight mt-1">{job.title}</h4>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveSaved(job.id)}
                            aria-label={`Remove bookmark for ${job.title}`}
                            className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-2xl transition-all cursor-pointer"
                            title="Remove bookmark"
                          >
                            <BookmarkCheck className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-3">
                          <span className="font-bold text-slate-200">{job.company}</span>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                            {job.location || 'Remote'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{job.remote_status}</span>
                        </div>

                        <p className="text-xs text-slate-400 line-clamp-2 mb-6">
                          {job.description ? job.description.replace(/<[^>]*>?/gm, '') : job.title}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                          Saved: {new Date(job.saved_at || job.created_at || Date.now()).toLocaleDateString()}
                        </span>
                        {safeUrl ? (
                          <a
                            href={job.application_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Apply for ${job.title} at ${job.company} on external site`}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-400 transition-all shadow-md"
                          >
                            <span>Apply Now</span>
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          </a>
                        ) : (
                          <button
                            disabled
                            aria-disabled="true"
                            className="px-5 py-2.5 bg-white/5 text-slate-500 rounded-xl text-xs font-bold uppercase tracking-wider opacity-60 cursor-not-allowed"
                          >
                            <span>Link Unavailable</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6 text-center text-xs font-bold text-slate-500 uppercase tracking-widest mt-auto">
        Avartah Solutions • Multi-Source Job Intelligence Engine
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 text-xs font-bold uppercase tracking-wider ${toast.type === 'error' ? 'bg-red-500 text-white border-red-600' : 'bg-emerald-500 text-slate-950 border-emerald-400'}`}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobFinderPage;
