import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { getBlogs } from '../lib/api';
import { Post } from '../types';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const BlogGrid: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, openLogin } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    let mounted = true;
    const fetchPosts = async () => {
      try {
        const data = await getBlogs();
        if (mounted) {
          setPosts(data || []);
        }
      } catch (e) {
        console.error('Failed to load blog posts:', e);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    fetchPosts();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  const categories = useMemo(() => {
    const base = ['All', 'Strategy', 'UI/UX', 'Architecture'];
    const dynamic = posts
      .map((p) => p.category?.name)
      .filter((name): name is string => Boolean(name));
    return Array.from(new Set([...base, ...dynamic]));
  }, [posts]);

  const filteredPosts =
    activeCategory === 'All'
      ? posts
      : posts.filter((p) => p.category?.name?.toLowerCase() === activeCategory.toLowerCase());

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-72 rounded-xl border border-slate-200 dark:border-[#30363B] bg-slate-100 dark:bg-[#171A1D] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-xl">
          <div className="text-xs font-mono font-semibold text-[#C58A52] uppercase tracking-wider">
            Research & Briefings
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-[#F2F1ED]">
            {isAuthenticated
              ? 'Published engineering insights will appear here'
              : 'Sign in to access technical briefings and architectural insights'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
            Our articles cover web architecture, conversion engineering, and practical business software workflows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {isAuthenticated ? (
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md border border-slate-200 dark:border-[#30363B] hover:border-[#C58A52] text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] transition-colors"
            >
              <span>Open Insights Hub</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openLogin({ returnTo: '/blog' })}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md border border-[#C58A52]/60 text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] hover:bg-[#C58A52] hover:text-[#111315] transition-colors"
            >
              <span>Sign In for Insights</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Scrollable Category Filter Tabs */}
      <div className="overflow-x-auto pb-2 mb-6">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] rounded-lg">
          {categories.map((cat) => (
            <button
              key={`blog-cat-${cat}`}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-white dark:bg-[#202428] text-slate-900 dark:text-[#F2F1ED] font-semibold'
                  : 'text-slate-600 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-[#F2F1ED]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Editorial Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredPosts.map((post, i) => (
            <motion.article
              key={`blog-grid-${post.id || post.slug || i}`}
              layout={!shouldReduceMotion}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.04 }}
              className="group rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] hover:border-[#C58A52]/60 transition-colors relative flex flex-col justify-between overflow-hidden"
            >
              <Link
                to={`/blog/${post.slug}`}
                className="absolute inset-0 z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C58A52] rounded-xl"
                aria-label={`Read ${post.title}`}
              />

              <div>
                {/* Consistent 16:9 Editorial Media Treatment */}
                <div className="aspect-[16/9] w-full bg-[#111315] border-b border-slate-200 dark:border-[#30363B] overflow-hidden relative">
                  {post.cover_image ? (
                    <img
                      src={post.cover_image}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-end justify-between p-5 bg-gradient-to-br from-[#171A1D] to-[#111315]">
                      <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#C58A52]">
                        {post.category?.name || 'Technical Insight'}
                      </span>
                      <span className="text-2xl font-editorial italic text-[#30363B]">A</span>
                    </div>
                  )}
                </div>

                <div className="p-5 sm:p-6">
                  {/* Unboxed Metadata */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#747C84] mb-2.5">
                    <span className="text-[#C58A52] font-medium">
                      {post.category?.name || 'Technical Insight'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{post.reading_time || 5} min read</span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold mb-2 text-slate-900 dark:text-[#F2F1ED] group-hover:text-[#C58A52] transition-colors leading-snug">
                    {post.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>
                </div>
              </div>

              <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 dark:border-[#30363B] flex items-center justify-between text-xs text-slate-500 dark:text-[#747C84]">
                <span>{post.author?.full_name || 'Avartah Engineering'}</span>
                <span className="inline-flex items-center gap-1 text-[#C58A52] font-semibold">
                  Read Article <ArrowUpRight size={12} aria-hidden="true" />
                </span>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BlogGrid;
