const fs = require('fs');
const content = fs.readFileSync('components/BlogGrid.tsx', 'utf8');

let newContent = content.replace(
  "import { motion, AnimatePresence } from 'framer-motion';",
  "import { motion, AnimatePresence } from 'framer-motion';\nimport { Link } from 'react-router-dom';"
);

newContent = newContent.replace(
  '<div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />',
  '<Link to={`/blog/${post.slug}`} className="absolute inset-0 z-20" aria-label={`Read ${post.title}`} />\n                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />'
);

fs.writeFileSync('components/BlogGrid.tsx', newContent);
