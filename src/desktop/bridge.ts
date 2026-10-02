/** API exposta por electron/preload.cjs. Ausente quando o app roda no navegador. */
export interface DesktopBridge {
  isDesktop: true;
  setHotkeys: (list: { id: string; accelerator: string }[]) => Promise<{ id: string; ok: boolean }[]>;
  suspendHotkeys: (suspended: boolean) => Promise<void>;
  onHotkey: (callback: (id: string) => void) => () => void;
  setIdentity: (identity: { name: string; png: string | null }) => Promise<void>;
  getAutoStart: () => Promise<boolean>;
  setAutoStart: (enabled: boolean) => Promise<boolean>;
  /** Define quais executáveis (ex.: "valorant.exe") vigiar. */
  watchProcesses: (names: string[]) => Promise<void>;
  /** Chamado com os executáveis vigiados que estão abertos, sempre que isso muda. */
  onProcesses: (callback: (running: string[]) => void) => () => void;
  listProcesses: () => Promise<string[]>;
  pickExecutable: () => Promise<string | null>;
}

export const desktop: DesktopBridge | undefined = (window as unknown as { desktop?: DesktopBridge }).desktop;
