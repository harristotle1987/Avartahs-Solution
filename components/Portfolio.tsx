
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ExternalLink, Cpu, Layout, MessageSquare, Camera, Download, Loader2, AlertCircle, Activity, Globe, ChevronDown, ChevronUp, ZoomIn, X, RotateCcw, Maximize, Minimize } from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { getProjects } from '../lib/mockApi';
import { Project } from '../types';

const PortfolioCard: React.FC<{ project: Project, index: number }> = ({ project, index }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const media = project.media || [];
  const currentMedia = media[activeMediaIdx];
  const category = project.tags?.[0] || 'Solution';
  const metrics = project.tags?.[1] || 'Optimized';

  const nextMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(1);
    setActiveMediaIdx((prev) => (prev + 1) % media.length);
    setIsLoaded(false);
  };

  const prevMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(-1);
    setActiveMediaIdx((prev) => (prev - 1 + media.length) % media.length);
    setIsLoaded(false);
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        whileInView={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.8, delay: index * 0.1 }} 
        viewport={{ once: true }} 
        className="group relative bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden shadow-lab hover:border-sunset/30 transition-all duration-500 flex flex-col h-full"
      >
        <div className="relative aspect-[16/11] w-full overflow-hidden bg-slate-50">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={activeMediaIdx}
              custom={direction}
              initial={{ opacity: 0, x: direction * 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -direction * 50 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0"
            >
              {!isLoaded && !hasError && currentMedia?.type === 'image' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
                  <Loader2 className="text-sunset animate-spin" size={24} />
                </div>
              )}
              
              {currentMedia?.type === 'video' ? (
                currentMedia.url.includes('youtube.com/embed') ? (
                  <iframe 
                    src={currentMedia.url}
                    className="w-full h-full border-0 filter brightness-95 group-hover:brightness-100 transition-all duration-700 ease-in-out"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video 
                    src={currentMedia.url} 
                    className="w-full h-full object-cover filter brightness-95 group-hover:brightness-100 transition-all duration-700 ease-in-out"
                    autoPlay 
                    muted 
                    loop 
                    playsInline
                  />
                )
              ) : currentMedia?.url ? (
                <img 
                  src={currentMedia.url} 
                  onLoad={() => setIsLoaded(true)}
                  onError={() => setHasError(true)}
                  className="w-full h-full object-cover filter brightness-95 group-hover:brightness-100 transition-all duration-700 ease-in-out"
                  alt={project.title}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-300">
                  <Globe size={48} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Zoom Overlay */}
          <div className="absolute inset-0 bg-midnight/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 pointer-events-none">
            <button 
              onClick={() => setIsZoomed(true)}
              className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/30 hover:bg-white/40 transition-all pointer-events-auto transform scale-90 group-hover:scale-100 duration-500"
            >
              <ZoomIn size={20} />
            </button>
          </div>

          {media.length > 1 && (
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 z-20">
              {media.map((_, i) => (
                <button 
                  key={i} 
                  onClick={(e) => { e.stopPropagation(); setActiveMediaIdx(i); }}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeMediaIdx ? 'bg-sunset w-4' : 'bg-white/40 hover:bg-white/60'}`}
                />
              ))}
            </div>
          )}

          {media.length > 1 && (
            <div className="absolute inset-y-0 inset-x-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
              <button 
                onClick={prevMedia}
                className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all pointer-events-auto"
              >
                <ChevronDown className="rotate-90" size={14} />
              </button>
              <button 
                onClick={nextMedia}
                className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all pointer-events-auto"
              >
                <ChevronUp className="rotate-90" size={14} />
              </button>
            </div>
          )}

          {project.link && (
            <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 z-20">
              <a href={project.link} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-midnight shadow-lg border border-slate-100 hover:bg-sunset hover:text-white transition-all transform active:scale-95">
                <ExternalLink size={16} />
              </a>
            </div>
          )}
        </div>

        <div className="p-8 md:p-10 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-4">
            <span className="p-1.5 bg-slate-50 dark:bg-white/5 text-sunset rounded-lg">
              <Activity size={14} />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">{category}</span>
          </div>
          <h3 className="text-2xl font-bold text-midnight dark:text-white tracking-tighter leading-tight mb-4 group-hover:text-sunset transition-colors">{project.title}</h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed mb-8 flex-1">{project.description}</p>
          <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-between mt-auto">
            {project.link ? (
              <a href={project.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-midnight dark:text-white hover:text-sunset transition-colors group/btn">
                LAUNCH SYSTEM <ArrowUpRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
              </a>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Internal System</span>
            )}
            <span className="text-[9px] font-black text-green-500 uppercase">{metrics}</span>
          </div>
        </div>
      </motion.div>

      {/* Zoom Modal */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-midnight/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-10 group/modal"
            onClick={() => setIsZoomed(false)}
          >
            {/* Exit Button - Bottom Center */}
            <button 
              className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/60 hover:text-white transition-all group z-[510]"
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomed(false);
              }}
            >
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300 border border-white/10 shadow-2xl backdrop-blur-md">
                <X size={28} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-0 group-hover:opacity-100 transition-opacity">Exit View</span>
            </button>
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-7xl w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {currentMedia?.type === 'video' ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  {currentMedia.url.includes('youtube.com/embed') ? (
                    <iframe 
                      src={`${currentMedia.url}?autoplay=1`}
                      className="w-full aspect-video max-w-4xl rounded-2xl shadow-2xl border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video 
                      src={currentMedia.url} 
                      className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl"
                      controls
                      autoPlay 
                    />
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <TransformWrapper
                    initialScale={1}
                    initialPositionX={0}
                    initialPositionY={0}
                  >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                      <React.Fragment>
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-[520] bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10 opacity-0 group-hover/modal:opacity-100 transition-opacity">
                          <button onClick={() => zoomIn()} className="p-2 text-white hover:text-sunset transition-colors"><ZoomIn size={20} /></button>
                          <button onClick={() => zoomOut()} className="p-2 text-white hover:text-sunset transition-colors"><Minimize size={20} /></button>
                          <button onClick={() => resetTransform()} className="p-2 text-white hover:text-sunset transition-colors"><RotateCcw size={20} /></button>
                        </div>
                        <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                          <img 
                            src={currentMedia.url} 
                            className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl cursor-zoom-in active:cursor-grabbing"
                            alt={project.title}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                        </TransformComponent>
                      </React.Fragment>
                    )}
                  </TransformWrapper>
                </div>
              )}

              {media.length > 1 && (
                <>
                  <button 
                    onClick={prevMedia}
                    className="absolute left-0 md:-left-16 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all"
                  >
                    <ChevronDown className="rotate-90" size={24} />
                  </button>
                  <button 
                    onClick={nextMedia}
                    className="absolute right-0 md:-right-16 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all"
                  >
                    <ChevronUp className="rotate-90" size={24} />
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const ProjectSkeleton = () => (
  <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/5 rounded-[2.5rem] overflow-hidden shadow-lab flex flex-col h-full animate-pulse">
    <div className="aspect-[16/11] w-full bg-slate-100 dark:bg-white/5" />
    <div className="p-8 md:p-10 space-y-4">
      <div className="h-4 w-24 bg-slate-100 dark:bg-white/5 rounded" />
      <div className="h-8 w-full bg-slate-100 dark:bg-white/5 rounded" />
      <div className="h-20 w-full bg-slate-100 dark:bg-white/5 rounded" />
      <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex justify-between">
        <div className="h-4 w-20 bg-slate-100 dark:bg-white/5 rounded" />
        <div className="h-4 w-16 bg-slate-100 dark:bg-white/5 rounded" />
      </div>
    </div>
  </div>
);

const Portfolio: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await getProjects();
        setProjects(data);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
        {[1, 2, 3].map((i) => <ProjectSkeleton key={i} />)}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[3rem]">
        <Globe className="mx-auto text-slate-200 dark:text-white/5 mb-4" size={48} />
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">No Projects Deployed</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
      {projects.map((p, i) => <PortfolioCard key={p.id} project={p} index={i} />)}
    </div>
  );
};

export default Portfolio;
