import * as fs from 'fs';
import * as path from 'path';

const walkSync = (dir: string, filelist: string[] = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts')) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
};

const components = walkSync('./components');
const pages = walkSync('./pages');
const allFiles = [...components, ...pages, './App.tsx'];

allFiles.forEach(fileName => {
  let content = fs.readFileSync(fileName, 'utf8');
  let originalContent = content;

  // Base canvas background
  content = content.replace(/bg-\[\#050505\]/g, 'bg-neutral-50 dark:bg-[#050505]');
  
  // Surface cards
  content = content.replace(/bg-neutral-900\/40 backdrop-blur-xl border border-white\/\[0\.07\] shadow-\[0_0_30px_rgba\(0,0,0,0\.5\)\]/g, 'bg-white border border-neutral-200/80 shadow-md dark:bg-neutral-900/40 dark:backdrop-blur-xl dark:border-white/[0.07] dark:shadow-[0_0_30px_rgba(0,0,0,0.5)]');
  
  content = content.replace(/bg-neutral-900\/40 backdrop-blur-xl border border-white\/\[0\.07\]/g, 'bg-white border border-neutral-200/80 dark:bg-neutral-900/40 dark:backdrop-blur-xl dark:border-white/[0.07]');

  // Text colors
  content = content.replace(/text-white/g, 'text-neutral-900 dark:text-white');
  content = content.replace(/text-neutral-400/g, 'text-neutral-600 dark:text-neutral-400');
  content = content.replace(/text-neutral-500/g, 'text-neutral-500 dark:text-neutral-500'); // No change but let's be careful
  
  content = content.replace(/border-white\/10/g, 'border-neutral-200 dark:border-white/10');
  
  // Specific gradient
  content = content.replace(/from-cyan-400 via-blue-500 to-indigo-500/g, 'from-cyan-600 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-blue-500 dark:to-indigo-500');

  content = content.replace(/from-purple-400 via-fuchsia-500 to-pink-500/g, 'from-purple-600 via-fuchsia-600 to-pink-600 dark:from-purple-400 dark:via-fuchsia-500 dark:to-pink-500');

  if (content !== originalContent) {
    fs.writeFileSync(fileName, content);
  }
});
