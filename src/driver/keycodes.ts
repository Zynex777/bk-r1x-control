import { ActionType, type ButtonAction, type Macro } from './protocol';

export interface NamedAction extends ButtonAction {
  name: string;
}

const action = (name: string, type: number, code1: number, code2 = 0, code3 = 0): NamedAction => ({
  name,
  type,
  code1,
  code2,
  code3,
});

export const MOUSE_ACTIONS: NamedAction[] = [
  action('Clique esquerdo', ActionType.MouseButton, 0x01),
  action('Clique direito', ActionType.MouseButton, 0x02),
  action('Clique do meio', ActionType.MouseButton, 0x04),
  action('Voltar', ActionType.MouseButton, 0x08),
  action('Avançar', ActionType.MouseButton, 0x10),
  action('Roda para cima', ActionType.MouseFunction, 0x38, 0x01),
  action('Roda para baixo', ActionType.MouseFunction, 0x38, 0xff),
  action('Ciclo de DPI', ActionType.MouseFunction, 0x55),
  action('Desativado', ActionType.MouseButton, 0x00),
];

/** Consumer Page (0x0C): code1 = byte baixo, code2 = byte alto. */
export const MEDIA_ACTIONS: NamedAction[] = [
  action('Volume +', ActionType.Media, 0xe9),
  action('Volume −', ActionType.Media, 0xea),
  action('Mudo', ActionType.Media, 0xe2),
  action('Play/Pausa', ActionType.Media, 0xcd),
  action('Parar', ActionType.Media, 0xb7),
  action('Faixa anterior', ActionType.Media, 0xb6),
  action('Próxima faixa', ActionType.Media, 0xb5),
  action('Player de mídia', ActionType.Media, 0x83, 0x01),
  action('Página inicial', ActionType.Media, 0x23, 0x02),
  action('Atualizar página', ActionType.Media, 0x27, 0x02),
  action('Parar página', ActionType.Media, 0x26, 0x02),
  action('Avançar página', ActionType.Media, 0x25, 0x02),
  action('Voltar página', ActionType.Media, 0x24, 0x02),
  action('Favoritos', ActionType.Media, 0x2a, 0x02),
  action('Pesquisar', ActionType.Media, 0x21, 0x02),
  action('Calculadora', ActionType.Media, 0x92, 0x01),
  action('Meu Computador', ActionType.Media, 0x94, 0x01),
  action('E-mail', ActionType.Media, 0x8a, 0x01),
];

export const Modifier = {
  Ctrl: 0x01,
  Shift: 0x02,
  Alt: 0x04,
  Win: 0x08,
} as const;

/** KeyboardEvent.code → HID usage ID (Keyboard/Keypad page 0x07). */
export const KEY_CODE_TO_HID: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < 26; i++) map[`Key${String.fromCharCode(65 + i)}`] = 0x04 + i;
  for (let i = 1; i <= 9; i++) map[`Digit${i}`] = 0x1e + i - 1;
  map.Digit0 = 0x27;
  for (let i = 1; i <= 12; i++) map[`F${i}`] = 0x3a + i - 1;
  for (let i = 13; i <= 24; i++) map[`F${i}`] = 0x68 + i - 13;
  for (let i = 1; i <= 9; i++) map[`Numpad${i}`] = 0x59 + i - 1;
  Object.assign(map, {
    Enter: 0x28, Escape: 0x29, Backspace: 0x2a, Tab: 0x2b, Space: 0x2c,
    Minus: 0x2d, Equal: 0x2e, BracketLeft: 0x2f, BracketRight: 0x30, Backslash: 0x31,
    IntlBackslash: 0x64, Semicolon: 0x33, Quote: 0x34, Backquote: 0x35, Comma: 0x36,
    Period: 0x37, Slash: 0x38, IntlRo: 0x87, CapsLock: 0x39,
    PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48, Insert: 0x49, Home: 0x4a,
    PageUp: 0x4b, Delete: 0x4c, End: 0x4d, PageDown: 0x4e,
    ArrowRight: 0x4f, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52,
    NumLock: 0x53, NumpadDivide: 0x54, NumpadMultiply: 0x55, NumpadSubtract: 0x56,
    NumpadAdd: 0x57, NumpadEnter: 0x58, Numpad0: 0x62, NumpadDecimal: 0x63,
    NumpadComma: 0x85, ContextMenu: 0x65,
    ControlLeft: 0xe0, ShiftLeft: 0xe1, AltLeft: 0xe2, MetaLeft: 0xe3,
    ControlRight: 0xe4, ShiftRight: 0xe5, AltRight: 0xe6, MetaRight: 0xe7,
  });
  return map;
})();

const HID_TO_KEY_CODE: Record<number, string> = Object.fromEntries(
  Object.entries(KEY_CODE_TO_HID).map(([code, hid]) => [hid, code]),
);

