const fs = require('fs');
let serverTs = fs.readFileSync('server.ts', 'utf8');
serverTs = serverTs.replace(
  "  app.get('/api/blogs', async (req, res) => {",
  "  app.get('/api/blogs/:slug', async (req, res) => {\n    try {\n      const slug = req.params.slug;\n      const data = await sql`SELECT * FROM blogs WHERE slug = ${slug}`;\n      if (data.length === 0) return res.status(404).json({ error: 'Not found' });\n      res.json(data[0]);\n    } catch (error) {\n      handleDbError(res, error, 'blogs:fetchOne');\n    }\n  });\n\n  app.get('/api/blogs', async (req, res) => {"
);
fs.writeFileSync('server.ts', serverTs);

let apiTs = fs.readFileSync('lib/api.ts', 'utf8');
apiTs = apiTs.replace(
  "export const getBlogs = async (): Promise<Post[]> => {",
  "export const getBlogBySlug = async (slug: string): Promise<Post> => {\n  const res = await fetch(`${API_URL}/blogs/${slug}`);\n  if (!res.ok) throw new Error('Failed to fetch blog');\n  return res.json();\n};\n\nexport const getBlogs = async (): Promise<Post[]> => {"
);
fs.writeFileSync('lib/api.ts', apiTs);
