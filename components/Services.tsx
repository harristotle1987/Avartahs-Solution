import React from 'react';
import { motion } from 'framer-motion';
import { Monitor, Cpu, Server, BarChart4, ChevronRight } from 'lucide-react';

const services = [
  { 
    icon: <Monitor size={32} />, 
    title: 'LOGIC-DRIVEN UI/UX', 
    description: 'We architect interfaces that guide users toward conversion with high-conversion behavioral triggers. Includes Behavioral Heatmapping, Friction-Point Analysis, and Cognitive Load Optimization.',
    meta: ['STATUS: OPTIMIZED', 'NODE: BEHAVIORAL', 'LOGIC: ACTIVE'],
    color: 'electric'
  },
  { 
    icon: <Cpu size={32} />, 
    title: 'HIGH-SCALE WEB APPS', 
    description: 'Specializing in React/Next.js and distributed architectures designed to handle millions of requests. Deploying React/Next.js architectures with Edge-caching and Multi-region scalability for 0.2s load times.',
    meta: ['ENGINE: NEXT.JS 15', 'EDGE: ACTIVE', 'PERF: 100/100'],
    color: 'sunset'
  },
  { 
    icon: <Server size={32} />, 
    title: 'DISTRIBUTED BACKENDS', 
    description: 'Robust, secure, and lightning-fast server infrastructure built for zero-downtime scalability. Custom API Orchestration, PostgreSQL/Redis optimization, and Enterprise-grade security protocols.',
    meta: ['DB: POSTGRES', 'CACHE: REDIS', 'SEC: AES-256'],
    color: 'electric'
  },
  { 
    icon: <BarChart4 size={32} />, 
    title: 'CONVERSION LOGIC AUDIT', 
    description: 'Forensic data analysis of your existing sales funnel to identify revenue leaks and optimize LTV. Forensic LTV (Lifetime Value) mapping and 48-point revenue leak identification report.',
    meta: ['DATA: FORENSIC', 'RPV: MAPPED', 'LEAKS: DETECTED'],
    color: 'sunset'
  },
];

const ServiceCard: React.FC<{ service: typeof services[0], index: number }> = ({ service, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="group relative p-10 rounded-[2.5rem] bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 hover:border-sunset/40 transition-all duration-500 shadow-lab hover:shadow-[0_20px_60px_-15px_rgba(249,115,22,0.1)] flex flex-col items-start gap-8 overflow-hidden min-h-[420px]"
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 w-16 h-16 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-white/10 shadow-sm text-sunset group-hover:scale-110 transition-transform duration-500"
      >
        <div className="relative z-10">
          {service.icon}
        </div>
      </motion.div>

      <div className="relative z-10 flex flex-col gap-4 flex-1">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-gray-600">Module_0{index + 1}</span>
          <h3 className="text-2xl md:text-3xl font-[900] tracking-tighter uppercase text-midnight dark:text-white leading-[0.9] group-hover:text-sunset transition-colors">
            {service.title}
          </h3>
        </div>
        
        <p className="text-slate-500 dark:text-gray-400 text-sm md:text-[15px] font-medium leading-relaxed max-w-sm">
          {service.description}
        </p>

        <div className="mt-auto pt-6 border-t border-slate-100 dark:border-white/5 w-full">
          <div className="flex flex-wrap gap-2 mb-6">
            {service.meta.map((m, i) => (
              <span key={i} className="text-[8px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-white/5 px-2 py-1 rounded">
                [{m}]
              </span>
            ))}
          </div>
          
          <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-midnight dark:text-white group-hover:text-sunset transition-all">
            Initiate Deployment <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const Services: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 lg:gap-10">
        {services.map((service, index) => (
          <ServiceCard key={index} service={service} index={index} />
        ))}
      </div>
    </div>
  );
};

export default Services;