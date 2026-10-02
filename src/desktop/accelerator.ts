import type { Hotkey } from '../state/types';

/**
 * Converte um atalho para o formato de "accelerator" do Electron.
 *
 * O Electron transforma o caractere do accelerator num virtual-key code com a tabela
 * do layout americano e registra esse VK no Windows. Por isso partimos do VK que a
 * tecla gerou no layout da pessoa (KeyboardEvent.keyCode) e escolhemos o caractere
 * americano com o mesmo VK. Assim o "[" do ABNT2 vira o atalho certo.
 */
const VK_TO_ACCEL: Record<number, string> = {
  0x08: 'Backspace', 0x09: 'Tab', 0x0d: 'Enter', 0x13: 'Pause', 0x14: 'Capslock', 0x1b: 'Esc', 0x20: 'Space',
  0x21: 'PageUp', 0x22: 'PageDown', 0x23: 'End', 0x24: 'Home', 0x25: 'Left', 0x26: 'Up', 0x27: 'Right', 0x28: 'Down',
  0x2c: 'PrintScreen', 0x2d: 'Insert', 0x2e: 'Delete',
  0x60: 'num0', 0x61: 'num1', 0x62: 'num2', 0x63: 'num3', 0x64: 'num4', 0x65: 'num5', 0x66: 'num6', 0x67: 'num7',
  0x68: 'num8', 0x69: 'num9', 0x6a: 'nummult', 0x6b: 'numadd', 0x6d: 'numsub', 0x6e: 'numdec', 0x6f: 'numdiv',
  0x90: 'Numlock', 0x91: 'Scrolllock',
  0xba: ';', 0xbb: '=', 0xbc: ',', 0xbd: '-', 0xbe: '.', 0xbf: '/', 0xc0: '`', 0xdb: '[', 0xdc: '\\', 0xdd: ']', 0xde: "'",
};
for (let i = 0; i <= 9; i++) VK_TO_ACCEL[0x30 + i] = String(i);
for (let i = 0; i < 26; i++) VK_TO_ACCEL[0x41 + i] = String.fromCharCode(65 + i);
for (let i = 1; i <= 24; i++) VK_TO_ACCEL[0x6f + i] = `F${i}`;

/** Atalhos salvos antes de existir o campo `vk`: usa a posição física no padrão americano. */
const CODE_TO_VK: Record<string, number> = {
  Backquote: 0xc0, Minus: 0xbd, Equal: 0xbb, BracketLeft: 0xdb, BracketRight: 0xdd, Backslash: 0xdc,
  Semicolon: 0xba, Quote: 0xde, Comma: 0xbc, Period: 0xbe, Slash: 0xbf,
  Space: 0x20, Enter: 0x0d, Tab: 0x09, Backspace: 0x08, Escape: 0x1b, Insert: 0x2d, Delete: 0x2e, Home: 0x24,
  End: 0x23, PageUp: 0x21, PageDown: 0x22, ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28,
  PrintScreen: 0x2c, ScrollLock: 0x91, Pause: 0x13, NumLock: 0x90,
  NumpadMultiply: 0x6a, NumpadAdd: 0x6b, NumpadSubtract: 0x6d, NumpadDecimal: 0x6e, NumpadDivide: 0x6f,
};

function vkFromCode(code: string): number | undefined {
  if (CODE_TO_VK[code] !== undefined) return CODE_TO_VK[code];
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1]!.charCodeAt(0);
  m = /^Digit(\d)$/.exec(code);
  if (m) return 0x30 + Number(m[1]);
  m = /^Numpad(\d)$/.exec(code);
  if (m) return 0x60 + Number(m[1]);
  m = /^F(\d+)$/.exec(code);
  if (m) return 0x6f + Number(m[1]);
  return undefined;
}

/** Retorna null se a tecla não puder ser usada como atalho global. */
export function toAccelerator(h: Hotkey): string | null {
  const vk = h.vk ?? vkFromCode(h.code);
  const key = vk !== undefined ? VK_TO_ACCEL[vk] : undefined;
  if (!key) return null;
  return [h.ctrl && 'Control', h.alt && 'Alt', h.shift && 'Shift', h.meta && 'Super', key].filter(Boolean).join('+');
}
