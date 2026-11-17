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
  if (content.includes('neutral-')) {
    content = content.replace(/neutral-/g, 'slate-');
    changed = true;
  }
  if (content.includes('#050505')) {
    content = content.replace(/#050505/g, 'rgb(15,23,42)'); // approximate slate-900
    changed = true;
  }
  if (content.includes('cyan-')) {
    content = content.replace(/cyan-/g, 'blue-');
    changed = true;
  }
  if (content.includes('purple-')) {
    content = content.replace(/purple-/g, 'indigo-');
    changed = true;
  }
  if (changed) {
    writeFileSync(file, content);
    console.log(`Updated colors in ${file}`);
  }
}
