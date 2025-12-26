
import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Target, Eye, Microscope, Fingerprint } from 'lucide-react';
import { Link as ScrollLink } from 'react-scroll';
import { SectionId } from '../types';

const nodes = [
  { id: 'speed', title: 'Speed Analysis', icon: <Zap size={20} />, x: '15%', y: '20%' },
  { id: 'heatmap', title: 'Heatmap Tracking', icon: <Eye size={20} />, x: '85%', y: '25%' },
  { id: 'seo', title: 'SEO Forensics', icon: <Microscope size={20} />, x: '10%', y: '75%' },
  { id: 'ux', title: 'UX/UI Logic', icon: <Fingerprint size={20} />, x: '80%', y: '80%' },
];

const TechToolbox: React.FC = () => {
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
            className="absolute -translate-x-1/2 -translate-y-1/2 glass-effect px-6 py-4 rounded-2xl flex items-center gap-4 border-white/10 group cursor-default hover:border-electric/50 transition-all duration-500"
          >
            <div className="p-2 rounded-xl bg-white/5 text-muted group-hover:text-electric transition-colors">
              {node.icon}
            </div>
            <span className="text-white font-bold whitespace-nowrap text-sm tracking-wide">
              {node.title}
            </span>
          </motion.div>
        ))}
      </div>

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
