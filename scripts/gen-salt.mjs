// Fills HASH_SALT in .env when it is missing or empty. Never prints the value. Run: npm run salt
// Never overwrites a real salt: changing it re-keys every reporter hash and breaks distinct-reporter counts (D9).
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2] ?? '.env';
const env = existsSync(file) ? readFileSync(file, 'utf8') : '';
const current = env.match(/^HASH_SALT=(.*)$/m)?.[1].replace(/#.*/, '').trim().replace(/^(['"])(.*)\1$/, '$2');

if (current) {
  console.log(`HASH_SALT already set in ${file}; left unchanged`);
} else {
  const line = `HASH_SALT=${randomBytes(32).toString('hex')}`;
  const next =
    current === undefined ? `${env}${env && !env.endsWith('\n') ? '\n' : ''}${line}\n` : env.replace(/^HASH_SALT=.*$/m, line);
  writeFileSync(file, next);
  console.log(`HASH_SALT written to ${file}`);
}
