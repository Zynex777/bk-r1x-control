import { useState } from 'react';
import { BUTTON_NAMES, MacroLoopMode } from '../driver/protocol';
import { desktop } from '../desktop/bridge';
import { normalizeExe, type AppProfile, type ProfileOverride } from '../state/appProfiles';
import type { StoredMacro } from '../state/types';
import { Button, Panel, Toggle, inputClass, selectClass } from './ui';

interface AppProfilesProps {
  profiles: AppProfile[];
  macros: StoredMacro[];
  /** Executáveis vigiados que estão abertos agora. */
  running: ReadonlySet<string>;
  activeId: string | null;
  /** Botões controlados por ciclos de atalho: índice → nome do ciclo. */
  cycleOwners: Record<number, string>;
  onChange: (profiles: AppProfile[]) => void;
  onAdd: () => void;
}

const LOOP_OPTIONS = [
  { value: MacroLoopMode.FixedCount, label: 'Executar' },
  { value: MacroLoopMode.UntilReleased, label: 'Repetir enquanto apertado' },
  { value: MacroLoopMode.UntilAnyKey, label: 'Repetir até outro botão' },
];

export function AppProfiles({ profiles, macros, running, activeId, cycleOwners, onChange, onAdd }: AppProfilesProps) {
  const update = (id: string, patch: Partial<AppProfile>) => onChange(profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= profiles.length) return;
    const next = [...profiles];
    [next[index], next[j]] = [next[j]!, next[index]!];
    onChange(next);
  };
  const active = profiles.find((p) => p.id === activeId);

  return (
    <div className="space-y-5">
      {desktop ? (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-ink">
          {active ? (
            <>
              Agora: perfil <b className="text-accent-bright">“{active.name}”</b> ativo. Os botões voltam ao padrão quando o programa fechar.
            </>
          ) : (
            <>Nenhum programa com perfil está aberto: os botões estão no padrão (seção Botões).</>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn">
          A troca automática só funciona no <b>app instalado</b>: o navegador não consegue ver quais programas estão abertos. Você pode montar
          os perfis aqui e exportar em Configurações → Backup.
        </div>
      )}

      {profiles.map((profile, index) => (
        <ProfileCard
          key={profile.id}
          profile={profile}
          macros={macros}
          running={running}
          isActive={profile.id === activeId}
          cycleOwners={cycleOwners}
          first={index === 0}
          last={index === profiles.length - 1}
          onUpdate={(patch) => update(profile.id, patch)}
          onMove={(dir) => move(index, dir)}
          onDelete={() => confirm(`Excluir o perfil "${profile.name}"?`) && onChange(profiles.filter((p) => p.id !== profile.id))}
        />
      ))}

      <div className="gothic-panel flex flex-col items-center gap-3 p-8 text-center">
        <p className="max-w-xl text-sm text-muted">
          Exemplo: um perfil para <b className="text-ink">valorant.exe</b> coloca a macro 1 no botão Voltar e a macro 2 no Avançar. Ao abrir o
          jogo eles trocam sozinhos; ao fechar, voltam ao que estava. Se dois programas com perfil estiverem abertos, vale o mais acima na lista.
        </p>
        <Button variant="primary" onClick={onAdd}>+ Novo perfil</Button>
      </div>
    </div>
  );
}

function ProfileCard({ profile, macros, running, isActive, cycleOwners, first, last, onUpdate, onMove, onDelete }: {
  profile: AppProfile;
  macros: StoredMacro[];
  running: ReadonlySet<string>;
  isActive: boolean;
  cycleOwners: Record<number, string>;
  first: boolean;
  last: boolean;
  onUpdate: (patch: Partial<AppProfile>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [openList, setOpenList] = useState<string[] | null>(null);

  const addExe = (name: string) => {
    const exe = normalizeExe(name);
    if (exe && !profile.exes.includes(exe)) onUpdate({ exes: [...profile.exes, exe] });
    setTyped('');
  };
  const setOverride = (button: number, o: ProfileOverride | null) => {
    const overrides = { ...profile.overrides };
    if (o) overrides[button] = o;
    else delete overrides[button];
    onUpdate({ overrides });
  };

  return (
    <Panel
      title={profile.name || 'Perfil sem nome'}
      subtitle={
        isActive ? (
          <span className="font-semibold text-ok">● Ativo agora</span>
        ) : profile.enabled ? (
          'Esperando um dos programas abrir.'
        ) : (
          'Desligado.'
        )
      }
      actions={
        <div className="flex items-center gap-1">
          <Button size="sm" variant="subtle" disabled={first} onClick={() => onMove(-1)} title="Mais prioridade">↑</Button>
          <Button size="sm" variant="subtle" disabled={last} onClick={() => onMove(1)} title="Menos prioridade">↓</Button>
          <Button size="sm" variant="danger" onClick={onDelete}>Excluir</Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <input aria-label="Nome do perfil" className={inputClass} value={profile.name} maxLength={32} onChange={(e) => onUpdate({ name: e.target.value })} />
          <Toggle label="Perfil ligado" checked={profile.enabled} onChange={(enabled) => onUpdate({ enabled })} />

          <div className="space-y-2">
            <span className="text-xs text-muted">Programas ou jogos que ativam este perfil</span>
            <div className="flex flex-wrap gap-2">
              {profile.exes.length === 0 && <span className="text-sm text-muted">Nenhum ainda.</span>}
              {profile.exes.map((exe) => (
                <span key={exe} className="inline-flex items-center gap-2 rounded-md border border-line bg-void/60 px-2.5 py-1 font-mono text-sm text-ink">
                  <span
                    className={`h-2 w-2 rounded-full ${running.has(exe) ? 'bg-ok shadow-[0_0_8px_var(--color-ok)]' : 'bg-line-strong'}`}
                    title={running.has(exe) ? 'Aberto agora' : 'Fechado'}
                  />
                  {exe}
                  <button type="button" className="text-muted hover:text-danger" aria-label={`Remover ${exe}`} onClick={() => onUpdate({ exes: profile.exes.filter((e) => e !== exe) })}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addExe(typed);
              }}
            >
              <input className={inputClass} placeholder="ex.: valorant.exe" value={typed} onChange={(e) => setTyped(e.target.value)} />
              <Button type="submit" disabled={!typed.trim()}>Adicionar</Button>
            </form>
            {desktop && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void desktop?.pickExecutable().then((exe) => exe && addExe(exe))}>Procurar .exe…</Button>
                <Button size="sm" onClick={() => void desktop?.listProcesses().then(setOpenList)}>Escolher entre os abertos…</Button>
              </div>
            )}
            {openList && (
              <select
                className={selectClass}
                value=""
                onChange={(e) => {
                  if (e.target.value) addExe(e.target.value);
                  setOpenList(null);
                }}
              >
                <option value="">Programas abertos agora ({openList.length})…</option>
                {openList.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs text-muted">Macros nos botões enquanto o programa estiver aberto</span>
          {macros.length === 0 && <p className="text-sm text-muted">Crie macros na seção Macros primeiro.</p>}
          <ul className="space-y-1.5">
            {BUTTON_NAMES.map((name, button) => {
              if (button === 0) return null; // botão esquerdo é travado
              const o = profile.overrides[button];
              return (
                <li key={button} className={`rounded-md border px-3 py-2 ${o ? 'border-accent/50 bg-accent/5' : 'border-line bg-void/40'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-32 shrink-0 text-sm text-ink">{name}</span>
                    <select
                      aria-label={`Macro para ${name}`}
                      className={`${selectClass} min-w-0 flex-1 py-1.5`}
                      value={o?.macroId ?? ''}
                      onChange={(e) =>
                        setOverride(button, e.target.value ? { macroId: e.target.value, mode: o?.mode ?? MacroLoopMode.FixedCount, repeat: o?.repeat ?? 1 } : null)
                      }
                    >
                      <option value="">Padrão (não muda)</option>
                      {macros.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                      {o && !macros.some((m) => m.id === o.macroId) && <option value={o.macroId}>(macro excluída)</option>}
                    </select>
                  </div>
                  {o && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 sm:pl-34">
                      <select
                        aria-label="Como executar"
                        className="rounded-md border border-line bg-void/80 px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                        value={o.mode}
                        onChange={(e) => setOverride(button, { ...o, mode: Number(e.target.value) as MacroLoopMode })}
                      >
                        {LOOP_OPTIONS.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                      {o.mode === MacroLoopMode.FixedCount && (
                        <label className="flex items-center gap-1.5 text-xs text-muted">
                          <input
                            type="number"
                            min={1}
                            max={255}
                            value={o.repeat}
                            onChange={(e) => setOverride(button, { ...o, repeat: Math.max(1, Math.min(255, Number(e.target.value) || 1)) })}
                            className="w-14 rounded border border-line bg-void px-2 py-1 text-right text-ink outline-none focus:border-accent"
                          />
                          {o.repeat === 1 ? 'vez' : 'vezes'}
                        </label>
                      )}
                      {cycleOwners[button] && (
                        <span className="text-xs text-warn">O ciclo “{cycleOwners[button]}” também usa este botão; o perfil tem prioridade.</span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
