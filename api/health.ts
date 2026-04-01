import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: 'OK',
    message: 'Avartah Solutions API Gateway is active',
    timestamp: new Date().toISOString()
  });
}
