import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function walk(dir: string, fileList: string[] = []) {
  const files = readdirSync(dir);
  for (const file of files) {
    const stat = statSync(join(dir, file));
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        walk(join(dir, file), fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(join(dir, file));
    }
  }
  return fileList;
}

const files = walk('./components').concat(walk('./pages')).concat(['./App.tsx']);
for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  let changed = false;
  
  if (content.includes('bg-slate-50')) { content = content.replace(/bg-slate-50/g, 'bg-black '); changed = true; }
  if (content.includes('bg-slate-900')) { content = content.replace(/bg-slate-900/g, 'bg-black '); changed = true; }
  if (content.includes('text-slate-900')) { content = content.replace(/text-slate-900/g, 'text-white '); changed = true; }
  if (content.includes('text-slate-950')) { content = content.replace(/text-slate-950/g, 'text-white '); changed = true; }
  if (content.includes('text-slate-800')) { content = content.replace(/text-slate-800/g, 'text-white/90 '); changed = true; }
  if (content.includes('text-slate-600')) { content = content.replace(/text-slate-600/g, 'text-white/60 '); changed = true; }
  if (content.includes('text-slate-500')) { content = content.replace(/text-slate-500/g, 'text-white/50 '); changed = true; }
  if (content.includes('text-slate-400')) { content = content.replace(/text-slate-400/g, 'text-white/50 '); changed = true; }
  if (content.includes('text-slate-300')) { content = content.replace(/text-slate-300/g, 'text-white/70 '); changed = true; }
  if (content.includes('text-slate-200')) { content = content.replace(/text-slate-200/g, 'text-white/80 '); changed = true; }
  if (content.includes('text-slate-100')) { content = content.replace(/text-slate-100/g, 'text-white '); changed = true; }
  if (content.includes('dark:text-slate-100')) { content = content.replace(/dark:text-slate-100/g, ''); changed = true; }
  if (content.includes('dark:bg-slate-900')) { content = content.replace(/dark:bg-slate-900/g, ''); changed = true; }
  if (content.includes('dark:text-white')) { content = content.replace(/dark:text-white/g, ''); changed = true; }
  if (content.includes('border-slate-200')) { content = content.replace(/border-slate-200/g, 'border-white/10 '); changed = true; }
  if (content.includes('dark:border-slate-700')) { content = content.replace(/dark:border-slate-700/g, ''); changed = true; }
  if (content.includes('dark:border-slate-800')) { content = content.replace(/dark:border-slate-800/g, ''); changed = true; }
  if (content.includes('bg-slate-800')) { content = content.replace(/bg-slate-800/g, 'bg-white/5 '); changed = true; }
  if (content.includes('bg-white ')) { content = content.replace(/bg-white /g, 'bg-black/40 '); changed = true; }
  if (content.includes('dark:bg-slate-800')) { content = content.replace(/dark:bg-slate-800/g, ''); changed = true; }
  
  if (changed) {
    writeFileSync(file, content);
    console.log(`Deepened colors in ${file}`);
  }
}
