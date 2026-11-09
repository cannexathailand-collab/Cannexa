// Applies pending Prisma migrations during Vercel production builds only.
// Preview and local builds skip this so they never touch the production database.
import {spawnSync} from 'node:child_process';

if (process.env.VERCEL_ENV !== 'production') {
  console.log('[migrate] skipped: not a Vercel production build');
  process.exit(0);
}
const missing = ['DATABASE_URL', 'DIRECT_URL'].filter(name => !process.env[name]);
if (missing.length) {
  console.error('[migrate] missing ' + missing.join(', ') + ' in Vercel Production environment variables; deployment stopped before build');
  process.exit(1);
}
console.log('[migrate] applying pending migrations with prisma migrate deploy');
const result = spawnSync('prisma', ['migrate', 'deploy'], {stdio: 'inherit', shell: process.platform === 'win32'});
if (result.error) console.error('[migrate] could not start prisma: ' + result.error.message);
process.exit(result.status ?? 1);
