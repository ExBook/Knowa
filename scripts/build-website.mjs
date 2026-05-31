import { mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(args, env = {}) {
  const result = spawnSync(npx, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

await rm('website/dist', { recursive: true, force: true });

run(['vite', 'build', '--config', 'website/vite.config.ts']);
run(['vite', 'build', '--base', '/app/', '--outDir', 'website/dist/app'], {
  VITE_EXLOCAL_DEMO: 'true',
});

await mkdir('website/dist', { recursive: true });
await writeFile(
  join('website', 'dist', '_redirects'),
  ['/app/* /app/index.html 200', '/* /index.html 200', ''].join('\n'),
  'utf8',
);
