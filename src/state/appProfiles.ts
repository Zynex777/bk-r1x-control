import { BUTTON_COUNT, MacroLoopMode, macroAction, safeLoopMode, type ButtonAction } from '../driver/protocol';
import { loadStored, newId, type StoredMacro } from './types';

/** O que um perfil coloca num botão enquanto o programa está aberto. */
export interface ProfileOverride {
  macroId: string;
  mode: MacroLoopMode;
  repeat: number;
}

/**
 * Perfil por programa: enquanto algum dos executáveis estiver aberto, os botões listados
 * em `overrides` recebem essas macros. Quando todos fecham, os botões voltam ao padrão
 * (o mapeamento da seção Botões).
 */
export interface AppProfile {
  id: string;
  name: string;
  enabled: boolean;
  /** Nomes de executável em minúsculas, ex.: "valorant.exe". */
  exes: string[];
  /** Índice do botão (como string, por causa do JSON) → macro. */
  overrides: Record<string, ProfileOverride>;
}

export function newAppProfile(existing: number): AppProfile {
  return { id: newId(), name: `Perfil ${existing + 1}`, enabled: true, exes: [], overrides: {} };
}

export function normalizeExe(name: string): string {
  const base = name.trim().split(/[\\/]/).pop() ?? '';
  if (!base) return '';
  return (base.toLowerCase().endsWith('.exe') ? base : `${base}.exe`).toLowerCase();
}

export function sanitizeAppProfiles(raw: unknown): AppProfile[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p: Partial<AppProfile>) => ({
    id: typeof p.id === 'string' ? p.id : newId(),
    name: String(p.name ?? 'Perfil'),
    enabled: p.enabled !== false,
    exes: Array.isArray(p.exes) ? p.exes.map((e) => normalizeExe(String(e))).filter(Boolean) : [],
    overrides: Object.fromEntries(
      Object.entries(p.overrides ?? {})
        .filter(([button, o]) => Number(button) > 0 && Number(button) < BUTTON_COUNT && o && typeof o.macroId === 'string')
        .map(([button, o]) => [button, { macroId: o.macroId, mode: safeLoopMode(o.mode), repeat: Math.max(1, Math.min(255, Number(o.repeat) || 1)) }]),
    ),
  }));
}

export function loadAppProfiles(): AppProfile[] {
  return sanitizeAppProfiles(loadStored('bkr1x.appProfiles', []));
}

/** Todos os executáveis vigiados pelos perfis ligados. */
export function watchedExes(profiles: readonly AppProfile[]): string[] {
  return [...new Set(profiles.filter((p) => p.enabled).flatMap((p) => p.exes))].sort();
}

/** O primeiro perfil ligado (ordem da lista = prioridade) com algum programa aberto. */
export function pickActiveProfile(profiles: readonly AppProfile[], running: ReadonlySet<string>): AppProfile | null {
  return profiles.find((p) => p.enabled && p.exes.some((e) => running.has(e))) ?? null;
}

/** Botões efetivos = padrão + trocas do perfil ativo. Macros apagadas são ignoradas. */
export function effectiveButtons(
  base: readonly ButtonAction[],
  profile: AppProfile | null,
  macros: readonly StoredMacro[],
): { buttons: ButtonAction[]; overridden: Set<number> } {
  const buttons = base.map((b) => ({ ...b }));
  const overridden = new Set<number>();
  if (!profile) return { buttons, overridden };
  for (const [key, o] of Object.entries(profile.overrides)) {
    const button = Number(key);
    const index = macros.findIndex((m) => m.id === o.macroId);
    if (index < 0 || button <= 0 || button >= buttons.length) continue;
    buttons[button] = macroAction(index, o.mode, o.repeat);
    overridden.add(button);
  }
  return { buttons, overridden };
}

export function sameButtons(a: readonly ButtonAction[], b: readonly ButtonAction[]): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i]!;
      return x.type === y.type && x.code1 === y.code1 && x.code2 === y.code2 && x.code3 === y.code3;
    })
  );
}
