const fs = require('fs');
const content = fs.readFileSync('pages/ArticlePage.tsx', 'utf8');
const replacement = `          </div>

          {/* Feedback & Discussion Section */}
          <div className="max-w-3xl mx-auto mt-24 pt-16 border-t border-black/10 dark:border-white/10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-16">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Did you find this valuable?</h3>
                <p className="text-sm text-slate-600 dark:text-white/60">Your feedback helps us curate better engineering insights.</p>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    disabled={hasRated}
                    onClick={() => handleRating(star)}
                    onMouseEnter={() => !hasRated && setHoveredRating(star)}
                    onMouseLeave={() => !hasRated && setHoveredRating(0)}
                    className="focus:outline-none transition-transform hover:scale-110 disabled:hover:scale-100"
                  >
                    <Star 
                      size={32} 
                      className={\`transition-colors duration-300 \${
                        (hasRated ? star <= rating : star <= hoveredRating) 
                          ? 'fill-indigo-500 text-indigo-500 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]' 
                          : 'text-slate-300 dark:text-white/20'
                      }\`} 
                    />
                  </button>
                ))}
                {hasRated && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }}
                    className="ml-4 text-[10px] font-bold text-emerald-500 uppercase tracking-widest"
                  >
                    Thank you!
                  </motion.span>
                )}
              </div>
            </div>

            <div className="mb-12">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 mb-8">
                <MessageSquare className="text-indigo-500" size={24} />
                Discussion ({comments.length})
              </h3>
              
              <form onSubmit={submitComment} className="mb-12 relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <div className="relative bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-[2rem] p-4 flex flex-col md:flex-row gap-4 items-end md:items-center backdrop-blur-md transition-all duration-300 focus-within:border-indigo-500/50">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0 self-start md:self-auto">
                    <User size={18} className="text-slate-400 dark:text-white/40" />
                  </div>
                  <textarea 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your thoughts or technical suggestions..."
                    className="flex-1 bg-transparent border-none outline-none resize-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 py-2 min-h-[60px]"
                  />
                  <button 
                    type="submit"
                    disabled={!comment.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl p-3 md:px-6 md:py-3 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="hidden md:inline">Post</span>
                    <Send size={16} />
                  </button>
                </div>
              </form>

              <div className="space-y-6">
                <AnimatePresence>
                  {comments.map((c) => (
                    <motion.div 
                      key={c.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-50 dark:bg-white/5 rounded-2xl p-6 border border-black/5 dark:border-white/5"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                          {c.author.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">{c.author}</div>
                          <div className="text-[10px] text-slate-500 dark:text-white/40 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                            <Clock size={10} /> {c.date}
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-700 dark:text-white/70 text-sm leading-relaxed">{c.text}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </article>`;
fs.writeFileSync('pages/ArticlePage.tsx', content.replace('          </div>\n        </article>', replacement));
