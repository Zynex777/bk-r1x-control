import type { BatteryStatus, ConnectionMode } from '../driver/protocol';
import { DEFAULT_PROFILE, type DeviceProfile } from '../state/types';
import { DeviceIcon } from './DeviceIcon';
import { Button } from './ui';

export type ConnectionStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected';

interface HeaderProps {
  status: ConnectionStatus;
  mode: ConnectionMode | null;
  online: boolean;
  battery: BatteryStatus | null;
  profile: DeviceProfile;
  saving: boolean;
  /** Perfil por programa ativo agora, se houver. */
  activeProfileName: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Header({ status, mode, online, battery, profile, saving, activeProfileName, onConnect, onDisconnect }: HeaderProps) {
  const connected = status === 'connected';
  const dot = !connected ? 'bg-muted' : online ? 'bg-ok shadow-[0_0_10px_var(--color-ok)]' : 'bg-warn';
  const statusText =
    status === 'unsupported'
      ? 'Navegador sem WebHID'
      : status === 'connecting'
        ? 'Procurando…'
        : !connected
          ? 'Desconectado'
          : online
            ? mode === 'USB'
              ? 'Cabo USB'
              : 'Sem fio 2.4G'
            : 'Mouse dormindo ou desligado';

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-void/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <DeviceIcon icon={profile.icon} />
          <div className="min-w-0">
            <div className="truncate font-[family-name:var(--font-sigil)] text-lg leading-tight font-bold tracking-wide text-ink">
              {profile.name || DEFAULT_PROFILE.name}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className={`h-2 w-2 rotate-45 ${dot}`} />
              {statusText}
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-5">
          {activeProfileName && (
            <span
              className="hidden max-w-48 truncate rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-bright md:inline"
              title="Perfil por programa ativo"
            >
              ▶ {activeProfileName}
            </span>
          )}
          {connected && online && (
            <span className={`hidden items-center gap-1.5 text-xs sm:flex ${saving ? 'text-accent-bright' : 'text-muted'}`}>
              {saving ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  Salvando no mouse…
                </>
              ) : (
                <>✓ Salvo no mouse</>
              )}
            </span>
          )}
          {connected && online && battery && <BatteryIndicator battery={battery} />}
          {connected ? (
            <Button size="sm" onClick={onDisconnect}>Desconectar</Button>
          ) : (
            <Button variant="primary" onClick={onConnect} disabled={status !== 'disconnected'}>
              Conectar mouse
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function BatteryIndicator({ battery }: { battery: BatteryStatus }) {
  const level = Math.max(0, Math.min(100, battery.level));
  const color = level <= 15 ? 'bg-danger' : level <= 35 ? 'bg-warn' : 'bg-gradient-to-r from-accent-deep to-accent';
  return (
    <div className="flex items-center gap-2" title={battery.charging ? 'Carregando' : `Bateria ${level}%`}>
      <div className="relative flex h-4 w-8 items-center rounded-[3px] border-2 border-line-strong p-px">
        <div className={`h-full rounded-[1px] ${color}`} style={{ width: `${level}%` }} />
        <div className="absolute -right-[5px] h-1.5 w-[3px] rounded-r-sm bg-line-strong" />
      </div>
      <span className="text-sm font-semibold text-ink tabular-nums">{level}%</span>
      {battery.charging && (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-warn" aria-label="Carregando">
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </svg>
      )}
    </div>
  );
}
