
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Target, Eye, Microscope, Fingerprint, X, ChevronRight, Activity, Shield, Zap as SpeedIcon, Search } from 'lucide-react';
import { Link as ScrollLink } from 'react-scroll';
import { SectionId } from '../types';

const nodes = [
  { 
    id: 'speed', 
    title: 'Speed Analysis', 
    icon: <Zap size={20} />, 
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
    icon: <Eye size={20} />, 
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
    icon: <Microscope size={20} />, 
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
    icon: <Fingerprint size={20} />, 
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
    <div className="py-20 flex flex-col items-center">
      <div className="relative w-full max-w-4xl h-[500px] mb-20 flex items-center justify-center">
        {/* Background Grid/Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
              <stop offset="50%" stopColor="#3B82F6" stopOpacity="1" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
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
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
          ))}
        </svg>

        {/* Central Node */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          className="relative z-10 glass-effect p-8 rounded-full border-electric/30 glow-blue text-center animate-float"
        >
          <div className="w-20 h-20 bg-electric/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-electric/50">
            <Target className="text-electric" size={40} />
          </div>
          <h4 className="text-white font-black tracking-tight text-xl">The Avartah<br/>Audit Stack</h4>
        </motion.div>

        {/* Satellite Nodes */}
        {nodes.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.2 }}
            style={{ left: node.x, top: node.y }}
            onClick={() => setSelectedNode(node)}
            className="absolute -translate-x-1/2 -translate-y-1/2 glass-effect px-6 py-4 rounded-2xl flex items-center gap-4 border-white/10 group cursor-pointer hover:border-electric/50 transition-all duration-500 hover:scale-110 z-20"
          >
            <div className="p-2 rounded-xl bg-white/5 text-muted group-hover:text-electric transition-colors">
              {node.icon}
            </div>
            <span className="text-white font-bold whitespace-nowrap text-sm tracking-wide">
              {node.title}
            </span>
            <div className="w-2 h-2 rounded-full bg-electric/50 animate-pulse ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        ))}
      </div>

      {/* Node Detail Modal */}
      <AnimatePresence>
        {selectedNode && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNode(null)}
              className="absolute inset-0 bg-midnight/90 backdrop-blur-xl"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0F172A] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-electric to-sunset z-30" />
              
              <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-start mb-10">
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center bg-white/5 ${selectedNode.color === 'electric' ? 'text-electric' : 'text-sunset'} border border-white/10`}>
                      {selectedNode.icon}
                    </div>
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-1 ${selectedNode.color === 'electric' ? 'text-electric' : 'text-sunset'}`}>
                        Technical Module
                      </p>
                      <h3 className="text-3xl font-black text-white tracking-tighter uppercase">
                        {selectedNode.title}
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-3 rounded-full hover:bg-white/5 text-slate-400 transition-colors group"
                    title="Exit Module"
                  >
                    <X size={24} className="group-hover:rotate-90 transition-transform" />
                  </button>
                </div>

                <div className="space-y-8">
                  <p className="text-slate-400 text-lg leading-relaxed font-medium">
                    {selectedNode.description}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedNode.details.map((detail, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className={`w-1.5 h-1.5 rounded-full ${selectedNode.color === 'electric' ? 'bg-electric' : 'bg-sunset'}`} />
                        <span className="text-white font-bold text-sm tracking-tight">{detail}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0F172A] bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white">
                            {String.fromCharCode(64 + i)}
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Active in 14+ Audits
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => setSelectedNode(null)}
                      className={`w-full md:w-auto px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        selectedNode.color === 'electric' 
                          ? 'bg-electric text-white hover:bg-electric/90' 
                          : 'bg-sunset text-white hover:bg-sunset/90'
                      }`}
                    >
                      <X size={14} /> Exit Module
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interchangeable CTA #2 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <ScrollLink
          to={SectionId.Audit}
          smooth={true}
          offset={-100}
          className="inline-flex items-center gap-3 px-10 py-5 bg-sunset hover:bg-sunset/90 text-white rounded-2xl font-black text-xl transition-all transform hover:scale-105 active:scale-95 glow-orange cursor-pointer mb-4"
        >
          Show Me What’s Broken
        </ScrollLink>
        <p className="text-muted text-sm font-medium opacity-60">
          No credit card required. Pure technical insight.
        </p>
      </motion.div>
    </div>
  );
};

export default TechToolbox;
