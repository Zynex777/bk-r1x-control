import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Caminhos relativos: o app desktop carrega o build via file://.
  base: './',
  plugins: [react(), tailwindcss()],
});
