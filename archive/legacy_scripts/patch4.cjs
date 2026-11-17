const fs = require('fs');

// Update ArticlePage.tsx
let articleTs = fs.readFileSync('pages/ArticlePage.tsx', 'utf8');
articleTs = articleTs.replace(
  "import { Post, Category } from '../types';",
  "import { Post, Category } from '../types';\nimport { getBlogBySlug } from '../lib/api';"
);
articleTs = articleTs.replace(
  "    const found = MOCK_POSTS.find(p => p.slug === slug) || MOCK_POSTS[0];\n    setPost(found);\n    window.scrollTo(0, 0);",
  "    if (slug) {\n      getBlogBySlug(slug).then(setPost).catch(console.error);\n    }\n    window.scrollTo(0, 0);"
);
fs.writeFileSync('pages/ArticlePage.tsx', articleTs);

// Update BlogPage.tsx
let blogTs = fs.readFileSync('pages/BlogPage.tsx', 'utf8');
blogTs = blogTs.replace(
  "import { Post, Category } from '../types';",
  "import { Post, Category } from '../types';\nimport { getBlogs } from '../lib/api';"
);
blogTs = blogTs.replace(
  "  const filteredPosts = activeCategory === 'all' \n    ? MOCK_POSTS \n    : MOCK_POSTS.filter(post => post.category?.slug === activeCategory);",
  "  const [posts, setPosts] = useState<Post[]>([]);\n\n  useEffect(() => {\n    getBlogs().then(setPosts).catch(console.error);\n  }, []);\n\n  const filteredPosts = activeCategory === 'all' \n    ? posts \n    : posts.filter(post => post.category?.slug === activeCategory);"
);
fs.writeFileSync('pages/BlogPage.tsx', blogTs);

