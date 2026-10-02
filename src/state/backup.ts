import { safeLoopMode } from '../driver/protocol';
import { sanitizeAppProfiles, type AppProfile } from './appProfiles';
import { THEMES, type ThemeId } from './theme';
import { DEFAULT_PROFILE, newId, type DeviceProfile, type MacroCycle, type StoredMacro } from './types';

/**
 * Arquivo de backup das configurações que ficam só no computador (o navegador e o app
 * instalado têm armazenamentos separados). DPI, botões etc. ficam no próprio mouse.
 */
export interface Backup {
  app: 'bk-r1x-control';
  version: 1;
  exportedAt: string;
  macros: StoredMacro[];
  cycles: MacroCycle[];
  profile: DeviceProfile;
  dpiColors: string[];
  appProfiles: AppProfile[];
  theme?: ThemeId;
}

export function makeBackup(data: Omit<Backup, 'app' | 'version' | 'exportedAt'>): Backup {
  return { app: 'bk-r1x-control', version: 1, exportedAt: new Date().toISOString(), ...data };
}

export function downloadBackup(backup: Backup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bk-r1x-backup-${backup.exportedAt.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Valida o arquivo e normaliza campos antigos ou perigosos (ex.: modo de loop 1). */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um backup válido.');
  }
  const b = raw as Partial<Backup>;
  if (!b || b.app !== 'bk-r1x-control' || !Array.isArray(b.macros)) {
    throw new Error('Este arquivo não é um backup do BK-R1X Control.');
  }
  const macros: StoredMacro[] = b.macros.map((m) => ({
    id: typeof m.id === 'string' ? m.id : newId(),
    name: String(m.name ?? 'Macro'),
    events: Array.isArray(m.events) ? m.events : [],
  }));
  const ids = new Set(macros.map((m) => m.id));
  const cycles: MacroCycle[] = (Array.isArray(b.cycles) ? b.cycles : []).map((c) => ({
    ...c,
    mode: safeLoopMode(c.mode),
    macroIds: (c.macroIds ?? []).filter((id) => ids.has(id)),
  }));
  // Perfis por programa: só macros que vieram no mesmo arquivo.
  const appProfiles = sanitizeAppProfiles(b.appProfiles).map((p) => ({
    ...p,
    overrides: Object.fromEntries(Object.entries(p.overrides).filter(([, o]) => ids.has(o.macroId))),
  }));
  return {
    app: 'bk-r1x-control',
    version: 1,
    exportedAt: String(b.exportedAt ?? ''),
    macros,
    cycles,
    appProfiles,
    theme: THEMES.some((t) => t.id === b.theme) ? b.theme : undefined,
    profile: { ...DEFAULT_PROFILE, ...(b.profile ?? {}) },
    dpiColors: Array.isArray(b.dpiColors) ? b.dpiColors.map(String) : [],
  };
}
