import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Cpu, Server, BarChart, ChevronRight, X, CheckCircle2, ArrowRight } from 'lucide-react';

const services = [
  { 
    icon: <Monitor size={24} />, 
    title: 'Frontend', 
    description: 'JavaScript, TypeScript, React, Next.js, HTML, CSS, Tailwind CSS. Building sleek, responsive, and accessible user interfaces.',
    meta: 'UI/UX LOGIC',
    color: 'electric',
    longDescription: 'Our frontend engineering focus is on creating high-performance, accessible, and visually stunning user interfaces. we leverage the latest React patterns and Next.js optimizations to ensure your site is not just a brochure, but a high-converting sales engine.',
    features: [
      'React & Next.js Expert Implementation',
      'Tailwind CSS for Rapid, Scalable Styling',
      'Accessibility (a11y) & SEO Best Practices',
      'Complex State Management (Zustand/Redux)'
    ]
  },
  { 
    icon: <Cpu size={24} />, 
    title: 'Backend', 
    description: 'Node.js, Express.js. Creating APIs and server-side logic that scale with your growing business needs.',
    meta: 'SERVER ARCHITECTURE',
    color: 'sunset',
    longDescription: 'We build robust, secure, and scalable backend systems that power your application\'s core logic. From complex API design to real-time data processing, our server-side solutions are engineered for reliability and speed.',
    features: [
      'RESTful & GraphQL API Development',
      'Real-time WebSockets Integration',
      'Secure Authentication & Authorization',
      'Microservices & Serverless Architecture'
    ]
  },
  { 
    icon: <Server size={24} />, 
    title: 'Databases', 
    description: 'MongoDB, PostgreSQL, Prisma. Managing structured and unstructured data with reliability and security.',
    meta: 'DATA PERSISTENCE',
    color: 'electric',
    longDescription: 'Data is the lifeblood of your business. We design and implement database architectures that ensure data integrity, high availability, and lightning-fast query performance, whether you\'re using SQL or NoSQL solutions.',
    features: [
      'Relational (PostgreSQL) & NoSQL (MongoDB)',
      'Prisma ORM for Type-Safe Database Access',
      'Database Migration & Performance Tuning',
      'Cloud-Native Data Storage Solutions'
    ]
  },
  { 
    icon: <BarChart size={24} />, 
    title: 'Strategy', 
    description: 'Conversion audits and performance growth audits identifying revenue leaks and user friction points.',
    meta: 'GROWTH AUDITS',
    color: 'sunset',
    longDescription: 'Our strategy services are data-driven and results-oriented. We don\'t just build; we analyze. Through comprehensive audits, we identify exactly where you\'re losing money and provide a technical roadmap to fix it.',
    features: [
      'Full-Stack Conversion Rate Optimization',
      'Technical SEO & Performance Audits',
      'User Journey & Friction Analysis',
      'Revenue Leakage Identification'
    ]
  },
];

const ServiceCard: React.FC<{ service: typeof services[0], index: number, onExplore: (service: typeof services[0]) => void }> = ({ service, index, onExplore }) => {
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

      <button 
        onClick={() => onExplore(service)}
        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-midnight dark:text-white hover:text-sunset transition-all mt-auto pt-6 border-t border-slate-50 dark:border-white/5 w-full"
      >
        Explore Module <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </button>
    </motion.div>
  );
};

const Services: React.FC = () => {
  const [selectedService, setSelectedService] = useState<typeof services[0] | null>(null);

  useEffect(() => {
    if (selectedService) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedService]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {services.map((service, index) => (
          <ServiceCard key={index} service={service} index={index} onExplore={setSelectedService} />
        ))}
      </div>

      <AnimatePresence>
        {selectedService && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedService(null)}
              className="absolute inset-0 bg-midnight/90 backdrop-blur-xl"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-3xl bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/10 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className={`absolute top-0 left-0 w-full h-1.5 ${selectedService.color === 'electric' ? 'bg-electric' : 'bg-sunset'} z-30`} />
              
              <div className="p-8 md:p-16 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-start mb-12">
                  <div className="flex items-center gap-8">
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center bg-slate-50 dark:bg-white/5 ${selectedService.color === 'electric' ? 'text-electric' : 'text-sunset'} border border-slate-100 dark:border-white/10 shadow-inner`}>
                      {React.cloneElement(selectedService.icon as React.ReactElement<any>, { size: 32 })}
                    </div>
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-[0.4em] mb-2 ${selectedService.color === 'electric' ? 'text-electric' : 'text-sunset'}`}>
                        Service Module 0{services.indexOf(selectedService) + 1}
                      </p>
                      <h3 className="text-4xl font-black text-midnight dark:text-white tracking-tighter uppercase">
                        {selectedService.title}
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedService(null)}
                    className="p-4 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors group"
                    title="Exit Module"
                  >
                    <X size={28} className="group-hover:rotate-90 transition-transform" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
                  <div className="lg:col-span-3 space-y-8">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Overview</h4>
                      <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed font-medium">
                        {selectedService.longDescription}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {['Scalable', 'High-Performance', 'Secure', 'Modern Stack'].map((tag, i) => (
                        <span key={i} className="px-4 py-1.5 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-8">
                    <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Key Deliverables</h4>
                    <div className="space-y-4">
                      {selectedService.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-4 group">
                          <div className={`mt-1 shrink-0 ${selectedService.color === 'electric' ? 'text-electric' : 'text-sunset'}`}>
                            <CheckCircle2 size={18} />
                          </div>
                          <span className="text-midnight dark:text-white font-bold text-sm leading-tight group-hover:translate-x-1 transition-transform">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <button 
                        onClick={() => setSelectedService(null)}
                        className={`w-full flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                          selectedService.color === 'electric' 
                            ? 'bg-electric text-white shadow-lg shadow-electric/20' 
                            : 'bg-sunset text-white shadow-lg shadow-sunset/20'
                        }`}
                      >
                        Initialize Project <ArrowRight size={16} />
                      </button>
                      <button 
                        onClick={() => setSelectedService(null)}
                        className="w-full py-4 text-slate-400 dark:text-slate-500 font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 hover:text-sunset transition-all"
                      >
                        <X size={14} /> Exit Module
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Services;