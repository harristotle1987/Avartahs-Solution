import { neon } from '@neondatabase/serverless';
import { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    try {
      const booking = req.body;
      await sql`
        INSERT INTO session_bookings (id, name, email, booking_date, booking_time, message, created_at)
        VALUES (${booking.id}, ${booking.name}, ${booking.email}, ${booking.booking_date}, ${booking.booking_time}, ${booking.message}, ${booking.created_at})
      `;
      res.json({ success: true });
    } catch (error) {
      console.error('Neon Save Error (Booking):', error);
      res.status(500).json({ error: 'Failed to save booking' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
