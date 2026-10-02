import { MacroLoopMode, safeLoopMode, type Macro } from '../driver/protocol';
import { keyCodeLabel } from '../driver/keycodes';

/** Macro como guardada no app: o id é estável; a posição na lista é o índice no firmware. */
export interface StoredMacro extends Macro {
  id: string;
}

export interface Hotkey {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  /** KeyboardEvent.code da tecla principal. */
  code: string;
  /** Virtual-key do Windows no layout em que o atalho foi gravado (KeyboardEvent.keyCode). */
  vk?: number;
}

/** Atalho que troca qual macro está atribuída a um botão do mouse. */
export interface MacroCycle {
  id: string;
  name: string;
  enabled: boolean;
  /** Índice do botão do mouse (BUTTON_NAMES). */
  button: number;
  macroIds: string[];
  /** Posição atual em macroIds. */
  current: number;
  next: Hotkey | null;
  prev: Hotkey | null;
  mode: MacroLoopMode;
  repeat: number;
}

export type DeviceIcon = { kind: 'preset'; id: string } | { kind: 'image'; dataUrl: string };

export interface DeviceProfile {
  name: string;
  icon: DeviceIcon;
}

export const DEFAULT_PROFILE: DeviceProfile = { name: 'BK-R1X', icon: { kind: 'preset', id: 'mouse' } };

export const MODIFIER_CODES = new Set([
  'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight',
]);

export function hotkeyLabel(h: Hotkey): string {
  return [h.ctrl && 'Ctrl', h.shift && 'Shift', h.alt && 'Alt', h.meta && 'Win', keyCodeLabel(h.code)]
    .filter(Boolean)
    .join(' + ');
}

export function hotkeyFromEvent(e: KeyboardEvent): Hotkey {
  return { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey, code: e.code, vk: e.keyCode || undefined };
}

export function sameHotkey(a: Hotkey, b: Hotkey): boolean {
  return a.code === b.code && a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt && a.meta === b.meta;
}

export function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function newCycle(existing: number): MacroCycle {
  return {
    id: newId(),
    name: `Ciclo ${existing + 1}`,
    enabled: true,
    button: 4,
    macroIds: [],
    current: 0,
    // Ctrl+Win+[ / ] são recusados pelo Windows como atalho global; "." e "," ficam livres
    // e estão na mesma posição no ABNT2 e no americano.
    next: existing === 0 ? { ctrl: true, shift: false, alt: false, meta: true, code: 'Period', vk: 0xbe } : null,
    prev: existing === 0 ? { ctrl: true, shift: false, alt: false, meta: true, code: 'Comma', vk: 0xbc } : null,
    mode: MacroLoopMode.FixedCount,
    repeat: 1,
  };
}

// ---------------------------------------------------------------------------
// Persistência local
// ---------------------------------------------------------------------------

export function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Armazenamento indisponível (modo privado, cota cheia); segue sem persistir.
  }
}

/** Macros salvas pela versão anterior não tinham id. */
export function loadMacros(): StoredMacro[] {
  const raw = loadStored<(Macro & { id?: string })[]>('bkr1x.macros', []);
  return Array.isArray(raw) ? raw.map((m) => ({ ...m, id: m.id ?? newId(), events: m.events ?? [] })) : [];
}

/** Ciclos salvos com o modo 1 (loop infinito, removido) voltam para "executar N vezes". */
export function loadCycles(): MacroCycle[] {
  const raw = loadStored<MacroCycle[]>('bkr1x.cycles', []);
  return Array.isArray(raw) ? raw.map((c) => ({ ...c, mode: safeLoopMode(c.mode) })) : [];
}
