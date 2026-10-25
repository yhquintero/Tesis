import { readFileSync } from 'node:fs';
const s = readFileSync('server/src/seed.js', 'utf8');
const m = s.match(/const USUARIOS = \[([\s\S]*?)\n\];/);
const emails = [...m[1].matchAll(/'([^']+@[^']+)'/g)].map((x) => x[1]);
console.log('total', emails.length);
const set = new Set();
for (const e of emails) {
  if (set.has(e)) console.log('DUP', e);
  set.add(e);
}
