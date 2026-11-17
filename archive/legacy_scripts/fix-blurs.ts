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
  if (content.includes('backdrop-blur')) {
    content = content.replace(/backdrop-blur(-\w+)?\s?/g, '');
    writeFileSync(file, content);
    console.log(`Fixed blurs in ${file}`);
  }
}
