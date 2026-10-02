import { useEffect, useState } from 'react';
import { DPI_MAX, DPI_MIN, DPI_STAGES, DPI_STEP, type MouseConfig } from '../driver/protocol';
import { Field, Panel, Segmented } from './ui';

interface DPIConfigProps {
  config: MouseConfig;
  colors: string[];
  disabled: boolean;
  onStageValue: (index: number, value: number) => void;
  onActiveStage: (index: number) => void;
  onStageCount: (count: number) => void;
  onColor: (index: number, color: string) => void;
}

export function DPIConfig({ config, colors, disabled, onStageValue, onActiveStage, onStageCount, onColor }: DPIConfigProps) {
  const [editing, setEditing] = useState(config.dpiIndex);

  // Acompanha trocas feitas pelo botão físico de DPI.
  useEffect(() => setEditing(config.dpiIndex), [config.dpiIndex]);

  const value = config.dpi[editing] ?? DPI_MIN;
  const fill = ((value - DPI_MIN) / (DPI_MAX - DPI_MIN)) * 100;
  const color = colors[editing] ?? '#a259ff';

  return (
    <Panel
      title="Sensibilidade (DPI)"
      subtitle="Clique num estágio para ativá-lo e editá-lo. O botão DPI do mouse alterna entre os estágios ativos."
    >
      <div className="space-y-8">
        <Field label="Estágios no ciclo">
          <Segmented
            disabled={disabled}
            value={config.dpiCount}
            onChange={onStageCount}
            options={Array.from({ length: DPI_STAGES }, (_, i) => ({ label: String(i + 1), value: i + 1 }))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {config.dpi.map((dpi, i) => {
            const enabled = i < config.dpiCount;
            const active = i === config.dpiIndex;
            const stageColor = colors[i] ?? '#ffffff';
            return (
              <button
                key={i}
                type="button"
                disabled={disabled || !enabled}
                onClick={() => {
                  setEditing(i);
                  if (!active) onActiveStage(i);
                }}
                className={`group relative overflow-hidden rounded-lg border p-4 text-left transition disabled:cursor-not-allowed ${
                  active ? 'border-transparent bg-panel-2' : 'border-line bg-void/60 hover:border-muted'
                } ${enabled ? '' : 'opacity-35'}`}
                style={active ? { boxShadow: `0 0 0 2px ${stageColor}, 0 0 24px -6px ${stageColor}` } : undefined}
              >
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Estágio {i + 1}</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: stageColor, boxShadow: `0 0 8px ${stageColor}` }} />
                </div>
                <div className="gothic-title mt-2 text-2xl font-bold text-ink tabular-nums">{dpi}</div>
                {active && <div className="mt-1 text-[10px] font-semibold tracking-widest uppercase" style={{ color: stageColor }}>Ativo</div>}
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-line bg-void/60 p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-muted">
              Editando <span className="font-semibold text-ink">estágio {editing + 1}</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted" title="A cor é só visual: o firmware do BK-R1X não recebe cor por estágio.">
                Cor
                <input
                  type="color"
                  value={color}
                  onChange={(e) => onColor(editing, e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent"
                />
              </label>
              <DpiInput value={value} disabled={disabled} onCommit={(v) => onStageValue(editing, v)} />
            </div>
          </div>
          <input
            type="range"
            className="slider w-full"
            min={DPI_MIN}
            max={DPI_MAX}
            step={DPI_STEP}
            value={value}
            disabled={disabled}
            style={{ ['--fill' as string]: `${fill}%` }}
            onChange={(e) => onStageValue(editing, Number(e.target.value))}
          />
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{DPI_MIN}</span>
            <span>{DPI_MAX}</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function DpiInput({ value, disabled, onCommit }: { value: number; disabled: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const parsed = Math.round(Number(draft) / DPI_STEP) * DPI_STEP;
    const next = Number.isFinite(parsed) ? Math.min(DPI_MAX, Math.max(DPI_MIN, parsed)) : value;
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <input
      type="number"
      min={DPI_MIN}
      max={DPI_MAX}
      step={DPI_STEP}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      className="w-28 rounded-md border border-line bg-void px-3 py-2 text-right text-sm font-semibold text-ink tabular-nums outline-none focus:border-accent"
    />
  );
}
