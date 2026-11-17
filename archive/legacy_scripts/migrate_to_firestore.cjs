const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// 1. Replace imports and initialization
content = content.replace(
  "import { neon } from '@neondatabase/serverless';",
  `import admin from 'firebase-admin';\nimport fs from 'fs';`
);

content = content.replace(
  /const sql = neon\(process\.env\.DATABASE_URL\);[\s\S]*?console\.log\('\[Backend\] Database schema verified & fully provisioned\.'\);/,
  `
  // Initialize Firebase Admin
  let db: FirebaseFirestore.Firestore;
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: config.projectId,
        });
      }
      db = admin.firestore();
      db.settings({ databaseId: config.firestoreDatabaseId || '(default)' });
      console.log('[Backend] Firebase Firestore initialized successfully.');
    } else {
      console.warn('[Backend] firebase-applet-config.json not found. Firestore will not be initialized.');
    }
  } catch (err) {
    console.error('[Backend] Failed to initialize Firebase:', err);
  }
  `
);

// We need to carefully replace each endpoint.
fs.writeFileSync('server.ts.tmp', content);
