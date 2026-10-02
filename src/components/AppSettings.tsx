import { useEffect, useRef, useState } from 'react';
import { desktop } from '../desktop/bridge';
import { THEMES, type ThemeId, type ThemeInfo } from '../state/theme';
import { Button, Panel, Toggle } from './ui';

interface AppSettingsProps {
  theme: ThemeId;
  onTheme: (theme: ThemeId) => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export function AppSettings({ theme, onTheme, onExport, onImport }: AppSettingsProps) {
  const backupRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      <Panel title="Tema" subtitle="Muda só a aparência do app. Fica salvo neste computador.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {THEMES.map((t) => (
            <ThemeCard key={t.id} theme={t} active={t.id === theme} onSelect={() => onTheme(t.id)} />
          ))}
        </div>
      </Panel>

      {desktop ? (
        <DesktopOptions />
      ) : (
        <Panel
          title="App para Windows"
          subtitle="O app instalado faz tudo o que esta página faz e mais: atalhos de macro dentro dos jogos, perfis que trocam sozinhos ao abrir um jogo e ícone na bandeja."
        >
          <a
            href="https://github.com/Zynex777/bk-r1x-control/releases/latest"
            target="_blank"
            rel="noreferrer"
            className="btn-primary inline-flex items-center gap-2 rounded-md border border-accent/60 bg-gradient-to-b from-accent to-accent-deep px-4 py-2 text-sm font-semibold text-on-accent"
          >
            Baixar para Windows
          </a>
        </Panel>
      )}

      <Panel
        title="Backup"
        subtitle="Macros, ciclos de atalho, perfis por programa, nome, ícone e tema ficam salvos só neste computador. Exporte para guardar ou levar para outro lugar (por exemplo, do navegador para o app instalado)."
      >
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={onExport}>Exportar configurações</Button>
          <Button onClick={() => backupRef.current?.click()}>Importar configurações…</Button>
          <input
            ref={backupRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onImport(file);
            }}
          />
        </div>
      </Panel>
    </div>
  );
}

/** Miniatura do tema desenhada com as cores dele, independente do tema atual. */
function ThemeCard({ theme, active, onSelect }: { theme: ThemeInfo; active: boolean; onSelect: () => void }) {
  const [bg, panel, accent, ink] = theme.swatch;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`overflow-hidden rounded-lg border text-left transition ${
        active ? 'border-accent shadow-[0_0_0_2px_var(--color-accent)]' : 'border-line hover:border-line-strong'
      }`}
    >
      <div className="relative h-24 p-3" style={{ background: bg }}>
        <div className="flex h-full gap-2">
          <div className="flex w-8 flex-col gap-1.5 rounded p-1.5" style={{ background: panel }}>
            <span className="h-1.5 rounded-full" style={{ background: accent }} />
            <span className="h-1.5 rounded-full opacity-40" style={{ background: ink }} />
            <span className="h-1.5 rounded-full opacity-40" style={{ background: ink }} />
          </div>
          <div className="flex flex-1 flex-col gap-1.5 rounded p-2" style={{ background: panel }}>
            <span className="h-2 w-1/2 rounded-full" style={{ background: ink, opacity: 0.85 }} />
            <span className="h-1.5 w-3/4 rounded-full opacity-30" style={{ background: ink }} />
            <span className="mt-auto h-4 w-14 rounded" style={{ background: accent }} />
          </div>
        </div>
        {active && (
          <span className="absolute top-2 right-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-on-accent uppercase">Ativo</span>
        )}
      </div>
      <div className="bg-panel px-3 py-2.5">
        <div className="text-sm font-semibold text-ink">{theme.name}</div>
        <div className="text-xs text-muted">{theme.description}</div>
      </div>
    </button>
  );
}

function DesktopOptions() {
  const [autoStart, setAutoStart] = useState<boolean | null>(null);
  useEffect(() => {
    void desktop?.getAutoStart().then(setAutoStart);
  }, []);

  return (
    <Panel title="Programa">
      <Toggle
        label="Iniciar com o Windows"
        description="Abre escondido na bandeja ao ligar o computador, para os atalhos e os perfis por programa já estarem funcionando."
        checked={autoStart ?? false}
        disabled={autoStart === null}
        onChange={(on) => void desktop?.setAutoStart(on).then(setAutoStart)}
      />
    </Panel>
  );
}
