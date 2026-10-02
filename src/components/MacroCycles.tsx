import { useEffect, useRef, useState } from 'react';
import { BUTTON_NAMES, MacroLoopMode } from '../driver/protocol';
import { beginKeyCapture } from '../hooks/useHotkeys';
import { MODIFIER_CODES, hotkeyFromEvent, hotkeyLabel, sameHotkey, type Hotkey, type MacroCycle, type StoredMacro } from '../state/types';
import { desktop } from '../desktop/bridge';
import { RepeatOptions } from './ButtonMapping';
import { Button, Kbd, Panel, Toggle, selectClass } from './ui';

interface MacroCyclesProps {
  cycles: MacroCycle[];
  macros: StoredMacro[];
  connected: boolean;
  onChange: (cycles: MacroCycle[]) => void;
  onAdd: () => void;
  onStep: (cycleId: string, direction: 1 | -1) => void;
  /** Ids `${cicloId}:next|prev` que o sistema não aceitou como atalho global. */
  failedHotkeys: ReadonlySet<string>;
}

export function MacroCycles({ cycles, macros, connected, onChange, onAdd, onStep, failedHotkeys }: MacroCyclesProps) {
  const update = (id: string, patch: Partial<MacroCycle>) =>
    onChange(cycles.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const allHotkeys = cycles.flatMap((c) => [c.next, c.prev].filter((h): h is Hotkey => h !== null).map((h) => ({ h, id: c.id })));

  return (
    <div className="space-y-5">
      {desktop ? (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent-bright">
          Atalhos globais ativos: funcionam com qualquer programa ou jogo aberto, enquanto o app estiver aberto ou na bandeja do
          Windows (perto do relógio).
        </div>
      ) : (
        <div className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn">
          No navegador os atalhos só funcionam com <b>esta janela aberta e em foco</b>. No app instalado eles funcionam dentro de
          jogos também.
        </div>
      )}

      {cycles.map((cycle) => {
        const list = cycle.macroIds.map((id) => macros.find((m) => m.id === id)).filter((m): m is StoredMacro => m !== undefined);
        const active = list[cycle.current % Math.max(1, list.length)];
        const available = macros.filter((m) => !cycle.macroIds.includes(m.id));
        const conflict = (h: Hotkey | null) => h !== null && allHotkeys.some((o) => o.id !== cycle.id && sameHotkey(o.h, h));
        const reorder = (i: number, dir: -1 | 1) => {
          const ids = [...cycle.macroIds];
          const j = i + dir;
          if (j < 0 || j >= ids.length) return;
          [ids[i], ids[j]] = [ids[j]!, ids[i]!];
          update(cycle.id, { macroIds: ids });
        };

        return (
          <Panel
            key={cycle.id}
            title={cycle.name || 'Ciclo sem nome'}
            subtitle={
              active ? (
                <>
                  Agora no <span className="text-ink">{BUTTON_NAMES[cycle.button]}</span>: <span className="text-accent-bright">{active.name}</span>
                </>
              ) : (
                'Adicione macros ao ciclo para começar.'
              )
            }
            actions={
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={!connected || list.length === 0} onClick={() => onStep(cycle.id, -1)} title="Macro anterior">◀</Button>
                <Button size="sm" disabled={!connected || list.length === 0} onClick={() => onStep(cycle.id, 1)} title="Próxima macro">▶</Button>
              </div>
            }
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-5">
                <div className="flex gap-3">
                  <input
                    aria-label="Nome do ciclo"
                    value={cycle.name}
                    maxLength={32}
                    onChange={(e) => update(cycle.id, { name: e.target.value })}
                    className={`${selectClass} flex-1`}
                  />
                  <Button variant="danger" size="sm" onClick={() => confirm(`Excluir o ciclo "${cycle.name}"?`) && onChange(cycles.filter((c) => c.id !== cycle.id))}>
                    Excluir
                  </Button>
                </div>
                <Toggle label="Ciclo ativo" description="Desligado, os atalhos deste ciclo são ignorados." checked={cycle.enabled} onChange={(enabled) => update(cycle.id, { enabled })} />

                <label className="block space-y-2">
                  <span className="text-xs text-muted">Botão do mouse que recebe a macro</span>
                  <select className={selectClass} value={cycle.button} onChange={(e) => update(cycle.id, { button: Number(e.target.value) })}>
                    {BUTTON_NAMES.map((name, i) => i > 0 && <option key={i} value={i}>{name}</option>)}
                  </select>
                </label>

                <div className="space-y-2">
                  <span className="text-xs text-muted">Atalhos</span>
                  <HotkeyInput
                    label="Próxima macro"
                    value={cycle.next}
                    conflict={conflict(cycle.next)}
                    unavailable={cycle.enabled && cycle.next !== null && failedHotkeys.has(`${cycle.id}:next`)}
                    onChange={(next) => update(cycle.id, { next })}
                  />
                  <HotkeyInput
                    label="Macro anterior"
                    value={cycle.prev}
                    conflict={conflict(cycle.prev)}
                    unavailable={cycle.enabled && cycle.prev !== null && failedHotkeys.has(`${cycle.id}:prev`)}
                    onChange={(prev) => update(cycle.id, { prev })}
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-muted">Quando apertar o botão</span>
                  <RepeatOptions
                    mode={cycle.mode}
                    repeat={cycle.repeat}
                    onMode={(mode: MacroLoopMode) => update(cycle.id, { mode })}
                    onRepeat={(repeat) => update(cycle.id, { repeat })}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-xs text-muted">Ordem das macros no ciclo</span>
                {list.length === 0 && <p className="rounded-md border border-dashed border-line-strong p-4 text-sm text-muted">Nenhuma macro no ciclo.</p>}
                <ol className="space-y-1.5">
                  {list.map((m, i) => (
                    <li
                      key={m.id}
                      className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
                        m === active ? 'border-accent bg-accent/10' : 'border-line bg-void/60'
                      }`}
                    >
                      <span className="gothic-title w-5 text-xs text-accent-bright">{i + 1}</span>
                      <span className="flex-1 truncate text-sm text-ink">{m.name}</span>
                      {m === active && <span className="text-[10px] font-bold tracking-widest text-accent-bright uppercase">ativa</span>}
                      <button type="button" className="px-1 text-muted hover:text-ink disabled:opacity-25" disabled={i === 0} onClick={() => reorder(i, -1)} aria-label="Subir">↑</button>
                      <button type="button" className="px-1 text-muted hover:text-ink disabled:opacity-25" disabled={i === list.length - 1} onClick={() => reorder(i, 1)} aria-label="Descer">↓</button>
                      <button
                        type="button"
                        className="px-1 text-muted hover:text-danger"
                        aria-label="Remover do ciclo"
                        onClick={() => update(cycle.id, { macroIds: cycle.macroIds.filter((id) => id !== m.id), current: 0 })}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ol>
                {available.length > 0 ? (
                  <select
                    className={selectClass}
                    value=""
                    onChange={(e) => e.target.value && update(cycle.id, { macroIds: [...cycle.macroIds, e.target.value] })}
                  >
                    <option value="">+ Adicionar macro ao ciclo…</option>
                    {available.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                ) : (
                  macros.length === 0 && <p className="text-xs text-muted">Crie macros na seção Macros primeiro.</p>
                )}
              </div>
            </div>
          </Panel>
        );
      })}

      <div className="gothic-panel flex flex-col items-center gap-3 rounded-lg p-8 text-center">
        <p className="max-w-lg text-sm text-muted">
          Um ciclo troca a macro de um botão do mouse com um atalho de teclado. Exemplo: <Kbd>Ctrl</Kbd> + <Kbd>Win</Kbd> + <Kbd>.</Kbd>{' '}
          passa o botão lateral para a próxima macro da lista.
        </p>
        <Button variant="primary" onClick={onAdd}>+ Novo ciclo de macros</Button>
      </div>
    </div>
  );
}

function HotkeyInput({ label, value, conflict, unavailable, onChange }: {
  label: string;
  value: Hotkey | null;
  conflict: boolean;
  unavailable: boolean;
  onChange: (hotkey: Hotkey | null) => void;
}) {
  const [capturing, setCapturing] = useState(false);
  const [hint, setHint] = useState('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!capturing) return;
    const endCapture = beginKeyCapture();
    setHint('Aperte a combinação…');
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) return setCapturing(false);
      if (MODIFIER_CODES.has(e.code)) return;
      const hotkey = hotkeyFromEvent(e);
      if (!hotkey.ctrl && !hotkey.alt && !hotkey.meta) {
        setHint('Use pelo menos Ctrl, Alt ou Win junto da tecla.');
        return;
      }
      onChangeRef.current(hotkey);
      setCapturing(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      endCapture();
      setHint('');
    };
  }, [capturing]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 text-sm text-ink">{label}</span>
      <button
        type="button"
        onClick={() => setCapturing(!capturing)}
        className={`min-w-44 flex-1 rounded-md border px-3 py-2 text-left font-mono text-sm transition ${
          capturing ? 'border-accent bg-accent/10 text-accent-bright' : conflict ? 'border-danger text-danger' : 'border-line bg-void/60 text-ink hover:border-line-strong'
        }`}
      >
        {capturing ? hint : value ? hotkeyLabel(value) : <span className="text-muted">Clique para definir</span>}
      </button>
      {value && !capturing && (
        <button type="button" className="px-2 text-sm text-muted hover:text-danger" onClick={() => onChange(null)} aria-label={`Remover atalho ${label}`}>
          ✕
        </button>
      )}
      {conflict && <span className="w-full text-xs text-danger">Este atalho já é usado em outro ciclo.</span>}
      {!conflict && unavailable && (
        <span className="w-full text-xs text-danger">
          O Windows recusou este atalho (já usado pelo sistema ou por outro programa, ou tecla não suportada). Escolha outro.
        </span>
      )}
    </div>
  );
}
