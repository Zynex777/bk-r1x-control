import { useEffect, useMemo, useState } from 'react';
import {
  ActionType,
  BUTTON_NAMES,
  MacroLoopMode,
  macroAction,
  safeLoopMode,
  type ButtonAction,
} from '../driver/protocol';
import {
  KEY_CODE_TO_HID,
  MEDIA_ACTIONS,
  MOUSE_ACTIONS,
  describeAction,
  keyboardAction,
  sameAction,
} from '../driver/keycodes';
import { beginKeyCapture } from '../hooks/useHotkeys';
import type { StoredMacro } from '../state/types';
import { BUTTON_ZONES, MouseDiagram } from './MouseDiagram';
import { Button, Chip, Panel, Segmented, selectClass } from './ui';
import { VisualKeyboard } from './VisualKeyboard';

/** O botão esquerdo fica travado, como no app oficial, para não deixar o usuário sem clique. */
const LOCKED_BUTTON = 0;

/** Bits de modificador no code1 de uma ação de teclado. */
const MODIFIER_BITS: Record<string, number> = {
  ControlLeft: 0x01, ShiftLeft: 0x02, AltLeft: 0x04, MetaLeft: 0x08,
  ControlRight: 0x10, ShiftRight: 0x20, AltRight: 0x40, MetaRight: 0x80,
};

interface ButtonMappingProps {
  buttons: ButtonAction[];
  macros: StoredMacro[];
  /** Botões controlados por um ciclo de macros: índice → nome do ciclo. */
  cycleOwners: Record<number, string>;
  disabled: boolean;
  onChange: (index: number, action: ButtonAction) => void;
  onReset: () => void;
}

