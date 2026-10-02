import { useRef, useState } from 'react';
import { desktop } from '../desktop/bridge';
import type { ConnectionMode } from '../driver/protocol';
import { DEFAULT_PROFILE, type DeviceProfile } from '../state/types';
import { DeviceIcon, PRESET_ICONS, imageFileToIcon } from './DeviceIcon';
import { Button, Field, Panel, inputClass } from './ui';

interface DeviceSettingsProps {
  profile: DeviceProfile;
  firmware: string | null;
  mode: ConnectionMode | null;
  disabled: boolean;
  onProfile: (profile: DeviceProfile) => void;
  onFactoryReset: () => void;
}

export function DeviceSettings({ profile, firmware, mode, disabled, onProfile, onFactoryReset }: DeviceSettingsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      onProfile({ ...profile, icon: { kind: 'image', dataUrl: await imageFileToIcon(file) } });
    } catch {
      setError('Não foi possível ler esta imagem. Tente um PNG ou JPG.');
    }
  };

  return (
    <div className="space-y-5">
      <Panel
        title="Identidade"
        subtitle={
          desktop
            ? 'O nome e o ícone também viram o nome e o ícone do programa: janela, barra de tarefas, bandeja e atalhos do Windows.'
            : 'O nome e o ícone ficam salvos só neste computador e aparecem no topo da página.'
        }
      >
        <div className="grid gap-8 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-line-strong bg-void/70 shadow-[inset_0_0_30px_color-mix(in_srgb,var(--color-accent)_18%,transparent)]">
              <DeviceIcon icon={profile.icon} className="h-16 w-16" />
            </div>
            <span className="gothic-title max-w-40 truncate text-sm text-ink">{profile.name || DEFAULT_PROFILE.name}</span>
          </div>

          <div className="space-y-6">
            <Field label="Nome do mouse">
              <input
                className={inputClass}
                value={profile.name}
                maxLength={24}
                placeholder={DEFAULT_PROFILE.name}
                onChange={(e) => onProfile({ ...profile, name: e.target.value })}
              />
            </Field>

            <Field label="Ícone">
              <div className="flex flex-wrap gap-2">
                {PRESET_ICONS.map((p) => {
                  const active = profile.icon.kind === 'preset' && profile.icon.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      title={p.name}
                      aria-label={p.name}
                      onClick={() => onProfile({ ...profile, icon: { kind: 'preset', id: p.id } })}
                      className={`flex h-12 w-12 items-center justify-center rounded-md border transition ${
                        active ? 'border-accent bg-accent/15' : 'border-line bg-void/60 hover:border-line-strong'
                      }`}
                    >
                      <DeviceIcon icon={{ kind: 'preset', id: p.id }} className="h-6 w-6" />
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={`flex h-12 items-center justify-center rounded-md border border-dashed px-3 text-xs transition ${
                    profile.icon.kind === 'image' ? 'border-accent text-accent-bright' : 'border-line-strong text-muted hover:text-ink'
                  }`}
                >
                  {profile.icon.kind === 'image' ? 'Trocar imagem' : '+ Sua imagem'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} />
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
            </Field>
          </div>
        </div>
      </Panel>

      <Panel title="Informações">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <Info label="Modelo" value="BK-R1X" />
          <Info label="Conexão" value={mode === 'USB' ? 'Cabo USB' : mode === '2.4G' ? 'Receptor 2.4G' : '—'} />
          <Info label="Firmware" value={firmware ?? '—'} />
        </dl>
      </Panel>

      <Panel title="Padrão de fábrica" subtitle="Restaura DPI, polling, sensor, energia e botões. Macros e ciclos salvos neste computador são mantidos.">
        <Button variant="danger" disabled={disabled} onClick={onFactoryReset}>Restaurar padrão de fábrica</Button>
      </Panel>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-void/50 px-4 py-3">
      <dt className="text-xs tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}