/** Rótulos no layout ABNT2. O HID identifica a posição física, não o caractere. */
const KEY_LABELS: Record<string, string> = {
  Enter: 'Enter', Escape: 'Esc', Backspace: 'Backspace', Tab: 'Tab', Space: 'Espaço',
  Backquote: "'", Minus: '-', Equal: '=', BracketLeft: '´', BracketRight: '[', Backslash: ']',
  Semicolon: 'Ç', Quote: '~', IntlBackslash: '\\', Comma: ',', Period: '.', Slash: ';', IntlRo: '/',
  CapsLock: 'Caps Lock', PrintScreen: 'Print Screen', ScrollLock: 'Scroll Lock', Pause: 'Pause',
  Insert: 'Insert', Home: 'Home', End: 'End', Delete: 'Delete', PageUp: 'Page Up', PageDown: 'Page Down',
  ArrowRight: '→', ArrowLeft: '←', ArrowDown: '↓', ArrowUp: '↑', NumLock: 'Num Lock',
  NumpadDivide: 'Num /', NumpadMultiply: 'Num *', NumpadSubtract: 'Num -', NumpadAdd: 'Num +',
  NumpadEnter: 'Num Enter', NumpadDecimal: 'Num ,', NumpadComma: 'Num .', ContextMenu: 'Menu',
  ControlLeft: 'Ctrl', ShiftLeft: 'Shift', AltLeft: 'Alt', MetaLeft: 'Win',
  ControlRight: 'Ctrl dir.', ShiftRight: 'Shift dir.', AltRight: 'AltGr', MetaRight: 'Win dir.',
};

export function keyCodeLabel(code: string): string {
  return KEY_LABELS[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad(\d)$/, 'Num $1');
}

export function hidKeyLabel(usage: number): string {
  const code = HID_TO_KEY_CODE[usage];
  return code ? keyCodeLabel(code) : `0x${usage.toString(16).padStart(2, '0')}`;
}

/** Teclas que aparecem no seletor de atribuição (exclui modificadores, que viram flags). */
export const KEYBOARD_KEYS: { label: string; usage: number }[] = Object.entries(KEY_CODE_TO_HID)
  .filter(([, usage]) => usage < 0xe0)
  .sort(([, a], [, b]) => a - b)
  .map(([, usage]) => ({ label: hidKeyLabel(usage), usage }));

export const MOUSE_BUTTON_LABELS: Record<number, string> = {
  1: 'Clique esquerdo',
  2: 'Clique direito',
  4: 'Clique do meio',
  8: 'Botão voltar',
  16: 'Botão avançar',
};

/** MouseEvent.button → bitmask usado pelo firmware. */
export const MOUSE_EVENT_BUTTON_TO_CODE = [1, 4, 2, 8, 16] as const;

export function keyboardAction(modifiers: number, usage: number): ButtonAction {
  return { type: ActionType.Keyboard, code1: modifiers, code2: usage, code3: 0 };
}

export function sameAction(a: ButtonAction, b: ButtonAction): boolean {
  return a.type === b.type && a.code1 === b.code1 && a.code2 === b.code2 && a.code3 === b.code3;
}

export function describeAction(a: ButtonAction, macros: readonly Macro[] = []): string {
  const known = [...MOUSE_ACTIONS, ...MEDIA_ACTIONS].find((k) => sameAction(k, a));
  if (known) return known.name;

  switch (a.type) {
    case ActionType.Keyboard: {
      const mods = [
        a.code1 & Modifier.Ctrl ? 'Ctrl' : '',
        a.code1 & Modifier.Shift ? 'Shift' : '',
        a.code1 & Modifier.Alt ? 'Alt' : '',
        a.code1 & Modifier.Win ? 'Win' : '',
        a.code1 & 0x10 ? 'Ctrl dir.' : '',
        a.code1 & 0x20 ? 'Shift dir.' : '',
        a.code1 & 0x40 ? 'AltGr' : '',
        a.code1 & 0x80 ? 'Win dir.' : '',
      ].filter(Boolean);
      const key = a.code2 ? [hidKeyLabel(a.code2)] : [];
      return [...mods, ...key].join(' + ') || 'Tecla vazia';
    }
    case ActionType.Macro:
      return `Macro: ${macros[a.code1]?.name ?? `#${a.code1 + 1}`}${a.code3 === 1 ? ' ⚠ loop infinito' : ''}`;
    case ActionType.Dpi:
      return 'Ciclo de DPI';
    case ActionType.Media:
      return `Mídia 0x${(a.code1 | (a.code2 << 8)).toString(16)}`;
    default:
      return `Personalizado (${[a.type, a.code1, a.code2, a.code3].map((b) => b.toString(16)).join(' ')})`;
  }
}
