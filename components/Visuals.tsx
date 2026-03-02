import React from 'react';
import { motion } from 'framer-motion';

// Curated Enterprise Tech Asset Library for premium aesthetic without API costs
const ASSET_LIBRARY: Record<string, string> = {
  background: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop",
  centerpiece: "https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=1932&auto=format&fit=crop",
  ui_logic: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop",
  backend: "https://images.unsplash.com/photo-1558494949-ef010cbdcc48?q=80&w=2070&auto=format&fit=crop",
  audit: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015&auto=format&fit=crop",
  default: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop"
};

interface ServiceImageProps {
  prompt: string;
}

export const ServiceCardImage: React.FC<ServiceImageProps> = ({ prompt }) => {
  let assetUrl = ASSET_LIBRARY.default;
  const p = prompt.toLowerCase();
  if (p.includes('ui') || p.includes('ux')) assetUrl = ASSET_LIBRARY.ui_logic;
  if (p.includes('backend') || p.includes('server')) assetUrl = ASSET_LIBRARY.backend;
  if (p.includes('audit') || p.includes('data')) assetUrl = ASSET_LIBRARY.audit;

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#0F172A]">
      <motion.img 
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 0.5, scale: 1 }}
        transition={{ duration: 1.5 }}
        src={assetUrl} 
        alt="Technical Visual" 
        className="w-full h-full object-cover filter brightness-75 contrast-110" 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/40 to-transparent" />
    </div>
  );
};

export const TechBackground: React.FC = () => {
  return (
    <div className="w-full h-full bg-[#020617] relative overflow-hidden flex items-center justify-center">
      <motion.img 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        src={ASSET_LIBRARY.background} 
        alt="Background Pattern" 
        className="w-full h-full object-cover opacity-20" 
      />
      <div className="absolute inset-0 bg-[#020617]/40" />
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)',
        backgroundSize: '100px 100px'
      }} />
    </div>
  );
};

export const TechCenterpiece: React.FC = () => {
  return (
    <div className="relative aspect-square w-full max-w-xl mx-auto flex items-center justify-center">
      <motion.img 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1 }}
        src={ASSET_LIBRARY.centerpiece} 
        alt="Core Tech Hub" 
        className="w-full h-full object-cover rounded-[3rem] shadow-premium opacity-80" 
      />
      <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-sunset/20 via-transparent to-electric/20 mix-blend-overlay" />
    </div>
  );
};
