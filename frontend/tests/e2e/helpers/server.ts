import { spawn, ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';

export interface RunningServers {
  backendPort: number;
  frontendPort: number;
  stop: () => Promise<void>;
}

const isPortFree = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
};

const waitForUrl = async (url: string, timeoutMs = 25000): Promise<boolean> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

export const ensureAppServers = async (): Promise<RunningServers> => {
  const backendPort = 4400;
  const frontendPort = 5401;

  let backendProc: ChildProcess | null = null;
  let frontendProc: ChildProcess | null = null;

  const isBackendFree = await isPortFree(backendPort);
  if (isBackendFree) {
    backendProc = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      cwd: '/data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/backend',
      stdio: 'ignore',
      env: { ...process.env, PORT: String(backendPort) },
    });
  }

  const isFrontendFree = await isPortFree(frontendPort);
  if (isFrontendFree) {
    frontendProc = spawn(process.execPath, [
      '/data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/node_modules/vite/bin/vite.js',
      '--host',
      '127.0.0.1',
      '--port',
      String(frontendPort),
      '--configLoader',
      'native',
    ], {
      cwd: '/data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/frontend',
      stdio: 'ignore',
      env: { ...process.env, VITE_PORT: String(frontendPort) },
    });
  }

  await waitForUrl(`http://127.0.0.1:${backendPort}/api/health`, 25000).catch(() => false);
  await waitForUrl(`http://127.0.0.1:${frontendPort}`, 25000).catch(() => false);

  return {
    backendPort,
    frontendPort,
    stop: async () => {
      if (frontendProc) frontendProc.kill('SIGTERM');
      if (backendProc) backendProc.kill('SIGTERM');
    },
  };
};
