import type { DeviceIcon as DeviceIconValue } from '../state/types';

/** Ícones prontos (24×24, preenchidos; evenodd para os vazados). */
export const PRESET_ICONS: { id: string; name: string; path: string }[] = [
  { id: 'mouse', name: 'Mouse', path: 'M12 2a6 6 0 0 0-6 6v8a6 6 0 0 0 12 0V8a6 6 0 0 0-6-6Zm-.75 3h1.5v5h-1.5z' },
  {
    id: 'skull',
    name: 'Caveira',
    path: 'M12 2C7 2 4 5.5 4 10c0 2.6 1.2 4.4 3 5.4V19a1 1 0 0 0 1 1h1v-2h2v2h2v-2h2v2h1a1 1 0 0 0 1-1v-3.6c1.8-1 3-2.8 3-5.4 0-4.5-3-8-8-8Zm-3.5 7a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM12 13.5l1.2 2.5h-2.4Z',
  },
  {
    id: 'bat',
    name: 'Morcego',
    path: 'M12 9.5c-.7 0-1.2-1.2-1.2-1.2L10 10C8.2 7.6 4.6 7 1.5 8.5c1.6.6 2.6 2.2 2.6 3.8 1.6-.9 3.6-.5 4.3 1 1-.9 2.6-.8 3.6.9 1-1.7 2.6-1.8 3.6-.9.7-1.5 2.7-1.9 4.3-1 0-1.6 1-3.2 2.6-3.8C19.4 7 15.8 7.6 14 10l-.8-1.7s-.5 1.2-1.2 1.2Z',
  },
  { id: 'moon', name: 'Lua', path: 'M14.5 2a9.5 9.5 0 1 0 7.6 14.5A8 8 0 0 1 14.5 2Z' },
  { id: 'crown', name: 'Coroa', path: 'M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7Zm2 13h14v2H5z' },
  { id: 'cross', name: 'Cruz', path: 'M10.5 2h3v5h5v3h-5v12h-3V10h-5V7h5z' },
  {
    id: 'eye',
    name: 'Olho',
    path: 'M12 5C6.5 5 2.7 9.2 1.5 12c1.2 2.8 5 7 10.5 7s9.3-4.2 10.5-7C21.3 9.2 17.5 5 12 5Zm0 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z',
  },
  { id: 'gem', name: 'Gema', path: 'M7 3h10l4 6-9 12L3 9Zm1.2 2L6 8.5h4.3L12 5Zm7.6 0L12 5l1.7 3.5H18ZM6.3 10.5 11 17v-6.5Zm11.4 0H13V17Z' },
  { id: 'flame', name: 'Chama', path: 'M12 2s6 4.8 6 11a6 6 0 0 1-12 0c0-3 1.8-5 1.8-5s.6 2.6 2.4 3.1C10.2 6.6 12 2 12 2Z' },
  { id: 'rose', name: 'Rosa', path: 'M12 2c2.5 0 5 2 5 5 0 3.3-2.4 5.4-5 5.4S7 10.3 7 7c0-3 2.5-5 5-5Zm-.9 11.4h1.8V22h-1.8Zm1.8 4.2c1-1.8 3-2.8 5.1-2.6-.6 2-2.6 3.3-5.1 3.3Zm-1.8-1.2c-.6-1.6-2.4-2.6-4.4-2.4.5 1.8 2.3 2.9 4.4 2.9Z' },
];

export function DeviceIcon({ icon, className = 'h-9 w-9' }: { icon: DeviceIconValue; className?: string }) {
  if (icon.kind === 'image') {
    return <img src={icon.dataUrl} alt="" className={`${className} rounded-md object-cover ring-1 ring-line-strong`} />;
  }
  const preset = PRESET_ICONS.find((p) => p.id === icon.id) ?? PRESET_ICONS[0]!;
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-accent-bright drop-shadow-[0_0_8px_var(--glow)]`} aria-hidden>
      <path fillRule="evenodd" d={preset.path} />
    </svg>
  );
}

/**
 * Desenha o ícone como PNG quadrado, com fundo, para ser o ícone do programa no Windows
 * (janela, barra de tarefas, atalhos).
 */
export async function renderIconPng(icon: DeviceIconValue, size = 256): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');

  const rounded = () => {
    ctx.beginPath();
    ctx.roundRect(size * 0.03, size * 0.03, size * 0.94, size * 0.94, size * 0.22);
  };

  if (icon.kind === 'image') {
    const img = new Image();
    img.src = icon.dataUrl;
    await img.decode();
    ctx.save();
    rounded();
    ctx.clip();
    ctx.drawImage(img, 0, 0, size, size);
    ctx.restore();
    return canvas.toDataURL('image/png');
  }

  const bg = ctx.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#2a1840');
  bg.addColorStop(1, '#0b0711');
  rounded();
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = size * 0.03;
  ctx.strokeStyle = '#7c3aed';
  ctx.stroke();

  const preset = PRESET_ICONS.find((p) => p.id === icon.id) ?? PRESET_ICONS[0]!;
  const scale = (size * 0.62) / 24;
  ctx.save();
  ctx.translate(size * 0.19, size * 0.19);
  ctx.scale(scale, scale);
  ctx.shadowColor = 'rgba(162, 89, 255, 0.9)';
  ctx.shadowBlur = 3;
  const glyph = ctx.createLinearGradient(0, 0, 0, 24);
  glyph.addColorStop(0, '#e9d5ff');
  glyph.addColorStop(1, '#a259ff');
  ctx.fillStyle = glyph;
  ctx.fill(new Path2D(preset.path), 'evenodd');
  ctx.restore();
  return canvas.toDataURL('image/png');
}

/** Reduz a imagem para um quadrado pequeno, para caber no localStorage. */
export async function imageFileToIcon(file: File, size = 96): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');
  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL('image/png');
}
