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

const files = walk('./components').concat(walk('./pages'));
for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  let changed = false;
  
  if (content.match(/import\s*{[^}]*}\s*from\s*['"]lucide-react['"]/)) {
    content = content.replace(/import\s*{[^}]*}\s*from\s*['"]lucide-react['"];?\n?/g, '');
    changed = true;
  }
  
  // Replace <IconName ... /> tags
  const tagsToRemove = ['Star', 'ArrowRight', 'ArrowDownRight', 'Monitor', 'Cpu', 'Server', 'BarChart', 'ChevronRight', 'X', 'CheckCircle2', 'Terminal', 'Zap', 'Target', 'BarChart3', 'Users', 'TrendingUp', 'Activity', 'Shield', 'Mail', 'Github', 'Twitter', 'Linkedin', 'Calendar', 'ArrowLeft', 'ArrowUpRight', 'ArrowUp', 'ArrowDown'];
  for (const tag of tagsToRemove) {
     const regex = new RegExp(`<${tag}[^>]*\\/?>`, 'g');
     if (content.match(regex)) {
        content = content.replace(regex, '');
        changed = true;
     }
  }

  // Also remove `{service.icon}` in `components/Services.tsx`
  if (content.includes('{service.icon}')) {
     content = content.replace('{service.icon}', '<div className="w-4 h-4 rounded-full bg-white/20 animate-pulse"></div>');
     changed = true;
  }
  
  // And remove `{item.icon}` in `components/Process.tsx`
  if (content.includes('{item.icon}')) {
     content = content.replace('{item.icon}', '<div className="w-6 h-6 rounded-md bg-white/20"></div>');
     changed = true;
  }

  if (changed) {
    writeFileSync(file, content);
    console.log(`Stripped icons from ${file}`);
  }
}
