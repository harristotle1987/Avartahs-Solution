import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Post } from '../types';
import { saveBlog } from '../lib/api';

interface BlogComposerProps {
  post: Partial<Post> | null;
  onClose: () => void;
  onSave: () => void;
}

const BlogComposer: React.FC<BlogComposerProps> = ({ post, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Post> & { media_source_flag?: string }>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    cover_image: '',
    media_source_flag: 'file',
    ...(post || {})
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData({...formData, cover_image: e.target?.result as string});
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await saveBlog(formData);
    setIsSaving(false);
    onSave();
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.8 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="bg-white dark:bg-black /40 border border-white/[0.08] rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10">
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 dark:text-white   uppercase mb-2">Blog Composer</h2>
          <p className="text-[10px] font-bold text-slate-600 dark:text-white/60  /50  uppercase tracking-widest mb-10">Obsidian Engine Content Creation Protocol</p>
          
          <form onSubmit={handleSave} className="space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-2">
                 <label className="text-xs font-semibold tracking-[0.25em] text-slate-600 dark:text-white/60  /50  uppercase">Article Title</label>
                 <input 
                   type="text" 
                   value={formData.title}
                   onChange={e => setFormData({...formData, title: e.target.value})}
                   required
                   className="w-full bg-white dark:bg-black /40 border border-white/[0.08] text-slate-900 dark:text-white   focus:ring-2 focus:ring-blue-500/50 transition-all duration-300 rounded-xl px-5 py-4 outline-none font-medium"
                   placeholder="Enter high-impact title..."
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-semibold tracking-[0.25em] text-slate-600 dark:text-white/60  /50  uppercase">Slug / Permalink</label>
                 <input 
                   type="text" 
                   value={formData.slug}
                   onChange={e => setFormData({...formData, slug: e.target.value})}
                   required
                   className="w-full bg-white dark:bg-black /40 border border-white/[0.08] text-slate-900 dark:text-white   focus:ring-2 focus:ring-blue-500/50 transition-all duration-300 rounded-xl px-5 py-4 outline-none font-medium"
                   placeholder="e.g. architecting-obsidian"
                 />
               </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold tracking-[0.25em] text-slate-600 dark:text-white/60  /50  uppercase">Excerpt</label>
              <textarea 
                value={formData.excerpt}
                onChange={e => setFormData({...formData, excerpt: e.target.value})}
                required
                rows={2}
                className="w-full bg-white dark:bg-black /40 border border-white/[0.08] text-slate-900 dark:text-white   focus:ring-2 focus:ring-blue-500/50 transition-all duration-300 rounded-xl px-5 py-4 outline-none font-medium resize-none"
                placeholder="Brief summary for cards..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold tracking-[0.25em] text-slate-600 dark:text-white/60  /50  uppercase">Content (Markdown Base)</label>
              <textarea 
                value={formData.content}
                onChange={e => setFormData({...formData, content: e.target.value})}
                required
                rows={10}
                className="w-full bg-white dark:bg-black /40 border border-white/[0.08] text-slate-900 dark:text-white   focus:ring-2 focus:ring-blue-500/50 transition-all duration-300 rounded-xl px-5 py-4 outline-none font-medium font-mono text-sm leading-relaxed"
                placeholder="Start typing your mastery..."
              />
            </div>

            <div className="space-y-4">
              <label className="text-xs font-semibold tracking-[0.25em] text-slate-600 dark:text-white/60  /50  uppercase block mb-2">Hybrid Media Engine</label>
              
              <div className="flex gap-4 mb-4">
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, media_source_flag: 'file', cover_image: ''})}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.media_source_flag === 'file' ? 'bg-blue-500 text-slate-900 dark:text-white   shadow-lg' : 'bg-white/5  text-slate-600 dark:text-white/60  /50  hover:text-slate-900 dark:text-white  '}`}
                >
                   File Drop
                </button>
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, media_source_flag: 'external', cover_image: ''})}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.media_source_flag === 'external' ? 'bg-indigo-500 text-slate-900 dark:text-white   shadow-lg' : 'bg-white/5  text-slate-600 dark:text-white/60  /50  hover:text-slate-900 dark:text-white  '}`}
                >
                   External URL
                </button>
              </div>

              <AnimatePresence mode="wait">
                {formData.media_source_flag === 'file' ? (
                  <motion.div 
                    key="file"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div 
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      className="border-2 border-dashed border-black/10 dark:border-white/10  dark:border-black/10 dark:border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500/50 transition-colors bg-black/20"
                    >
                      {formData.cover_image && formData.media_source_flag === 'file' ? (
                         <div className="relative w-full max-w-sm rounded-lg overflow-hidden group">
                           <img src={formData.cover_image} alt="Preview" className="w-full h-auto" />
                           <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <span className="text-slate-900 dark:text-white   text-xs font-black uppercase tracking-widest bg-black/50 px-4 py-2 rounded-lg">Change Image</span>
                           </div>
                         </div>
                      ) : (
                        <>
                          
                          <p className="text-sm font-semibold text-slate-700 dark:text-white/70 ">Drag and drop premium cover image here</p>
                          <p className="text-[10px] text-slate-500 dark:text-white/50  /50  mt-2 uppercase tracking-widest">Supports high-res JPG, PNG, WEBP (Max 15MB)</p>
                        </>
                      )}
                      
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        id="coverUpload" 
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                      />
                      {!formData.cover_image && (
                         <button type="button" onClick={() => document.getElementById('coverUpload')?.click()} className="mt-6 px-6 py-2 bg-white/5 rounded-lg text-[10px] font-black text-slate-900 dark:text-white   hover:bg-white/10 transition-colors uppercase tracking-widest">
                           Browse Files
                         </button>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="external"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                     <input 
                       type="url" 
                       value={formData.cover_image || ''}
                       onChange={e => setFormData({...formData, cover_image: e.target.value})}
                       className="w-full bg-white dark:bg-black /40 border border-white/[0.08] text-slate-900 dark:text-white   focus:ring-2 focus:ring-indigo-500/50 transition-all duration-300 rounded-xl px-5 py-4 outline-none font-medium"
                       placeholder="https://example.com/premium-image.jpg"
                     />
                     {formData.cover_image && (
                        <div className="mt-4 rounded-xl overflow-hidden max-w-sm border border-black/10 dark:border-white/10  dark:border-black/10 dark:border-white/10">
                          <img src={formData.cover_image} alt="Preview" className="w-full h-auto" />
                        </div>
                     )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="pt-8 border-t border-white/[0.08]">
               <h3 className="text-xs font-semibold tracking-[0.25em] text-slate-600 dark:text-white/60  /50  uppercase mb-6">Smart Conditional Project Options</h3>
               
               <div className="space-y-6">
                 <div className="flex flex-col gap-3">
                   <label className="text-sm font-black text-slate-900 dark:text-white  ">Project Foundation Type</label>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <label className={`relative flex items-center justify-between p-4 cursor-pointer rounded-xl border transition-all duration-300 ${formData.has_website === true ? 'border-transparent bg-white dark:bg-black  ring-2 ring-blue-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'border-black/10 dark:border-white/10  dark:border-black/10 dark:border-white/10 bg-white dark:bg-black /30 hover:bg-white dark:bg-black /50 hover:border-white/20'}`}>
                       <input 
                         type="radio" 
                         name="hasWebsite" 
                         checked={formData.has_website === true} 
                         onChange={() => setFormData({...formData, has_website: true})}
                         className="hidden"
                       />
                       <div className="flex flex-col">
                         <span className="text-slate-800 dark:text-white/80  font-bold text-sm">Existing System</span>
                         <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500 dark:text-white/50  mt-1">Yes, I need a revamp</span>
                       </div>
                       <AnimatePresence>
                         {formData.has_website === true && (
                           <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                             
                           </motion.div>
                         )}
                       </AnimatePresence>
                     </label>
                     <label className={`relative flex items-center justify-between p-4 cursor-pointer rounded-xl border transition-all duration-300 ${formData.has_website === false ? 'border-transparent bg-white dark:bg-black  ring-2 ring-blue-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'border-black/10 dark:border-white/10  dark:border-black/10 dark:border-white/10 bg-white dark:bg-black /30 hover:bg-white dark:bg-black /50 hover:border-white/20'}`}>
                       <input 
                         type="radio" 
                         name="hasWebsite" 
                         checked={formData.has_website === false} 
                         onChange={() => setFormData({...formData, has_website: false})}
                         className="hidden"
                       />
                       <div className="flex flex-col">
                         <span className="text-slate-800 dark:text-white/80  font-bold text-sm">New Build</span>
                         <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500 dark:text-white/50  mt-1">No, I'm starting fresh</span>
                       </div>
                       <AnimatePresence>
                         {formData.has_website === false && (
                           <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                             
                           </motion.div>
                         )}
                       </AnimatePresence>
                     </label>
                   </div>
                 </div>

                 <AnimatePresence mode="wait">
                   {formData.has_website === true && (
                     <motion.div
                       key="yes-website"
                       initial={{ opacity: 0, height: 0 }}
                       animate={{ opacity: 1, height: 'auto' }}
                       exit={{ opacity: 0, height: 0 }}
                       transition={{ duration: 0.4 }}
                       className="overflow-hidden"
                     >
                       <div className="space-y-2 pt-2">
                         <label className="text-xs font-semibold tracking-[0.25em] text-slate-600 dark:text-white/60  /50  uppercase">Existing Website URL</label>
                         <input 
                           type="url" 
                           value={formData.website_url || ''}
                           onChange={e => setFormData({...formData, website_url: e.target.value})}
                           className="w-full bg-white dark:bg-black /40 border border-white/[0.08] text-slate-900 dark:text-white   focus:ring-2 focus:ring-blue-500/50 transition-all duration-300 rounded-xl px-5 py-4 outline-none font-medium"
                           placeholder="https://..."
                         />
                       </div>
                     </motion.div>
                   )}
                 </AnimatePresence>
               </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-5 bg-black/5 dark:bg-black/40 text-black rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-200 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 mt-8"
            >
              {isSaving ? (
                <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full" />
              ) : null}
              {isSaving ? 'Compiling Protocol...' : 'Publish to Obsidian Vault'}
            </button>

          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default BlogComposer;
