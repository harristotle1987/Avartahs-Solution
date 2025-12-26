
import React from 'react';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

const reviews = [
  {
    name: 'Nick Widmann',
    role: 'CEO at VMOC',
    text: '“We more than doubled our conversion rate” - No team has been as dedicated to our success as Avartah.',
    source: 'Clutch'
  },
  {
    name: 'Aaron Kozinets',
    role: 'CEO at Influence Hunter',
    text: '“We get 30-70 leads every single day” - They hit the nail on the head on all our goals.',
    source: 'Clutch'
  },
  {
    name: 'Cody Voelker',
    role: 'President - Panic Safety',
    text: '“We’ve seen a big increase in partnership requests” - Redesigning our site was the best decision of the year.',
    source: 'Clutch'
  }
];

const Reviews: React.FC = () => {
  return (
    <div className="space-y-6">
      {reviews.map((rev, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-premium group hover:border-sunset/20 transition-all"
        >
          <div className="flex items-start gap-4">
             <Quote className="text-sunset shrink-0" size={24} />
             <div>
                <p className="text-[#0F172A] text-lg font-bold leading-tight mb-4 italic">
                  {rev.text}
                </p>
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-slate-100 rounded-full" />
                   <div>
                      <p className="font-black text-[10px] uppercase tracking-tighter">{rev.name}</p>
                      <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">{rev.role}</p>
                   </div>
                </div>
             </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default Reviews;
