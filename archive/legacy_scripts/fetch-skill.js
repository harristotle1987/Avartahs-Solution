import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

async function downloadFile(url, outputPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`unexpected response ${res.statusText}`);
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fileStream = fs.createWriteStream(outputPath, { flags: 'wx' });
  await finished(Readable.fromWeb(res.body).pipe(fileStream));
}

async function main() {
  const baseUrl = 'https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main';
  const files = [
    'SKILL.md',
    'README.md',
    'package.json'
  ];

  for (const file of files) {
    try {
      console.log(`Downloading ${file}...`);
      await downloadFile(`${baseUrl}/${file}`, `skills/ui-ux-pro-max-skill/${file}`);
    } catch (e) {
      console.error(`Failed ${file}:`, e.message);
    }
  }
}

main().catch(console.error);
