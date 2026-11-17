const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// 1. Remove neon import
content = content.replace("import { neon } from '@neondatabase/serverless';", "import admin from 'firebase-admin';\nimport fs from 'fs';");

// 2. Initialize Firestore
content = content.replace(
  /const sql = neon\(process\.env\.DATABASE_URL\);[\s\S]*?console\.log\('\[Backend\] Database schema verified & fully provisioned\.'\);/,
  `
  let db: FirebaseFirestore.Firestore;
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(), // or it uses default automatically in AI Studio
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

  function formatDocs(snapshot: any) {
    const arr = [];
    snapshot.forEach((doc: any) => arr.push({ id: doc.id, ...doc.data() }));
    return arr;
  }
  `
);

// 3. Helper for handleDbError (update if needed)
// Wait, handleDbError is defined later.

// Replace SQL Queries manually via regex / string replace

const replacements = [
  // Analytics
  [/await sql`\s*INSERT INTO site_analytics \(([^)]+)\)\s*VALUES \(([^)]+)\)\s*ON CONFLICT.*?\s*`;/g, 
   `await db.collection('site_analytics').doc($2.split(',')[0].trim()).set({ visitor_id: $2.split(',')[0].trim() }, { merge: true });`],
  
  // Actually, Regex for SQL is too brittle.
  // It's better if I write a python script to run a python backend, or replace the sql with Firestore carefully.
];

