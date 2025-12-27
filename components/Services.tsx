import React from 'react';
import { motion } from 'framer-motion';
import { Monitor, Cpu, Server, BarChart4, ChevronRight } from 'lucide-react';

const services = [
  { 
    icon: <Monitor size={24} />, 
    title: 'Frontend', 
    description: 'JavaScript, TypeScript, React, Next.js, HTML, CSS, Tailwind CSS. Building sleek, responsive, and accessible user interfaces.',
    meta: 'UI/UX LOGIC',
    color: 'electric'
  },
  { 
    icon: <Cpu size={24} />, 
    title: 'Backend', 
    description: 'Node.js, Express.js. Creating APIs and server-side logic that scale with your growing business needs.',
    meta: 'SERVER ARCHITECTURE',
    color: 'sunset'
  },
  { 
    icon: <Server size={24} />, 
    title: 'Databases', 
    description: 'MongoDB, PostgreSQL, Prisma. Managing structured and unstructured data with reliability and security.',
    meta: 'DATA PERSISTENCE',
    color: 'electric'
  },
  { 
    icon: <BarChart4 size={24} />, 
    title: 'Strategy', 
    description: 'Conversion audits and performance growth audits identifying revenue leaks and user friction points.',
    meta: 'GROWTH AUDITS',
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
      className="group p-8 rounded-[2.5rem] bg-white dark:bg-[#020617] border border-slate-100 dark:border-white/5 hover:border-sunset/50 transition-all duration-500 shadow-premium hover:shadow-highlight flex flex-col items-start gap-8"
    >
      <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-white/5 text-midnight dark:text-white group-hover:bg-sunset group-hover:text-white transition-all duration-500">
        {service.icon}
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <span className="text-[8px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.4em]">{service.meta}</span>
          <h3 className="text-xl font-black text-midnight dark:text-white tracking-tighter uppercase group-hover:text-sunset transition-colors">
            {service.title}
          </h3>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-medium">
          {service.description}
        </p>
      </div>

      <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-midnight dark:text-white hover:text-sunset transition-all mt-auto pt-6 border-t border-slate-50 dark:border-white/5 w-full">
        Explore Module <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </button>
    </motion.div>
  );
};

const Services: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {services.map((service, index) => (
        <ServiceCard key={index} service={service} index={index} />
      ))}
    </div>
  );
};

export default Services;