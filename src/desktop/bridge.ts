/** API exposta por electron/preload.cjs. Ausente quando o app roda no navegador. */
export interface DesktopBridge {
  isDesktop: true;
  setHotkeys: (list: { id: string; accelerator: string }[]) => Promise<{ id: string; ok: boolean }[]>;
  suspendHotkeys: (suspended: boolean) => Promise<void>;
  onHotkey: (callback: (id: string) => void) => () => void;
  setIdentity: (identity: { name: string; png: string | null }) => Promise<void>;
  getAutoStart: () => Promise<boolean>;
  setAutoStart: (enabled: boolean) => Promise<boolean>;
}

export const desktop: DesktopBridge | undefined = (window as unknown as { desktop?: DesktopBridge }).desktop;
