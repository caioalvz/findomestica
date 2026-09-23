import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createApp } from './app.js';

const dataDir = fileURLToPath(new URL('../data', import.meta.url));
mkdirSync(dataDir, { recursive: true });
const db = openDb(`${dataDir}/findomestica.db`, { seed: true });
const port = Number(process.env.PORT) || 3000;
createApp(db).listen(port, '127.0.0.1', () => console.log(`Findomestica em http://localhost:${port}`));
