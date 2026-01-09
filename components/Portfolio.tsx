
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ExternalLink, Cpu, Layout, MessageSquare, Camera, Download, Loader2, AlertCircle, Activity } from 'lucide-react';

const projects = [
  { 
    title: "FitLife Pro Ecosystem", 
    category: "Bio-Metric Architecture", 
    description: "Bio-Sovereignty Engine designed to stop revenue leaks via multi-tier governance. Features an AI-driven Command Console with real-time biometric telemetry and Amethyst-to-Emerald logic states.", 
    realScreenshot: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop", 
    link: "https://avartahs-solution-fxzc.vercel.app/#/", 
    icon: <Activity size={14} />, 
    metrics: "Real-time Sync Node" 
  },
  { 
    title: "Restaurantly AI Engine", 
    category: "Full-Stack + AI", 
    description: "Elegant conversational commerce platform for high-end dining. Features a core Chatbot that processes bookings and orders with zero friction.", 
    realScreenshot: "https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=2070&auto=format&fit=crop", 
    link: "https://restau-model.onrender.com/", 
    icon: <MessageSquare size={14} />, 
    metrics: "Sub-second API latency" 
  },
  { 
    title: "Harry's Blog Ecosystem", 
    category: "Python + ML", 
    description: "Minimalist productivity blog. Integrated an AI Persona acting as a subject matter expert to increase user retention and engagement.", 
    realScreenshot: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=2070&auto=format&fit=crop", 
    link: "https://harryblog.onrender.com/", 
    icon: <Cpu size={14} />, 
    metrics: "+60% Engagement" 
  },
  { 
    title: "Gourmet House Interface", 
    category: "Frontend Excellence", 
    description: "High-performance luxury culinary UI. Includes a 'Behind the Scenes' gallery and engineered reservation protocols for fine dining.", 
    realScreenshot: "https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=2070&auto=format&fit=crop", 
    link: "https://restaurant-website-eta-ten.vercel.app/", 
    icon: <Layout size={14} />, 
    metrics: "100/100 Performance" 
  }
];

const PortfolioCard: React.FC<{ project: typeof projects[0], index: number }> = ({ project, index }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      whileInView={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.8, delay: index * 0.1 }} 
      viewport={{ once: true }} 
      className="group relative bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden shadow-lab hover:border-sunset/30 transition-all duration-500 flex flex-col h-full"
    >
      <div className="relative aspect-[16/11] w-full overflow-hidden bg-slate-50">
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
            <Loader2 className="text-sunset animate-spin" size={24} />
          </div>
        )}
        <motion.img 
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          src={project.realScreenshot} 
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover filter brightness-95 group-hover:brightness-100 group-hover:scale-105 transition-all duration-700 ease-in-out"
          alt={project.title}
        />
        <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 z-20">
          <a href={project.link} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-midnight shadow-lg border border-slate-100 hover:bg-sunset hover:text-white transition-all transform active:scale-95">
            <ExternalLink size={16} />
          </a>
        </div>
      </div>

      <div className="p-8 md:p-10 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-4">
          <span className="p-1.5 bg-slate-50 dark:bg-white/5 text-sunset rounded-lg">{project.icon}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">{project.category}</span>
        </div>
        <h3 className="text-2xl font-bold text-midnight dark:text-white tracking-tighter leading-tight mb-4 group-hover:text-sunset transition-colors">{project.title}</h3>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed mb-8 flex-1">{project.description}</p>
        <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-between mt-auto">
          <a href={project.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-midnight dark:text-white hover:text-sunset transition-colors group/btn">
            LAUNCH SYSTEM <ArrowUpRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
          </a>
          <span className="text-[9px] font-black text-green-500 uppercase">{project.metrics}</span>
        </div>
      </div>
    </motion.div>
  );
};

const Portfolio: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
    {projects.map((p, i) => <PortfolioCard key={p.title} project={p} index={i} />)}
  </div>
);

export default Portfolio;
