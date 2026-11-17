import pool from '../neon.js';
import { Post } from '../../types';

export class BlogsService {
  static async getAll() {
    const res = await pool.query('SELECT * FROM blogs ORDER BY created_at DESC');
    return res.rows;
  }

  static async getCount() {
    const res = await pool.query('SELECT COUNT(*)::int as count FROM blogs');
    return res.rows[0]?.count || 0;
  }

  static async getById(id: string) {
    const res = await pool.query('SELECT * FROM blogs WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async getBySlug(slug: string) {
    const res = await pool.query('SELECT * FROM blogs WHERE slug = $1 LIMIT 1', [slug]);
    return res.rows[0] || null;
  }

  static async upsert(data: Partial<Post> & { id: string; title: string; slug: string }) {
    const d = data as any;
    const now = new Date();
    const res = await pool.query(`
      INSERT INTO blogs (id, title, slug, excerpt, content, author, category, cover_image, published, published_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        excerpt = EXCLUDED.excerpt,
        content = EXCLUDED.content,
        author = EXCLUDED.author,
        category = EXCLUDED.category,
        cover_image = EXCLUDED.cover_image,
        published = EXCLUDED.published,
        published_at = EXCLUDED.published_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      d.id,
      d.title,
      d.slug,
      d.excerpt || '',
      d.content || '',
      d.author || 'Avartah Team',
      d.category || 'Engineering',
      d.cover_image || d.coverImage || '',
      d.published !== false,
      d.published_at ? new Date(d.published_at) : (d.date ? new Date(d.date) : now),
      d.created_at ? new Date(d.created_at) : now
    ]);
    return res.rows[0];
  }

  static async update(id: string, data: Partial<Post>) {
    const d = data as any;
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (d.title !== undefined) { updates.push(`title = $${idx++}`); values.push(d.title); }
    if (d.slug !== undefined) { updates.push(`slug = $${idx++}`); values.push(d.slug); }
    if (d.excerpt !== undefined) { updates.push(`excerpt = $${idx++}`); values.push(d.excerpt); }
    if (d.content !== undefined) { updates.push(`content = $${idx++}`); values.push(d.content); }
    if (d.author !== undefined) { updates.push(`author = $${idx++}`); values.push(d.author); }
    if (d.category !== undefined) { updates.push(`category = $${idx++}`); values.push(d.category); }
    if (d.cover_image !== undefined || d.coverImage !== undefined) {
      updates.push(`cover_image = $${idx++}`);
      values.push(d.cover_image || d.coverImage);
    }
    if (d.published !== undefined) { updates.push(`published = $${idx++}`); values.push(Boolean(d.published)); }
    if (d.published_at !== undefined || d.date !== undefined) {
      updates.push(`published_at = $${idx++}`);
      values.push(new Date(d.published_at || d.date || Date.now()));
    }

    if (updates.length === 0) return this.getById(id);

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const res = await pool.query(`UPDATE blogs SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    return res.rows[0] || null;
  }

  static async delete(id: string) {
    const existing = await this.getById(id);
    await pool.query('DELETE FROM blogs WHERE id = $1', [id]);
    return existing;
  }
}
