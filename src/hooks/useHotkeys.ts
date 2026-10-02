import { useEffect, useRef, useState } from 'react';
import { toAccelerator } from '../desktop/accelerator';
import { desktop } from '../desktop/bridge';
import { MODIFIER_CODES, sameHotkey, type Hotkey } from '../state/types';

export interface HotkeyBinding {
  /** Identificador estável, usado pelo atalho global do app desktop. */
  id: string;
  hotkey: Hotkey;
  run: () => void;
}

/**
 * Captura de teclas em andamento (gravador de macro, campo de atalho...).
 * Enquanto houver alguma, os atalhos ficam suspensos, inclusive os globais do desktop,
 * que senão "engoliriam" a combinação que a pessoa está tentando gravar.
 */
let captureDepth = 0;
export function beginKeyCapture(): () => void {
  if (captureDepth++ === 0) void desktop?.suspendHotkeys(true);
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    if (--captureDepth === 0) void desktop?.suspendHotkeys(false);
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return !['checkbox', 'radio', 'range', 'button', 'color'].includes(target.type);
  return false;
}

/**
 * Atalhos de teclado do app.
 * - Navegador: só funcionam com a página em foco.
 * - Desktop: viram atalhos globais do Windows e funcionam com qualquer programa aberto.
 *
 * Retorna os ids dos atalhos que o sistema recusou (já em uso por outro programa).
 */
export function useHotkeys(bindings: HotkeyBinding[]): ReadonlySet<string> {
  const ref = useRef(bindings);
  ref.current = bindings;
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());

  // Desktop: (re)registra quando a lista muda.
  const signature = bindings.map((b) => `${b.id}=${b.hotkey ? toAccelerator(b.hotkey) : ''}`).join('|');
  useEffect(() => {
    if (!desktop) return;
    const list: { id: string; accelerator: string }[] = [];
    const invalid = new Set<string>();
    for (const b of ref.current) {
      const accelerator = toAccelerator(b.hotkey);
      if (accelerator) list.push({ id: b.id, accelerator });
      else invalid.add(b.id);
    }
    let cancelled = false;
    desktop.setHotkeys(list).then((results) => {
      if (cancelled) return;
      results.forEach((r) => !r.ok && invalid.add(r.id));
      setFailed(invalid);
    });
    return () => {
      cancelled = true;
    };
  }, [signature]);

  useEffect(() => {
    if (desktop) {
      return desktop.onHotkey((id) => {
        if (captureDepth > 0) return;
        ref.current.find((b) => b.id === id)?.run();
      });
    }
    const onKey = (e: KeyboardEvent) => {
      if (captureDepth > 0 || e.repeat || MODIFIER_CODES.has(e.code) || isTypingTarget(e.target)) return;
      const binding = ref.current.find((b) => sameHotkey(b.hotkey, {
        ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey, code: e.code,
      }));
      if (!binding) return;
      e.preventDefault();
      binding.run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return failed;
}
