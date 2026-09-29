import { spawn, type ChildProcess } from 'node:child_process';
import { ROOT } from './results';

/** Start `vite preview` on a port and resolve once it answers. */
export async function startPreview(port: number): Promise<{ url: string; stop: () => void }> {
  const child: ChildProcess = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  const url = `http://localhost:${port}/`;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return { url, stop: () => child.kill('SIGTERM') };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill('SIGTERM');
  throw new Error(`preview server did not start on ${port}`);
}
