import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ArrowLeft, Star, MessageSquare, Send, User, Clock, Check } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Post, Category } from '../types';
import { getBlogBySlug } from '../lib/api';

const MOCK_CATEGORIES: Category[] = [
  { id: '1', name: 'All', slug: 'all' },
  { id: '2', name: 'Engineering', slug: 'engineering' },
  { id: '3', name: 'UI/UX Design', slug: 'ui-ux-design' },
  { id: '4', name: 'System Architecture', slug: 'system-architecture' },
];

export const ArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [hasRated, setHasRated] = useState(false);
  
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<{id: string, author: string, text: string, date: string}[]>([
    { id: '1', author: 'Alex Rivera', text: 'This obsidian aesthetic completely transformed our conversion rates. Amazing write-up.', date: '2 hours ago' },
    { id: '2', author: 'Jordan Lee', text: 'I love the psychological breakdown of why dark mode conveys security. Spot on.', date: '5 hours ago' }
  ]);

  const handleRating = (value: number) => {
    if (hasRated) return;
    setRating(value);
    setHasRated(true);
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    
    const newComment = {
      id: Date.now().toString(),
      author: 'Industry Peer',
      text: comment.trim(),
      date: 'Just now'
    };
    
    setComments([newComment, ...comments]);
    setComment('');
  };

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    if (slug) {
      getBlogBySlug(slug).then(setPost).catch(console.error);
    }
    window.scrollTo(0, 0);
  }, [slug]);

  if (!post) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#111315] flex items-center justify-center text-xs text-slate-500">
        Loading research article...
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#111315] text-slate-900 dark:text-[#F2F1ED] font-sans selection:bg-[#C58A52]/20 selection:text-[#C58A52]">
      {/* Sticky Top Reading Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-0.5 bg-[#C58A52] z-[100] origin-left"
        style={{ scaleX }}
      />
      
      <Navbar />

      <main className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <Link 
            to="/blog" 
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-[#747C84] dark:hover:text-[#F2F1ED] transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Back to Technical Articles</span>
          </Link>
        </div>

        <article>
          {/* Article Header */}
          <header className="mb-10 pb-8 border-b border-slate-200 dark:border-[#30363B]">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#747C84] mb-4">
              <span className="text-[#C58A52] font-semibold">{post.category?.name || 'Architecture'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{post.reading_time || 5} min read</span>
              <span aria-hidden="true">·</span>
              <span>{formatDate(post.published_at)}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-[#F2F1ED] mb-6 leading-tight [text-wrap:balance]">
              {post.title}
            </h1>

            <p className="text-base text-slate-600 dark:text-[#A3A9AF] leading-relaxed max-w-2xl">
              {post.excerpt}
            </p>

            <div className="flex items-center gap-3 pt-6 mt-6 border-t border-slate-100 dark:border-[#30363B]/60 text-xs text-slate-500 dark:text-[#747C84]">
              <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] flex items-center justify-center font-bold text-[#C58A52]">
                {post.author?.full_name ? post.author.full_name.charAt(0) : 'A'}
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-[#F2F1ED]">{post.author?.full_name || 'Avartah Solutions'}</div>
                <div className="text-[11px]">Lead Systems Architect</div>
              </div>
            </div>
          </header>

          {/* Article Prose Content */}
          <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base leading-relaxed space-y-6 text-slate-700 dark:text-[#A3A9AF]">
            {post.content ? (
              <div dangerouslySetInnerHTML={{ __html: post.content }} />
            ) : (
              <p>Full article content currently loading from Neon PostgreSQL.</p>
            )}
          </div>

          {/* Article Rating / Feedback Strip */}
          <div className="my-12 p-6 rounded-lg bg-slate-50 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-[#F2F1ED] uppercase tracking-wider">
                Was this technical analysis useful?
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-[#747C84]">
                Your feedback guides our ongoing systems research.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRating(star)}
                  onMouseEnter={() => !hasRated && setHoveredRating(star)}
                  onMouseLeave={() => !hasRated && setHoveredRating(0)}
                  disabled={hasRated}
                  className="p-1 transition-colors"
                  aria-label={`Rate ${star} stars`}
                >
                  <Star 
                    size={16} 
                    className={`${
                      (hoveredRating || rating) >= star 
                        ? 'fill-[#C58A52] text-[#C58A52]' 
                        : 'text-slate-300 dark:text-[#30363B]'
                    }`} 
                  />
                </button>
              ))}
              {hasRated && (
                <span className="text-xs text-[#C58A52] font-medium ml-2 flex items-center gap-1">
                  <Check size={12} /> Received
                </span>
              )}
            </div>
          </div>

          {/* Discussion & Peer Comments */}
          <div className="pt-8 border-t border-slate-200 dark:border-[#30363B] space-y-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#F2F1ED] uppercase tracking-wider">
              Discussion ({comments.length})
            </h3>

            {/* Comment Form */}
            <form onSubmit={submitComment} className="space-y-3">
              <textarea
                rows={3}
                placeholder="Share your perspective or implementation question..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] text-xs text-slate-900 dark:text-[#F2F1ED] placeholder:text-slate-400 dark:placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!comment.trim()}
                  className="px-4 py-2 bg-[#C58A52] hover:bg-[#D99B62] disabled:opacity-50 text-[#111315] font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Send size={12} />
                  <span>Post Perspective</span>
                </button>
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-3 pt-2">
              {comments.map((item) => (
                <div 
                  key={item.id} 
                  className="p-4 rounded-lg bg-slate-50 dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-[#F2F1ED]">{item.author}</span>
                    <span className="text-[11px] text-slate-500 dark:text-[#747C84]">{item.date}</span>
                  </div>
                  <p className="text-slate-600 dark:text-[#A3A9AF] leading-relaxed">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
};

export default ArticlePage;
