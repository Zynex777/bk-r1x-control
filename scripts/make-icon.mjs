// Gera o ícone padrão do programa (usado no .exe, no instalador e antes de a pessoa
// escolher um ícone). Mesmo desenho que renderIconPng() em src/components/DeviceIcon.tsx.
// Uso: node scripts/make-icon.mjs
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';

const MOUSE = 'M12 2a6 6 0 0 0-6 6v8a6 6 0 0 0 12 0V8a6 6 0 0 0-6-6Zm-.75 3h1.5v5h-1.5z';
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a1840"/><stop offset="1" stop-color="#0b0711"/>
    </linearGradient>
    <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e9d5ff"/><stop offset="1" stop-color="#a259ff"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#a259ff" stop-opacity="0.55"/><stop offset="1" stop-color="#a259ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="7.7" y="7.7" width="240.6" height="240.6" rx="56" fill="url(#bg)" stroke="#7c3aed" stroke-width="7.7"/>
  <circle cx="128" cy="128" r="96" fill="url(#glow)"/>
  <g transform="translate(48.6 48.6) scale(6.613)">
    <path d="${MOUSE}" fill="url(#fg)" fill-rule="evenodd"/>
  </g>
</svg>`;

const png = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng();
fs.mkdirSync('build', { recursive: true });
fs.writeFileSync('build/icon.png', png);
fs.writeFileSync('electron/icon.png', new Resvg(svg, { fitTo: { mode: 'width', value: 256 } }).render().asPng());
console.log('build/icon.png e electron/icon.png gerados');