export function ButtonMapping({ buttons, macros, cycleOwners, disabled, onChange, onReset }: ButtonMappingProps) {
  const [selected, setSelected] = useState(1);
  const marked = useMemo(() => new Set(Object.keys(cycleOwners).map((i) => BUTTON_ZONES[Number(i)]!)), [cycleOwners]);

  return (
    <div className="space-y-5">
      <Panel
        title="Escolha um botão"
        subtitle="Clique no desenho ou na lista. Botões em vermelho são trocados automaticamente por um ciclo de macros."
        actions={<Button variant="danger" size="sm" disabled={disabled} onClick={onReset}>Restaurar todos</Button>}
      >
        <div className="grid items-center gap-6 md:grid-cols-[240px_1fr]">
          <MouseDiagram
            zones={BUTTON_ZONES}
            selected={BUTTON_ZONES[selected]}
            marked={marked}
            badges={Object.fromEntries(BUTTON_ZONES.map((z, i) => [z, String(i + 1)]))}
            onSelect={(zone) => setSelected(BUTTON_ZONES.indexOf(zone))}
          />
          <ul className="grid gap-2 sm:grid-cols-2">
            {BUTTON_NAMES.map((name, i) => {
              const action = buttons[i];
              return (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => setSelected(i)}
                    className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
                      selected === i ? 'border-accent bg-accent/10' : 'border-line bg-void/60 hover:border-line-strong'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[11px] tracking-wide text-muted uppercase">
                      <span className="gothic-title text-accent-bright">{i + 1}</span>
                      {name}
                      {cycleOwners[i] && <span className="ml-auto text-blood normal-case">↻ {cycleOwners[i]}</span>}
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium text-ink">{action ? describeAction(action, macros) : '—'}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </Panel>

      <ActionEditor
        key={selected}
        buttonName={BUTTON_NAMES[selected] ?? ''}
        locked={selected === LOCKED_BUTTON}
        cycleName={cycleOwners[selected]}
        current={buttons[selected]}
        macros={macros}
        disabled={disabled}
        onApply={(action) => onChange(selected, action)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

type Category = 'mouse' | 'media' | 'keyboard' | 'macro';

function categoryOf(action: ButtonAction | undefined): Category {
  switch (action?.type) {
    case ActionType.Media:
      return 'media';
    case ActionType.Keyboard:
      return 'keyboard';
    case ActionType.Macro:
      return 'macro';
    default:
      return 'mouse';
  }
}

function ActionEditor({ buttonName, locked, cycleName, current, macros, disabled, onApply }: {
  buttonName: string;
  locked: boolean;
  cycleName: string | undefined;
  current: ButtonAction | undefined;
  macros: StoredMacro[];
  disabled: boolean;
  onApply: (action: ButtonAction) => void;
}) {
  const [category, setCategory] = useState<Category>(categoryOf(current));

  if (locked) {
    return (
      <Panel title={buttonName}>
        <p className="text-sm text-muted">Este botão não pode ser remapeado: sem ele você poderia ficar sem como clicar.</p>
      </Panel>
    );
  }

  return (
    <Panel
      title={`Função do botão: ${buttonName}`}
      subtitle={
        <>
          Atual: <span className="text-ink">{current ? describeAction(current, macros) : '—'}</span>
          {cycleName && <span className="text-blood"> · controlado pelo ciclo “{cycleName}” (o atalho vai sobrescrever)</span>}
        </>
      }
      actions={
        <Segmented
          value={category}
          onChange={setCategory}
          options={[
            { label: 'Mouse', value: 'mouse' },
            { label: 'Mídia', value: 'media' },
            { label: 'Teclado', value: 'keyboard' },
            { label: 'Macro', value: 'macro' },
          ]}
        />
      }
    >
      {category === 'mouse' && <PresetPicker presets={MOUSE_ACTIONS} current={current} disabled={disabled} onApply={onApply} />}
      {category === 'media' && <PresetPicker presets={MEDIA_ACTIONS} current={current} disabled={disabled} onApply={onApply} />}
      {category === 'keyboard' && <KeyboardPicker current={current} disabled={disabled} onApply={onApply} />}
      {category === 'macro' && <MacroPicker macros={macros} current={current} disabled={disabled} onApply={onApply} />}
    </Panel>
  );
}

function PresetPicker({ presets, current, disabled, onApply }: {
  presets: (ButtonAction & { name: string })[];
  current: ButtonAction | undefined;
  disabled: boolean;
  onApply: (action: ButtonAction) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((p) => (
        <Chip
          key={p.name}
          disabled={disabled}
          active={current !== undefined && sameAction(p, current)}
          onClick={() => onApply({ type: p.type, code1: p.code1, code2: p.code2, code3: p.code3 })}
        >
          {p.name}
        </Chip>
      ))}
    </div>
  );
}

function KeyboardPicker({ current, disabled, onApply }: {
  current: ButtonAction | undefined;
  disabled: boolean;
  onApply: (action: ButtonAction) => void;
}) {
  const initial = current?.type === ActionType.Keyboard ? current : undefined;
  const [mods, setMods] = useState(initial?.code1 ?? 0);
  const [usage, setUsage] = useState(initial?.code2 ?? 0);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!capturing) return;
    const endCapture = beginKeyCapture();
    let held = 0;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const bit = MODIFIER_BITS[e.code];
      if (bit !== undefined) {
        held = e.type === 'keydown' ? held | bit : held & ~bit;
        setMods(held);
        return;
      }
      if (e.type !== 'keydown') return;
      const hid = KEY_CODE_TO_HID[e.code];
      if (hid === undefined) return;
      setMods(held);
      setUsage(hid);
      setCapturing(false);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      endCapture();
    };
  }, [capturing]);

  const highlighted = useMemo(() => {
    const set = new Set<string>();
    for (const [code, bit] of Object.entries(MODIFIER_BITS)) if (mods & bit) set.add(code);
    const keyCode = Object.entries(KEY_CODE_TO_HID).find(([, hid]) => hid === usage)?.[0];
    if (keyCode) set.add(keyCode);
    return set;
  }, [mods, usage]);

  const preview = keyboardAction(mods, usage);
  const empty = mods === 0 && usage === 0;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Clique nas teclas do desenho. Ctrl, Shift, Alt e Win ligam e desligam; qualquer outra tecla vira a tecla principal.
      </p>
      <VisualKeyboard
        highlighted={highlighted}
        onPress={(code) => {
          const bit = MODIFIER_BITS[code];
          if (bit !== undefined) setMods((m) => m ^ bit);
          else {
            const hid = KEY_CODE_TO_HID[code];
            if (hid !== undefined) setUsage(hid === usage ? 0 : hid);
          }
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-void/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">Resultado:</span>
          <span className="font-mono text-sm text-accent-bright">{empty ? 'nenhuma tecla' : describeAction(preview)}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={capturing ? 'danger' : 'ghost'} onClick={() => setCapturing(!capturing)}>
            {capturing ? 'Aperte a combinação…' : 'Capturar do teclado'}
          </Button>
          <Button size="sm" variant="subtle" onClick={() => (setMods(0), setUsage(0))}>Limpar</Button>
          <Button size="sm" variant="primary" disabled={disabled || empty} onClick={() => onApply(preview)}>Aplicar</Button>
        </div>
      </div>
    </div>
  );
}

function MacroPicker({ macros, current, disabled, onApply }: {
  macros: StoredMacro[];
  current: ButtonAction | undefined;
  disabled: boolean;
  onApply: (action: ButtonAction) => void;
}) {
  const initial = current?.type === ActionType.Macro ? current : undefined;
  const [index, setIndex] = useState(initial && initial.code1 < macros.length ? initial.code1 : 0);
  const [mode, setMode] = useState<MacroLoopMode>(safeLoopMode(initial?.code3));
  const [repeat, setRepeat] = useState(initial?.code2 ?? 1);

  if (macros.length === 0) {
    return <p className="text-sm text-muted">Você ainda não tem macros. Crie uma na seção Macros e volte aqui.</p>;
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-2">
        <div className="text-xs text-muted">Macro</div>
        <select className={selectClass} value={index} onChange={(e) => setIndex(Number(e.target.value))}>
          {macros.map((m, i) => (
            <option key={m.id} value={i}>
              {m.name || `Macro ${i + 1}`} ({m.events.length} eventos)
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <div className="text-xs text-muted">Quando apertar o botão</div>
        <RepeatOptions mode={mode} repeat={repeat} onMode={setMode} onRepeat={setRepeat} />
      </div>
      <div className="flex justify-end md:col-span-2">
        <Button variant="primary" disabled={disabled} onClick={() => onApply(macroAction(index, mode, repeat))}>Aplicar macro</Button>
      </div>
    </div>
  );
}

export function RepeatOptions({ mode, repeat, onMode, onRepeat }: {
  mode: MacroLoopMode;
  repeat: number;
  onMode: (mode: MacroLoopMode) => void;
  onRepeat: (repeat: number) => void;
}) {
  return (
    <div className="space-y-2 text-sm">
      {([
        [MacroLoopMode.FixedCount, 'Executar'],
        [MacroLoopMode.UntilReleased, 'Repetir enquanto o botão estiver apertado'],
        [MacroLoopMode.UntilAnyKey, 'Repetir até apertar outro botão'],
      ] as const).map(([value, label]) => (
        <label key={value} className="flex cursor-pointer items-center gap-3 text-ink">
          <input type="radio" className="accent-[var(--color-accent)]" checked={mode === value} onChange={() => onMode(value)} />
          {label}
          {value === MacroLoopMode.FixedCount && (
            <span className="flex items-center gap-2 text-muted">
              <input
                type="number"
                min={1}
                max={255}
                value={repeat}
                disabled={mode !== value}
                onChange={(e) => onRepeat(Math.max(1, Math.min(255, Number(e.target.value) || 1)))}
                className="w-16 rounded border border-line bg-void px-2 py-1 text-right text-ink outline-none focus:border-accent disabled:opacity-40"
              />
              {repeat === 1 ? 'vez' : 'vezes'}
            </span>
          )}
        </label>
      ))}
    </div>
  );
}
