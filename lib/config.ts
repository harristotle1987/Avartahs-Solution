/**
 * Avartah Solutions Application Configuration
 * Neon PostgreSQL is the sole authoritative database.
 * Legacy Firestore persistence has been completely retired.
 */
export const isFirestoreConfigured = false;
export const isNeonConfigured = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0);

