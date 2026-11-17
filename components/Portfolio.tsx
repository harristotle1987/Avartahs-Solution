import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import {
  ArrowRight,
  ExternalLink,
  ZoomIn,
  Minimize,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { getProjects } from '../lib/api';
import { Project, SectionId } from '../types';

interface NormalizedMediaItem {
  url: string;
  type: 'image' | 'video';
  name: string;
}

function getNormalizedMedia(project: Project): NormalizedMediaItem[] {
  const fromArray = Array.isArray(project.media)
    ? project.media.filter((item) => item && typeof item.url === 'string' && item.url.trim().length > 0)
    : [];

  if (fromArray.length > 0) {
    return fromArray;
  }

  if (typeof project.image_url === 'string' && project.image_url.trim().length > 0) {
    return [
      {
        url: project.image_url.trim(),
        type: 'image',
        name: project.title,
      },
    ];
  }

  return [];
}

const BrandedProjectPlaceholder: React.FC<{ title: string; category: string }> = ({
  title,
  category,
}) => (
  <div className="w-full h-full bg-[#111315] text-[#F2F1ED] relative flex flex-col justify-between p-6 overflow-hidden">
    <div
      aria-hidden="true"
      className="absolute inset-0 opacity-20"
      style={{
        backgroundImage:
          'linear-gradient(to right, #30363B 1px, transparent 1px), linear-gradient(to bottom, #30363B 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    />
    <div
      aria-hidden="true"
      className="absolute -bottom-10 -right-10 w-44 h-44 rounded-full bg-[#C58A52]/15 blur-2xl"
    />

    <div className="relative z-10 flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.18em] text-[#C58A52]">
      <span>Avartah Systems</span>
      <span>{category}</span>
    </div>

    <div className="relative z-10 flex items-end justify-between gap-4">
      <div className="text-base sm:text-lg font-bold text-[#F2F1ED] leading-snug max-w-sm">
        {title}
      </div>
      <div className="w-9 h-9 rounded-md border border-[#30363B] bg-[#171A1D] flex items-center justify-center text-[#C58A52] font-bold text-xs shrink-0">
        A
      </div>
    </div>
  </div>
);

const PortfolioCard: React.FC<{ project: Project; index: number }> = ({ project, index }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const media = getNormalizedMedia(project);
  const currentMedia = media[activeMediaIdx];
  const category = project.category || project.tags?.[0] || 'Web Platform';
  const liveUrl = project.live_url || project.demo_url || project.link;

  useEffect(() => {
    if (!isZoomed) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsZoomed(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isZoomed]);

  const nextMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(1);
    setHasError(false);
    setIsLoaded(false);
    setActiveMediaIdx((prev) => (prev + 1) % media.length);
  };

  const prevMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(-1);
    setHasError(false);
    setIsLoaded(false);
    setActiveMediaIdx((prev) => (prev - 1 + media.length) % media.length);
  };

  const canPreviewInLightbox = Boolean(currentMedia && currentMedia.url && !hasError);

  return (
    <>
      <motion.article
        initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: index * 0.06 }}
        viewport={{ once: true, margin: '-40px' }}
        className="group flex flex-col rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] hover:border-[#C58A52]/60 transition-colors overflow-hidden"
      >
        {/* Prominent 16:9 Media Frame */}
        <div className="relative aspect-video w-full overflow-hidden bg-[#111315] border-b border-slate-200 dark:border-[#30363B]">
          <button
            type="button"
            onClick={() => {
              if (canPreviewInLightbox) setIsZoomed(true);
            }}
            disabled={!canPreviewInLightbox}
            aria-label={canPreviewInLightbox ? `Inspect ${project.title} preview` : project.title}
            className={`w-full h-full block text-left relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C58A52] ${
              canPreviewInLightbox ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={activeMediaIdx}
                custom={direction}
                initial={shouldReduceMotion ? false : { opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -direction * 30 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
              >
                {!isLoaded && !hasError && currentMedia?.type === 'image' && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#111315]">
                    <div className="w-5 h-5 rounded-full border-2 border-t-[#C58A52] border-[#30363B] animate-spin" />
                  </div>
                )}

                {currentMedia?.type === 'video' ? (
                  currentMedia.url.includes('youtube.com/embed') ? (
                    <iframe
                      src={currentMedia.url}
                      title={`${project.title} video preview`}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={currentMedia.url}
                      className="w-full h-full object-cover"
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  )
                ) : currentMedia?.url && !hasError ? (
                  <img
                    src={currentMedia.url}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => {
                      setHasError(true);
                      setIsLoaded(true);
                    }}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    alt={`${project.title} — ${category}`}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                ) : (
                  <BrandedProjectPlaceholder title={project.title} category={category} />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Bottom Gradient Readability Scrim over image */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent"
            />

            {canPreviewInLightbox && (
              <span
                aria-hidden="true"
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white p-1.5 rounded-md"
              >
                <ZoomIn size={14} />
              </span>
            )}
          </button>

          {media.length > 1 && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center items-center gap-2 z-20">
              <button
                type="button"
                onClick={prevMedia}
                className="p-1.5 rounded-md bg-black/75 text-white hover:bg-black transition-colors"
                aria-label="Previous project media"
              >
                <ChevronLeft size={13} />
              </button>
              <div className="flex gap-1.5">
                {media.map((_, i) => (
                  <span
                    key={`dot-${project.id || 'proj'}-${i}`}
                    className={`w-1.5 h-1.5 rounded-full ${
                      i === activeMediaIdx ? 'bg-[#C58A52]' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={nextMedia}
                className="p-1.5 rounded-md bg-black/75 text-white hover:bg-black transition-colors"
                aria-label="Next project media"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Image-Led Card Copy & Action */}
        <div className="p-5 sm:p-6 flex items-start justify-between gap-4 flex-1">
          <div className="space-y-1.5 min-w-0">
            <div className="text-[11px] font-mono font-semibold text-[#C58A52] uppercase tracking-wider">
              {category}
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-[#F2F1ED] group-hover:text-[#C58A52] transition-colors">
              {project.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed line-clamp-2">
              {project.description}
            </p>
          </div>

          <div className="shrink-0 pt-1">
            {liveUrl ? (
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${project.title} live project`}
                className="w-10 h-10 rounded-full border border-slate-200 dark:border-[#30363B] hover:border-[#C58A52] text-slate-700 dark:text-[#F2F1ED] hover:text-[#C58A52] inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
              >
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            ) : canPreviewInLightbox ? (
              <button
                type="button"
                onClick={() => setIsZoomed(true)}
                aria-label={`Inspect ${project.title} visual`}
                className="w-10 h-10 rounded-full border border-slate-200 dark:border-[#30363B] hover:border-[#C58A52] text-slate-700 dark:text-[#F2F1ED] hover:text-[#C58A52] inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
              >
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </motion.article>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isZoomed && currentMedia && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsZoomed(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`${project.title} preview`}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
          >
            <div
              className="relative max-w-5xl w-full max-h-[90vh] bg-[#111315] border border-[#30363B] rounded-xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363B] text-xs">
                <div>
                  <span className="font-semibold text-[#F2F1ED]">{project.title}</span>
                  <span className="mx-2 text-[#747C84]">·</span>
                  <span className="text-[#C58A52]">{category}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsZoomed(false)}
                  aria-label="Close project preview"
                  className="p-1.5 text-[#A3A9AF] hover:text-[#F2F1ED] rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex items-center justify-center p-2 bg-[#171A1D] relative">
                {currentMedia.type === 'video' ? (
                  currentMedia.url.includes('youtube.com/embed') ? (
                    <iframe
                      src={currentMedia.url}
                      title={project.title}
                      className="w-full aspect-video max-h-[75vh] border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={currentMedia.url}
                      controls
                      className="max-h-[75vh] w-auto rounded"
                    />
                  )
                ) : (
                  <TransformWrapper>
                    {({ zoomIn, zoomOut, resetTransform }) => (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <div className="absolute top-4 right-4 z-20 flex gap-1.5 bg-black/70 p-1 rounded-md border border-[#30363B]">
                          <button
                            type="button"
                            onClick={() => zoomIn()}
                            aria-label="Zoom in"
                            className="p-1.5 text-white hover:text-[#C58A52]"
                          >
                            <ZoomIn size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => zoomOut()}
                            aria-label="Zoom out"
                            className="p-1.5 text-white hover:text-[#C58A52]"
                          >
                            <Minimize size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => resetTransform()}
                            aria-label="Reset zoom"
                            className="p-1.5 text-white hover:text-[#C58A52]"
                          >
                            <RotateCcw size={14} />
                          </button>
                        </div>
                        <TransformComponent
                          wrapperClass="!w-full !h-full flex items-center justify-center"
                          contentClass="flex items-center justify-center"
                        >
                          <img
                            src={currentMedia.url}
                            alt={project.title}
                            className="max-h-[75vh] object-contain rounded"
                          />
                        </TransformComponent>
                      </div>
                    )}
                  </TransformWrapper>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export const Portfolio: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjects(6, 0)
      .then((data) => setProjects(data || []))
      .catch((err) => console.error('Failed to load portfolio projects:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((n) => (
          <div
            key={n}
            className="rounded-xl border border-slate-200 dark:border-[#30363B] bg-slate-100 dark:bg-[#171A1D] aspect-[16/11] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="p-8 sm:p-10 rounded-xl border border-slate-200 dark:border-[#30363B] bg-white dark:bg-[#171A1D] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-bold text-slate-900 dark:text-[#F2F1ED]">
            Project showcase updates in progress
          </div>
          <p className="text-xs text-slate-600 dark:text-[#A3A9AF]">
            Walk through recent web platforms and software builds directly during a strategy consultation.
          </p>
        </div>
        <a
          href={`#${SectionId.Booking}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C58A52] hover:underline shrink-0"
        >
          <span>Request Private Walkthrough</span>
          <ArrowRight size={13} aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {projects.map((project, idx) => (
        <PortfolioCard key={`proj-${project.id || 'id'}-${idx}`} project={project} index={idx} />
      ))}
    </div>
  );
};

export default Portfolio;
