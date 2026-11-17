
import fs from 'fs';
import path from 'path';

const files = [
  './components/AuditForm.tsx',
  './components/Navbar.tsx',
  './components/CorrectionDocument.tsx',
  './components/TechToolbox.tsx',
  './components/Services.tsx',
  './components/Process.tsx',
  './components/BlogGrid.tsx',
  './components/BlogCMS.tsx',
  './pages/AdminDashboard.tsx',
];

const replacements = [
  { from: /blue-500/g, to: 'emerald-500' },
  { from: /blue-400/g, to: 'emerald-400' },
  { from: /indigo-500/g, to: 'emerald-600' },
  { from: /indigo-400/g, to: 'emerald-400' },
  { from: /glow-blue/g, to: 'glow-emerald' },
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    replacements.forEach(rep => {
      content = content.replace(rep.from, rep.to);
    });
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
