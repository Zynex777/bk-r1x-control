import { useEffect, useMemo, useRef, useState } from 'react';
import { MACRO_MAX_BYTES, MACRO_MAX_COUNT, macroBytes, type MacroEvent } from '../driver/protocol';
import { KEY_CODE_TO_HID, MOUSE_BUTTON_LABELS, MOUSE_EVENT_BUTTON_TO_CODE, hidKeyLabel } from '../driver/keycodes';
import { beginKeyCapture } from '../hooks/useHotkeys';
import { newId, type StoredMacro } from '../state/types';
import { MouseDiagram, type MouseZone } from './MouseDiagram';
import { Button, Chip, Panel, Segmented, inputClass } from './ui';
import { VisualKeyboard } from './VisualKeyboard';

const ZONE_TO_MOUSE_CODE: Partial<Record<MouseZone, number>> = { left: 1, right: 2, middle: 4, back: 8, forward: 16 };
const MOUSE_ZONES: MouseZone[] = ['left', 'right', 'middle', 'back', 'forward'];

type InsertMode = 'tap' | 'press' | 'release';
type Source = 'keyboard' | 'mouse' | 'record';

interface MacroEditorProps {
  macros: StoredMacro[];
  /** Onde cada macro está em uso (nomes de botões/ciclos), por id. */
  usage: Record<string, string[]>;
  onChange: (macros: StoredMacro[]) => void;
  onDelete: (id: string) => void;
}

