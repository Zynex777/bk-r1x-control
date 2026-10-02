import { useLayoutEffect, useRef, useState } from 'react';
import { keyCodeLabel } from '../driver/keycodes';

type Key = [code: string, width?: number] | number; // número = espaço vazio com essa largura

const FN_ROW: Key[] = [['Escape'], 1, ['F1'], ['F2'], ['F3'], ['F4'], 0.5, ['F5'], ['F6'], ['F7'], ['F8'], 0.5, ['F9'], ['F10'], ['F11'], ['F12']];

/** Bloco principal no layout ABNT2 (15 unidades de largura por linha). */
const MAIN: Key[][] = [
  [['Backquote'], ['Digit1'], ['Digit2'], ['Digit3'], ['Digit4'], ['Digit5'], ['Digit6'], ['Digit7'], ['Digit8'], ['Digit9'], ['Digit0'], ['Minus'], ['Equal'], ['Backspace', 2]],
  [['Tab', 1.5], ['KeyQ'], ['KeyW'], ['KeyE'], ['KeyR'], ['KeyT'], ['KeyY'], ['KeyU'], ['KeyI'], ['KeyO'], ['KeyP'], ['BracketLeft'], ['BracketRight'], ['Enter', 1.5]],
  [['CapsLock', 1.75], ['KeyA'], ['KeyS'], ['KeyD'], ['KeyF'], ['KeyG'], ['KeyH'], ['KeyJ'], ['KeyK'], ['KeyL'], ['Semicolon'], ['Quote'], ['Backslash'], ['Enter', 1.25]],
  [['ShiftLeft', 1.25], ['IntlBackslash'], ['KeyZ'], ['KeyX'], ['KeyC'], ['KeyV'], ['KeyB'], ['KeyN'], ['KeyM'], ['Comma'], ['Period'], ['Slash'], ['IntlRo'], ['ShiftRight', 1.75]],
  [['ControlLeft', 1.25], ['MetaLeft', 1.25], ['AltLeft', 1.25], ['Space', 6.25], ['AltRight', 1.25], ['MetaRight', 1.25], ['ContextMenu', 1.25], ['ControlRight', 1.25]],
];

const NAV_FN: Key[] = [['PrintScreen'], ['ScrollLock'], ['Pause']];
const NAV: Key[][] = [
  [['Insert'], ['Home'], ['PageUp']],
  [['Delete'], ['End'], ['PageDown']],
  [3],
  [1, ['ArrowUp'], 1],
  [['ArrowLeft'], ['ArrowDown'], ['ArrowRight']],
];

const NUMPAD: Key[][] = [
  [['NumLock'], ['NumpadDivide'], ['NumpadMultiply'], ['NumpadSubtract']],
  [['Numpad7'], ['Numpad8'], ['Numpad9'], ['NumpadAdd']],
  [['Numpad4'], ['Numpad5'], ['Numpad6'], ['NumpadComma']],
  [['Numpad1'], ['Numpad2'], ['Numpad3'], ['NumpadEnter']],
  [['Numpad0', 2], ['NumpadDecimal'], 1],
];

const SHORT: Record<string, string> = {
  Escape: 'Esc', Backspace: '⌫', CapsLock: 'Caps', Enter: 'Enter ↵', ShiftLeft: 'Shift', ShiftRight: 'Shift',
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl', MetaLeft: 'Win', MetaRight: 'Win', AltLeft: 'Alt', AltRight: 'AltGr',
  ContextMenu: 'Menu', Space: '', PrintScreen: 'Prt', ScrollLock: 'Scr', Pause: 'Pau', Insert: 'Ins', Home: 'Hm',
  Delete: 'Del', End: 'End', PageUp: 'PgU', PageDown: 'PgD', NumLock: 'Num', NumpadDivide: '/', NumpadMultiply: '*',
  NumpadSubtract: '−', NumpadAdd: '+', NumpadEnter: 'Ent', NumpadDecimal: ',', NumpadComma: '.',
};

const label = (code: string) => SHORT[code] ?? keyCodeLabel(code).replace(/^Num /, '');

const UNIT = 2.4; // rem

interface VisualKeyboardProps {
  onPress: (code: string) => void;
  /** Teclas destacadas (ex.: modificadores ligados, tecla escolhida). */
  highlighted?: ReadonlySet<string>;
  disabled?: boolean;
  /** Esconde o bloco numérico para economizar espaço. */
  compact?: boolean;
}

export function VisualKeyboard({ onPress, highlighted, disabled, compact }: VisualKeyboardProps) {
  // Reduz o teclado inteiro para caber na largura disponível, sem rolagem horizontal.
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const fit = () => {
      // Largura renderizada dividida pelo zoom atual = largura natural.
      const natural = inner.getBoundingClientRect().width / scaleRef.current;
      const next = Math.min(1, outer.clientWidth / natural);
      if (Math.abs(next - scaleRef.current) > 0.005) {
        scaleRef.current = next;
        setScale(next);
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [compact]);

  const row = (keys: Key[], i: number) => (
    <div key={i} className="flex gap-1">
      {keys.map((k, j) =>
        typeof k === 'number' ? (
          <div key={j} style={{ width: `${k * UNIT + (k - 1) * 0.25}rem` }} className="shrink-0" />
        ) : (
          <KeyCap key={j} code={k[0]} width={k[1] ?? 1} active={highlighted?.has(k[0]) ?? false} disabled={disabled} onPress={onPress} />
        ),
      )}
    </div>
  );

  return (
    <div ref={outerRef} className="w-full">
      <div
        ref={innerRef}
        style={{ zoom: scale }}
        className="inline-flex gap-4 rounded-lg border border-line bg-void/80 p-3 shadow-[inset_0_2px_12px_rgb(0_0_0/0.6)]"
      >
        <div className="flex flex-col gap-1">
          {row(FN_ROW, -1)}
          <div className="h-1" />
          {MAIN.map(row)}
        </div>
        <div className="flex flex-col gap-1">
          {row(NAV_FN, -1)}
          <div className="h-1" />
          {NAV.map(row)}
        </div>
        {!compact && (
          <div className="flex flex-col gap-1">
            <div style={{ height: `${UNIT}rem` }} />
            <div className="h-1" />
            {NUMPAD.map(row)}
          </div>
        )}
      </div>
    </div>
  );
}

function KeyCap({ code, width, active, disabled, onPress }: {
  code: string;
  width: number;
  active: boolean;
  disabled?: boolean;
  onPress: (code: string) => void;
}) {
  const text = label(code);
  return (
    <button
      type="button"
      disabled={disabled}
      title={keyCodeLabel(code)}
      onClick={() => onPress(code)}
      style={{ width: `${width * UNIT + (width - 1) * 0.25}rem`, height: `${UNIT}rem` }}
      className={`shrink-0 truncate rounded-[5px] border border-b-[3px] px-1 text-[11px] font-medium transition active:translate-y-px active:border-b disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-accent border-b-accent-deep bg-accent/25 text-white shadow-[0_0_14px_-3px_var(--color-accent)]'
          : 'border-line-strong border-b-[#0d0913] bg-panel-2 text-ink hover:border-accent/70 hover:text-white'
      }`}
    >
      {text}
    </button>
  );
}
