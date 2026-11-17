
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2, Plus } from 'lucide-react';
import { Post } from '../types';
import { deleteBlog, saveBlog } from '../lib/api';
import BlogComposer from './BlogComposer';

interface BlogCMSProps {
  blogs: Post[];
  onRefresh: () => void;
}

export default function BlogCMS({ blogs, onRefresh }: BlogCMSProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingBlog, setEditingBlog] = useState<Partial<Post> | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blog post?')) return;
    await deleteBlog(id);
    onRefresh();
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-midnight text-xl font-black uppercase tracking-tighter">Blog Management</h2>
          <p className="text-[10px] font-bold text-slate-600 dark:text-white/60 uppercase tracking-widest">Create and manage your articles</p>
        </div>
        <button 
          onClick={() => { setEditingBlog({}); setIsEditing(true); }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg hover:shadow-indigo-600/25"
        >
           <Plus size={14} strokeWidth={3} />
           Write New Post
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {blogs.map((post, bIdx) => (
          <motion.div 
            key={`blog-cms-${post.id || post.slug || 'p'}-${bIdx}`} 
            className="bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-3xl overflow-hidden shadow-lab"
          >
            <div className="aspect-video bg-white dark:bg-black relative">
              <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" />
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button 
                  onClick={() => { setEditingBlog(post); setIsEditing(true); }}
                  className="p-3 bg-white/90 dark:bg-black/90  text-indigo-600 dark:text-indigo-400 rounded-2xl hover:scale-110 hover:bg-white dark:hover:bg-black transition-all shadow-lg border border-black/5 dark:border-white/10"
                  title="Edit Post"
                >
                  <Edit2 size={16} strokeWidth={2.5} />
                </button>
                <button 
                  onClick={() => handleDelete(post.id)}
                  className="p-3 bg-white/90 dark:bg-black/90  text-red-500 dark:text-red-400 rounded-2xl hover:scale-110 hover:bg-white dark:hover:bg-black transition-all shadow-lg border border-black/5 dark:border-white/10"
                  title="Delete Post"
                >
                  <Trash2 size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{post.title}</h3>
              <p className="text-sm text-slate-600 dark:text-white/60 line-clamp-2">{post.excerpt}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-white/80 dark:bg-black/80 ">
          <div className="bg-white dark:bg-black w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl p-8 relative">
            <button 
              onClick={() => setIsEditing(false)}
              className="absolute top-4 right-4 p-3 bg-black/5 dark:bg-white/5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors z-50"
            >
              ✕
            </button>
             <BlogComposer 
               // Need to figure out the props for BlogComposer
               post={editingBlog}
               onClose={() => setIsEditing(false)}
               onSave={() => { setIsEditing(false); onRefresh(); }}
             />
          </div>
        </div>
      )}
    </div>
  );
}
