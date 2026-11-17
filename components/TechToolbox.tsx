
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link as ScrollLink } from 'react-scroll';
import { SectionId } from '../types';
import { Zap, Target, Search, BarChart3, X, ChevronRight } from 'lucide-react';

const nodes = [
  { 
    id: 'speed', 
    title: 'Speed Analysis', 
    icon: Zap,
    x: '15%', 
    y: '20%',
    description: 'Deep-dive into Core Web Vitals and server response times. We identify bottlenecks that cause user bounce and kill conversions.',
    details: [
      'LCP (Largest Contentful Paint) Optimization',
      'TTFB (Time to First Byte) Reduction',
      'Asset Compression & Edge Delivery',
      'Render-blocking Resource Elimination'
    ],
    color: 'electric'
  },
  { 
    id: 'heatmap', 
    title: 'Heatmap Tracking', 
    icon: BarChart3,
    x: '85%', 
    y: '25%',
    description: 'Visualizing user friction through click maps and scroll depth analysis. We see exactly where users get stuck or lose interest.',
    details: [
      'Click & Move Heatmaps',
      'Scroll Depth Tracking',
      'Attention Maps',
      'Session Recording Analysis'
    ],
    color: 'sunset'
  },
  { 
    id: 'seo', 
    title: 'SEO Forensics', 
    icon: Search,
    x: '10%', 
    y: '75%',
    description: 'Technical SEO audit that goes beyond keywords. We analyze crawlability, indexability, and semantic structure.',
    details: [
      'Crawl Budget Optimization',
      'Schema Markup Implementation',
      'Internal Linking Architecture',
      'Core Web Vitals for Search'
    ],
    color: 'electric'
  },
  { 
    id: 'ux', 
    title: 'UX/UI Logic', 
    icon: Target,
    x: '80%', 
    y: '80%',
    description: 'Analyzing the psychological flow of your interface. We ensure every element serves a purpose in the conversion journey.',
    details: [
      'Cognitive Load Reduction',
      'Fitts\'s Law Application',
      'Visual Hierarchy Correction',
      'Micro-interaction Optimization'
    ],
    color: 'sunset'
  },
];

const TechToolbox: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<typeof nodes[0] | null>(null);

  useEffect(() => {
    if (selectedNode) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedNode]);

  return (
    <div className="py-12 flex flex-col items-center">
      <div className="relative w-full max-w-4xl h-[480px] mb-12 flex items-center justify-center">
        {/* Background Grid/Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C58A52" stopOpacity="0" />
              <stop offset="50%" stopColor="#C58A52" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#C58A52" stopOpacity="0" />
            </linearGradient>
          </defs>
          {nodes.map((node) => (
            <motion.line
              key={node.id}
              x1="50%"
              y1="50%"
              x2={node.x}
              y2={node.y}
              stroke="url(#lineGradient)"
              strokeWidth="2"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
            />
          ))}
        </svg>

        {/* Central Node */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          className="relative z-10 p-8 rounded-full bg-white/80 dark:bg-[#171A1D]/80 backdrop-blur-2xl border border-[#C58A52]/40 shadow-[0_16px_40px_rgba(197,138,82,0.15)] text-center animate-ambient"
        >
          <div className="w-16 h-16 bg-[#C58A52]/15 rounded-full flex items-center justify-center mx-auto mb-3 border border-[#C58A52]/30">
            <Zap className="w-8 h-8 text-[#C58A52]" />
          </div>
          <h4 className="text-slate-900 dark:text-[#F2F1ED] font-bold tracking-tight text-lg leading-tight">The Avartah<br/>Audit Stack</h4>
        </motion.div>

        {/* Satellite Nodes */}
        {nodes.map((node, i) => {
          const NodeIcon = node.icon;
          return (
            <motion.div
              key={`tech-node-${node.id || 'node'}-${i}`}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.15 }}
              whileHover={{ scale: 1.05 }}
              style={{ left: node.x, top: node.y }}
              onClick={() => setSelectedNode(node)}
              className="absolute -translate-x-1/2 -translate-y-1/2 px-5 py-3.5 rounded-2xl flex items-center gap-3 border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#171A1D]/80 backdrop-blur-xl shadow-lg hover:border-[#C58A52] cursor-pointer transition-all duration-300 z-20 group"
            >
              <div className="p-2 rounded-xl bg-[#C58A52]/10 text-[#C58A52] group-hover:bg-[#C58A52] group-hover:text-[#111315] transition-colors">
                <NodeIcon size={18} />
              </div>
              <span className="text-slate-900 dark:text-[#F2F1ED] font-semibold whitespace-nowrap text-xs tracking-wide">
                {node.title}
              </span>
              <div className="w-2 h-2 rounded-full bg-[#C58A52] animate-pulse ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          );
        })}
      </div>

      {/* Node Detail Modal */}
      <AnimatePresence>
        {selectedNode && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNode(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="relative w-full max-w-xl bg-white/90 dark:bg-[#171A1D]/90 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl z-10 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#C58A52]/15 border border-[#C58A52]/30 flex items-center justify-center text-[#C58A52]">
                    <selectedNode.icon size={24} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58A52]">Technical Diagnostic Module</span>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-[#F2F1ED]">{selectedNode.title}</h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#202428] text-slate-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A3A9AF] leading-relaxed mb-6">
                {selectedNode.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {selectedNode.details.map((detail, dIdx) => (
                  <div key={`node-detail-${selectedNode.id}-${dIdx}`} className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#111315]/80 border border-slate-100 dark:border-white/5 flex items-center gap-2.5 text-xs text-slate-800 dark:text-[#F2F1ED] font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C58A52] shrink-0" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-500">Avartah Audit Specification</span>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="px-4 py-2 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] font-semibold text-xs rounded-xl transition-colors"
                >
                  Close Specification
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <ScrollLink
          to={SectionId.Audit}
          smooth={true}
          offset={-100}
          className="inline-flex items-center gap-2.5 px-8 py-4 bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] rounded-xl font-bold text-xs transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-[#C58A52]/20 cursor-pointer mb-2"
        >
          <span>Run Forensic Audit Diagnostic</span>
          <ChevronRight size={16} />
        </ScrollLink>
        <p className="text-xs text-slate-500 dark:text-[#747C84]">
          No credit card required · Instant technical insight
        </p>
      </motion.div>
    </div>
  );
};

export default TechToolbox;
