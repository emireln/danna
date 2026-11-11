import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Writes a Content-Security-Policy into index.html. Development needs inline
// scripts for React Fast Refresh; production allows only the bundled scripts.
function securityPolicy(options: { dev: boolean; supabaseUrl: string }): Plugin {
  // The app may contact only its own project address. No wildcard hosts.
  const connect = ["'self'"];
  const images = ["'self'", 'data:', 'blob:'];
  if (options.supabaseUrl) {
    try {
      const origin = new URL(options.supabaseUrl).origin;
      connect.push(origin);
      images.push(origin); // banner images come from the project's storage
    } catch {
      // An invalid URL is reported by the app at runtime; the policy keeps the defaults.
    }
  }
  if (options.dev) connect.push('http://localhost:5173', 'ws://localhost:5173');

  const policy = [
    "default-src 'self'",
    `script-src 'self'${options.dev ? " 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${images.join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "media-src 'self' blob:",
    // The PDF viewer runs its reader in a worker that is part of the app bundle.
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

  return {
    name: 'danna-security-policy',
    transformIndexHtml: (html) => html.replace('%CSP%', policy),
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    // Electron loads the bundle from disk, so asset URLs must be relative.
    base: './',
    plugins: [
      react(),
      securityPolicy({ dev: command === 'serve', supabaseUrl: env.VITE_SUPABASE_URL ?? '' }),
    ],
    server: { port: 5173, strictPort: true },
    // Electron loads the bundle from disk, so one script file is fine; no network cost.
    build: { outDir: 'dist', emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 1000 },
  };
});
