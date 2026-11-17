import * as fs from 'fs';

const files = ['components/Portfolio.tsx', 'components/Visuals.tsx', 'components/Services.tsx', 'pages/AdminDashboard.tsx'];

files.forEach(fileName => {
  if (fs.existsSync(fileName)) {
    let content = fs.readFileSync(fileName, 'utf8');
    content = content.replace(/bg-midnight/g, 'bg-[#050505]');
    content = content.replace(/bg-\[\#0F172A\]/g, 'bg-[#050505]');
    // Also Services.tsx border adjustments
    content = content.replace(/bg-white dark:bg-\[\#050505\] border border-slate-100 dark:border-white\/10/g, 'bg-neutral-900/40 backdrop-blur-xl border border-white/[0.07] shadow-[0_0_30px_rgba(0,0,0,0.5)]');
    fs.writeFileSync(fileName, content);
  }
});