export function MacroEditor({ macros, usage, onChange, onDelete }: MacroEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(macros[0]?.id ?? null);
  const [row, setRow] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const macro = macros.find((m) => m.id === selectedId) ?? macros[0];
  const used = macroBytes(macros);

  useEffect(() => setRow(null), [macro?.id]);

  const setEvents = (events: MacroEvent[]) =>
    macro && onChange(macros.map((m) => (m.id === macro.id ? { ...m, events } : m)));

  const addMacro = () => {
    const created: StoredMacro = { id: newId(), name: `Macro ${macros.length + 1}`, events: [] };
    onChange([...macros, created]);
    setSelectedId(created.id);
  };

  const duplicate = () => {
    if (!macro) return;
    const copy: StoredMacro = { ...macro, id: newId(), name: `${macro.name} (cópia)`, events: macro.events.map((e) => ({ ...e })) };
    onChange([...macros, copy]);
    setSelectedId(copy.id);
  };

  const remove = () => {
    if (!macro) return;
    const where = usage[macro.id];
    const extra = where?.length ? `\n\nEla está em uso em: ${where.join(', ')}. Esses botões voltarão ao padrão.` : '';
    if (!confirm(`Excluir a macro "${macro.name}"?${extra}`)) return;
    const idx = macros.indexOf(macro);
    setSelectedId(macros[idx + 1]?.id ?? macros[idx - 1]?.id ?? null);
    onDelete(macro.id);
  };

  /** Insere depois da linha selecionada (ou no fim) e seleciona o último inserido. */
  const insert = (newEvents: MacroEvent[]) => {
    if (!macro) return;
    const at = row === null ? macro.events.length : row + 1;
    const events = [...macro.events];
    events.splice(at, 0, ...newEvents);
    setEvents(events);
    setRow(at + newEvents.length - 1);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[240px_1fr]">
      <Panel title="Suas macros" subtitle={<span className={used > MACRO_MAX_BYTES ? 'text-danger' : ''}>Memória do mouse: {used} / {MACRO_MAX_BYTES} bytes</span>}>
        <div className="space-y-2">
          {macros.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={recording}
              onClick={() => setSelectedId(m.id)}
              className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
                m.id === macro?.id ? 'border-accent bg-accent/10' : 'border-line bg-void/60 hover:border-line-strong'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-ink">{m.name || 'Sem nome'}</span>
                <span className="shrink-0 text-xs text-muted">{m.events.length} ev.</span>
              </div>
              {usage[m.id]?.length ? (
                <div className="mt-1 truncate text-[11px] text-accent-bright/80">◆ {usage[m.id]!.join(', ')}</div>
              ) : (
                <div className="mt-1 text-[11px] text-muted/70">Não atribuída</div>
              )}
            </button>
          ))}
          <Button variant="primary" disabled={recording || macros.length >= MACRO_MAX_COUNT} onClick={addMacro}>
            + Nova macro
          </Button>
        </div>
      </Panel>

      {macro ? (
        <div className="min-w-0 space-y-5">
          <div className="gothic-panel flex flex-wrap items-center gap-2 rounded-lg p-4">
            <input
              aria-label="Nome da macro"
              value={macro.name}
              maxLength={32}
              disabled={recording}
              onChange={(e) => onChange(macros.map((m) => (m.id === macro.id ? { ...m, name: e.target.value } : m)))}
              className={`${inputClass} min-w-0 flex-1 text-base font-semibold`}
            />
            <Button disabled={recording || macros.length >= MACRO_MAX_COUNT} onClick={duplicate}>Duplicar</Button>
            <Button variant="danger" disabled={recording} onClick={remove}>Excluir</Button>
          </div>

          <EventList events={macro.events} row={row} disabled={recording} onSelectRow={setRow} onChange={setEvents} />

          <AddEvents
            insertLabel={row === null ? 'no fim da lista' : `depois do evento #${row + 1}`}
            recording={recording}
            onRecording={setRecording}
            onInsert={insert}
          />
        </div>
      ) : (
        <div className="gothic-panel flex flex-col items-center justify-center gap-4 rounded-lg p-12 text-center">
          <div className="gothic-title text-lg text-ink">Nenhuma macro ainda</div>
          <p className="max-w-sm text-sm text-muted">
            Uma macro é uma sequência de teclas e cliques que o mouse executa sozinho quando você aperta um botão.
          </p>
          <Button variant="primary" onClick={addMacro}>Criar a primeira macro</Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lista de eventos
// ---------------------------------------------------------------------------

function EventList({ events, row, disabled, onSelectRow, onChange }: {
  events: MacroEvent[];
  row: number | null;
  disabled: boolean;
  onSelectRow: (row: number | null) => void;
  onChange: (events: MacroEvent[]) => void;
}) {
  const update = (i: number, patch: Partial<MacroEvent>) => onChange(events.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= events.length) return;
    const next = [...events];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
    onSelectRow(j);
  };
  const remove = (i: number) => {
    onChange(events.filter((_, j) => j !== i));
    onSelectRow(events.length <= 1 ? null : Math.min(i, events.length - 2));
  };
  const duplicate = (i: number) => {
    const next = [...events];
    next.splice(i + 1, 0, { ...events[i]! });
    onChange(next);
    onSelectRow(i + 1);
  };

  const totalMs = events.reduce((n, e) => n + e.delayMs, 0);
  const stuck = useMemo(() => {
    const down = new Map<string, string>();
    for (const e of events) {
      const k = `${e.kind}:${e.code}`;
      if (e.pressed) down.set(k, e.label);
      else down.delete(k);
    }
    return [...down.values()];
  }, [events]);

  return (
    <Panel
      title="Lista de eventos"
      subtitle="Executados de cima para baixo. Clique numa linha para selecioná-la: novos eventos entram logo depois dela."
      actions={
        events.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-muted">
            <span>{events.length} eventos · {(totalMs / 1000).toFixed(2)} s</span>
            <Button size="sm" variant="subtle" disabled={disabled} onClick={() => confirm('Apagar todos os eventos desta macro?') && (onChange([]), onSelectRow(null))}>
              Limpar
            </Button>
          </div>
        )
      }
    >
      {events.length === 0 ? (
        <div className="rounded-md border border-dashed border-line-strong p-8 text-center text-sm text-muted">
          A lista está vazia. Use o teclado, o mouse ou a gravação logo abaixo para adicionar eventos.
        </div>
      ) : (
        <>
          <ol className="max-h-[22rem] space-y-1 overflow-y-auto pr-1">
            {events.map((ev, i) => {
              const selected = row === i;
              return (
                <li
                  key={i}
                  onClick={() => onSelectRow(selected ? null : i)}
                  className={`group flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2 transition ${
                    selected ? 'border-accent bg-accent/10' : 'border-transparent bg-void/50 hover:border-line-strong'
                  }`}
                >
                  <span className="w-6 text-right text-xs text-muted tabular-nums">{i + 1}</span>
                  <span className="text-muted" title={ev.kind === 'mouse' ? 'Mouse' : 'Teclado'}>
                    {ev.kind === 'mouse' ? <MouseIcon /> : <KeyIcon />}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    title="Alternar entre apertar e soltar"
                    onClick={(e) => {
                      e.stopPropagation();
                      update(i, { pressed: !ev.pressed });
                    }}
                    className={`w-20 rounded px-2 py-0.5 text-xs font-semibold ${
                      ev.pressed ? 'bg-accent/20 text-accent-bright' : 'bg-line text-muted'
                    }`}
                  >
                    {ev.pressed ? '↓ Apertar' : '↑ Soltar'}
                  </button>
                  <span className="min-w-24 flex-1 font-mono text-sm text-ink">{ev.label}</span>
                  <label className="flex items-center gap-1.5 text-xs text-muted" onClick={(e) => e.stopPropagation()}>
                    espera
                    <input
                      type="number"
                      min={0}
                      max={65535}
                      value={ev.delayMs}
                      disabled={disabled}
                      onChange={(e) => update(i, { delayMs: Math.max(0, Math.min(65535, Number(e.target.value) || 0)) })}
                      className="w-20 rounded border border-line bg-void px-2 py-1 text-right text-ink tabular-nums outline-none focus:border-accent"
                    />
                    ms
                  </label>
                  <div className={`flex gap-0.5 ${selected ? '' : 'opacity-0 group-hover:opacity-100'}`} onClick={(e) => e.stopPropagation()}>
                    <IconButton label="Subir" disabled={disabled || i === 0} onClick={() => move(i, -1)}>↑</IconButton>
                    <IconButton label="Descer" disabled={disabled || i === events.length - 1} onClick={() => move(i, 1)}>↓</IconButton>
                    <IconButton label="Duplicar" disabled={disabled} onClick={() => duplicate(i)}>⧉</IconButton>
                    <IconButton label="Remover" danger disabled={disabled} onClick={() => remove(i)}>✕</IconButton>
                  </div>
                </li>
              );
            })}
          </ol>
          {stuck.length > 0 && (
            <p className="mt-3 rounded-md border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">
              Atenção: {stuck.join(', ')} {stuck.length > 1 ? 'ficam' : 'fica'} pressionad{stuck.length > 1 ? 'os' : 'o'} no fim da macro. Adicione o evento “Soltar” correspondente.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

function IconButton({ children, label, onClick, disabled, danger }: {
  children: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`h-7 w-7 rounded text-sm text-muted transition hover:bg-panel-2 disabled:opacity-25 ${danger ? 'hover:text-danger' : 'hover:text-ink'}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Adicionar eventos
// ---------------------------------------------------------------------------

function AddEvents({ insertLabel, recording, onRecording, onInsert }: {
  insertLabel: string;
  recording: boolean;
  onRecording: (recording: boolean) => void;
  onInsert: (events: MacroEvent[]) => void;
}) {
  const [source, setSource] = useState<Source>('keyboard');
  const [mode, setMode] = useState<InsertMode>('tap');
  const [holdMs, setHoldMs] = useState(30);
  const [gapMs, setGapMs] = useState(50);

  const build = (kind: MacroEvent['kind'], code: number, label: string): MacroEvent[] => {
    if (mode === 'press') return [{ kind, code, label, pressed: true, delayMs: gapMs }];
    if (mode === 'release') return [{ kind, code, label, pressed: false, delayMs: gapMs }];
    return [
      { kind, code, label, pressed: true, delayMs: holdMs },
      { kind, code, label, pressed: false, delayMs: gapMs },
    ];
  };

  return (
    <Panel
      title="Adicionar eventos"
      subtitle={<>Novos eventos entram <span className="text-accent-bright">{insertLabel}</span>.</>}
      actions={
        <Segmented
          disabled={recording}
          value={source}
          onChange={setSource}
          options={[
            { label: 'Teclado', value: 'keyboard' },
            { label: 'Mouse', value: 'mouse' },
            { label: '● Gravar', value: 'record' },
          ]}
        />
      }
    >
      {source !== 'record' && (
        <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <div className="mb-1.5 text-xs text-muted">Cada clique adiciona</div>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { label: 'Toque (aperta e solta)', value: 'tap' },
                { label: 'Só apertar', value: 'press' },
                { label: 'Só soltar', value: 'release' },
              ]}
            />
          </div>
          {mode === 'tap' && <NumberField label="Segurar por" value={holdMs} onChange={setHoldMs} />}
          <NumberField label="Esperar depois" value={gapMs} onChange={setGapMs} />
        </div>
      )}

      {source === 'keyboard' && (
        <>
          <VisualKeyboard
            onPress={(code) => {
              const usage = KEY_CODE_TO_HID[code];
              if (usage !== undefined) onInsert(build('key', usage, hidKeyLabel(usage)));
            }}
          />
          <p className="mt-2 text-xs text-muted">
            Para um atalho como Ctrl + C: escolha “Só apertar”, clique Ctrl, troque para “Toque”, clique C, e depois adicione Ctrl com “Só soltar”.
          </p>
        </>
      )}

      {source === 'mouse' && (
        <div className="flex flex-wrap items-center gap-8">
          <MouseDiagram
            className="w-40"
            zones={MOUSE_ZONES}
            onSelect={(zone) => {
              const code = ZONE_TO_MOUSE_CODE[zone];
              if (code) onInsert(build('mouse', code, MOUSE_BUTTON_LABELS[code]!));
            }}
          />
          <div className="flex flex-col gap-2">
            {MOUSE_ZONES.map((zone) => {
              const code = ZONE_TO_MOUSE_CODE[zone]!;
              return (
                <Chip key={zone} onClick={() => onInsert(build('mouse', code, MOUSE_BUTTON_LABELS[code]!))}>
                  + {MOUSE_BUTTON_LABELS[code]}
                </Chip>
              );
            })}
          </div>
        </div>
      )}

      {source === 'record' && <Recorder recording={recording} onRecording={onRecording} onEvents={onInsert} />}
    </Panel>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-muted">{label}</span>
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <input
          type="number"
          min={0}
          max={65535}
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(65535, Number(e.target.value) || 0)))}
          className="w-20 rounded border border-line bg-void px-2 py-1.5 text-right text-sm text-ink tabular-nums outline-none focus:border-accent"
        />
        ms
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

function Recorder({ recording, onRecording, onEvents }: {
  recording: boolean;
  onRecording: (recording: boolean) => void;
  onEvents: (events: MacroEvent[]) => void;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const [realDelays, setRealDelays] = useState(true);
  const [fixedDelay, setFixedDelay] = useState(50);
  const [live, setLive] = useState<MacroEvent[]>([]);
  const onEventsRef = useRef(onEvents);
  onEventsRef.current = onEvents;
  const settings = useRef({ realDelays, fixedDelay });
  settings.current = { realDelays, fixedDelay };

  // Garante que a gravação para se o componente sair da tela.
  useEffect(() => () => onRecording(false), [onRecording]);

  useEffect(() => {
    if (!recording) return;
    const endCapture = beginKeyCapture();
    const buffer: { event: MacroEvent; time: number }[] = [];
    const pressedKeys = new Set<string>();

    const push = (event: Omit<MacroEvent, 'delayMs'>) => {
      const { realDelays, fixedDelay } = settings.current;
      const now = performance.now();
      const last = buffer.at(-1);
      if (last) last.event.delayMs = realDelays ? Math.min(0xffff, Math.round(now - last.time)) : fixedDelay;
      buffer.push({ event: { ...event, delayMs: fixedDelay }, time: now });
      setLive(buffer.map((b) => ({ ...b.event })));
    };

    const onKey = (e: KeyboardEvent) => {
      const code = KEY_CODE_TO_HID[e.code];
      if (code === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      const pressed = e.type === 'keydown';
      if (pressed && pressedKeys.has(e.code)) return; // repetição automática
      if (pressed) pressedKeys.add(e.code);
      else pressedKeys.delete(e.code);
      push({ kind: 'key', code, pressed, label: hidKeyLabel(code) });
    };

    const inPad = (e: Event) => {
      const target = e.target as Element;
      return padRef.current?.contains(target) && !target.closest('[data-no-record]');
    };
    const onMouse = (e: MouseEvent) => {
      // Voltar/avançar navegariam a página: bloqueia em qualquer lugar durante a gravação.
      if (e.button === 3 || e.button === 4) e.preventDefault();
      if (!inPad(e)) return;
      e.preventDefault();
      const code = MOUSE_EVENT_BUTTON_TO_CODE[e.button as 0 | 1 | 2 | 3 | 4];
      if (code === undefined) return;
      push({ kind: 'mouse', code, pressed: e.type === 'mousedown', label: MOUSE_BUTTON_LABELS[code] ?? `Mouse ${code}` });
    };
    const block = (e: Event) => inPad(e) && e.preventDefault();
    const blockNav = (e: MouseEvent) => (e.button === 3 || e.button === 4) && e.preventDefault();

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('mousedown', onMouse, true);
    window.addEventListener('mouseup', onMouse, true);
    window.addEventListener('auxclick', blockNav, true);
    window.addEventListener('contextmenu', block, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('mousedown', onMouse, true);
      window.removeEventListener('mouseup', onMouse, true);
      window.removeEventListener('auxclick', blockNav, true);
      window.removeEventListener('contextmenu', block, true);
      endCapture();
      if (buffer.length > 0) onEventsRef.current(buffer.map((b) => b.event));
      setLive([]);
    };
  }, [recording]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented
          disabled={recording}
          value={realDelays ? 'real' : 'fixed'}
          onChange={(v) => setRealDelays(v === 'real')}
          options={[
            { label: 'Gravar o tempo real entre eventos', value: 'real' },
            { label: 'Usar espera fixa', value: 'fixed' },
          ]}
        />
        {!realDelays && !recording && <NumberField label="Espera fixa" value={fixedDelay} onChange={setFixedDelay} />}
      </div>

      <div
        ref={padRef}
        className={`relative flex min-h-48 flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-6 text-center transition select-none ${
          recording ? 'border-blood bg-blood/10' : 'border-line-strong bg-void/50'
        }`}
      >
        {recording ? (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="h-3 w-3 animate-pulse rounded-full bg-blood shadow-[0_0_12px_var(--color-blood)]" />
              Gravando
            </div>
            <p className="max-w-md text-sm text-muted">
              Digite no teclado normalmente. Para gravar cliques, clique <b className="text-ink">dentro desta área</b> com qualquer botão
              do mouse, incluindo os laterais.
            </p>
            <div className="flex max-w-full flex-wrap justify-center gap-1">
              {live.slice(-12).map((e, i) => (
                <span key={i} className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${e.pressed ? 'bg-accent/25 text-accent-bright' : 'bg-line text-muted'}`}>
                  {e.pressed ? '↓' : '↑'} {e.label}
                </span>
              ))}
            </div>
            <div data-no-record>
              <Button variant="danger" onClick={() => onRecording(false)}>■ Parar gravação ({live.length})</Button>
            </div>
          </>
        ) : (
          <>
            <p className="max-w-md text-sm text-muted">
              Grave teclas e cliques do jeito que você faria no jogo. Depois dá para ajustar cada evento na lista acima.
            </p>
            <Button variant="primary" onClick={() => onRecording(true)}>● Começar a gravar</Button>
          </>
        )}
      </div>
    </div>
  );
}

function MouseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path fillRule="evenodd" d="M12 2a6 6 0 0 0-6 6v8a6 6 0 0 0 12 0V8a6 6 0 0 0-6-6Zm-.75 3h1.5v5h-1.5z" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path fillRule="evenodd" d="M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm2 3v2h2V9Zm4 0v2h2V9Zm4 0v2h2V9Zm4 0v2h2V9ZM7 13v2h10v-2Z" />
    </svg>
  );
}
