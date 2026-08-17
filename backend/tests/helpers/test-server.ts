import type { Server } from 'http';
import { AddressInfo } from 'net';
import app from '../../src/index.js';
import { createApiClient, TestApiClient } from './test-client.js';

let sharedServer: Server | null = null;
let sharedBaseUrl: string = '';

export interface RunningTestServer {
  server: Server;
  baseUrl: string;
  apiBaseUrl: string;
  client: TestApiClient;
  stop: () => Promise<void>;
}

export async function getTestServer(): Promise<RunningTestServer> {
  if (process.env.POS_API_URL) {
    const apiBaseUrl = process.env.POS_API_URL.replace(/\/$/, '');
    const baseUrl = apiBaseUrl.replace(/\/api$/, '');
    return {
      server: null as any,
      baseUrl,
      apiBaseUrl,
      client: createApiClient(baseUrl),
      stop: async () => {},
    };
  }

  if (sharedServer && sharedServer.listening) {
    return {
      server: sharedServer,
      baseUrl: sharedBaseUrl,
      apiBaseUrl: `${sharedBaseUrl}/api`,
      client: createApiClient(sharedBaseUrl),
      stop: async () => {},
    };
  }

  await new Promise<void>((resolve, reject) => {
    sharedServer = app.listen(0, '127.0.0.1', () => {
      const addr = sharedServer!.address() as AddressInfo;
      sharedBaseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
    sharedServer.on('error', reject);
  });

  return {
    server: sharedServer!,
    baseUrl: sharedBaseUrl,
    apiBaseUrl: `${sharedBaseUrl}/api`,
    client: createApiClient(sharedBaseUrl),
    stop: async () => {
      if (sharedServer) {
        await new Promise<void>((res) => sharedServer!.close(() => res()));
        sharedServer = null;
        sharedBaseUrl = '';
      }
    },
  };
}

export async function closeTestServer(): Promise<void> {
  if (sharedServer) {
    await new Promise<void>((res) => sharedServer!.close(() => res()));
    sharedServer = null;
    sharedBaseUrl = '';
  }
}
