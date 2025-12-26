
import React from 'react';
import { motion } from 'framer-motion';

const techStack = [
  "Next.js", "React 19", "TypeScript", "Python", "Node.js", "PostgreSQL", "Gemini AI", "Supabase", "Framer Motion", "Tailwind CSS", "Flask", "Vercel"
];

const TechMarquee: React.FC = () => {
  return (
    <div className="py-12 border-y border-slate-50 overflow-hidden bg-slate-50/30">
      <div className="flex whitespace-nowrap">
        <motion.div 
          animate={{ x: [0, -1000] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="flex gap-16 md:gap-32 items-center pr-16 md:pr-32"
        >
          {Array(4).fill(techStack).flat().map((tech, i) => (
            <span key={i} className="text-2xl md:text-4xl font-black text-slate-200 uppercase tracking-tighter transition-colors hover:text-sunset cursor-default">
              {tech}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default TechMarquee;
