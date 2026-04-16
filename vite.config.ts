import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs';

/**
 * Minimal plugin that copies the built sidepanel.html from the nested path
 * to the dist root, and removes the leftover nested directory.
 */
function flattenSidepanel(): Plugin {
  return {
    name: 'flatten-sidepanel',
    closeBundle() {
      const nested = resolve(__dirname, 'dist/src/sidepanel/sidepanel.html');
      const flat = resolve(__dirname, 'dist/sidepanel.html');

      if (!existsSync(nested)) return;

      let html = readFileSync(nested, 'utf-8');
      // Vite with base='./' produces paths like "../../sidepanel.js"
      // We need to strip the relative prefix since we're moving to dist root
      html = html.replace(/\.\.\/\.\.\//g, './');
      writeFileSync(flat, html, 'utf-8');

      // Clean up the nested src directory
      const srcDir = resolve(__dirname, 'dist/src');
      if (existsSync(srcDir)) {
        rmSync(srcDir, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: false, // Keep readable for Chrome Web Store review
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/jira-extractor.ts'),
        sidepanel: resolve(__dirname, 'src/sidepanel/sidepanel.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  publicDir: 'public',
  plugins: [flattenSidepanel()],
});
