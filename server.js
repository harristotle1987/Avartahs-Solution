import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware configuration
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * Avartah Solutions Lightweight Backend
 * Note: Audit and Booking emails are now handled client-side via EmailJS
 * for zero-latency communication and simplified deployment.
 */

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Avartah Solutions API Gateway is active',
    timestamp: new Date().toISOString(),
    engine: 'V4_CLIENT_HANDSHAKE'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`[Backend] Gateway initialized and listening on port ${PORT}`);
});