import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { Post, Category } from '../types';
import { getBlogs } from '../lib/api';
import { ArrowLeft, ArrowUpRight, Search } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Link } from 'react-router-dom';

const MOCK_CATEGORIES: Category[] = [
  { id: '1', name: 'All', slug: 'all' },
  { id: '2', name: 'Engineering', slug: 'engineering' },
  { id: '3', name: 'UI/UX Design', slug: 'ui-ux-design' },
  { id: '4', name: 'System Architecture', slug: 'system-architecture' },
];

const BlogPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBlogs()
      .then((data) => setPosts(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredPosts = posts.filter(post => {
    const matchesCategory = activeCategory === 'all' || post.category?.slug === activeCategory;
    const matchesSearch = !searchQuery.trim() || 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] font-sans selection:bg-[#C58A52]/20 selection:text-[#C58A52]">
      <Helmet>
        <title>Technical Research & Articles | Avartah Solutions</title>
        <meta name="description" content="Technical research, systems architecture insights, and conversion engineering articles from Avartah Solutions." />
      </Helmet>

      <Navbar />
      
      <main className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-[#747C84] dark:hover:text-[#F2F1ED] transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Return to Main Platform</span>
          </Link>
        </div>
        
        {/* Header Hero */}
        <div className="text-left max-w-3xl mb-12">
          <div className="text-xs font-semibold text-[#C58A52] uppercase tracking-wider mb-2">
            Engineering Insights & Systems Architecture
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED] leading-tight mb-4">
            Research, Architecture & Conversion Notes
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
            In-depth technical write-ups covering relational database optimization, high-converting behavioral UX patterns, and automated acquisition workflows.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-8 mb-8 border-b border-slate-200 dark:border-[#30363B]">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {MOCK_CATEGORIES.map((category, catIdx) => (
              <button
                key={`blog-cat-${category.id || 'c'}-${catIdx}`}
                onClick={() => setActiveCategory(category.slug)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap ${
                  activeCategory === category.slug
                    ? 'bg-slate-900 dark:bg-[#202428] text-white dark:text-[#F2F1ED] font-semibold border border-slate-900 dark:border-[#C58A52]'
                    : 'bg-slate-100 dark:bg-[#171A1D] text-slate-600 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-[#F2F1ED] border border-slate-200 dark:border-[#30363B]'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative max-w-xs w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#747C84]" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] text-xs text-slate-900 dark:text-[#F2F1ED] placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors"
            />
          </div>
        </div>

        {/* Posts Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-lg border border-slate-200 dark:border-[#30363B] bg-slate-50 dark:bg-[#171A1D] h-64 animate-pulse" />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-200 dark:border-[#30363B] rounded-lg">
            <p className="text-xs text-slate-500 dark:text-[#747C84]">No research articles found matching your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post, postIdx) => (
              <div
                key={`blog-post-${post.id || post.slug || 'p'}-${postIdx}`}
                className="group p-6 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] hover:border-slate-400 dark:hover:border-[#747C84] transition-colors relative flex flex-col justify-between"
              >
                <Link to={`/blog/${post.slug}`} className="absolute inset-0 z-10" aria-label={`Read ${post.title}`} />
                
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#747C84] mb-3">
                    <span className="text-[#C58A52] font-medium">{post.category?.name || 'Architecture'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{post.reading_time || 5} min read</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(post.published_at)}</span>
                  </div>

                  <h2 className="text-lg font-bold mb-2 text-slate-900 dark:text-[#F2F1ED] group-hover:text-[#C58A52] transition-colors">
                    {post.title}
                  </h2>

                  <p className="text-xs text-slate-600 dark:text-[#A3A9AF] leading-relaxed line-clamp-3 mb-6">
                    {post.excerpt}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-[#30363B] flex items-center justify-between text-xs text-slate-500 dark:text-[#747C84]">
                  <span>{post.author?.full_name || 'V. Sterling'}</span>
                  <span className="inline-flex items-center gap-1 text-[#C58A52] font-medium">
                    Read Article <ArrowUpRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default BlogPage;
