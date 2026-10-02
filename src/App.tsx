import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppProfiles } from './components/AppProfiles';
import { AppSettings } from './components/AppSettings';
import { ButtonMapping } from './components/ButtonMapping';
import { DeviceSettings } from './components/DeviceSettings';
import { DPIConfig } from './components/DPIConfig';
import { Header, type ConnectionStatus } from './components/Header';
import { MacroCycles } from './components/MacroCycles';
import { MacroEditor } from './components/MacroEditor';
import { PerformanceConfig } from './components/PerformanceConfig';
import { Button, Divider, PageIntro } from './components/ui';
import { renderIconPng } from './components/DeviceIcon';
import {
  effectiveButtons,
  loadAppProfiles,
  newAppProfile,
  pickActiveProfile,
  sameButtons,
  watchedExes,
  type AppProfile,
} from './state/appProfiles';
import { downloadBackup, makeBackup, parseBackup } from './state/backup';
import { applyTheme, loadTheme, type ThemeId } from './state/theme';
import { desktop } from './desktop/bridge';
import {
  ActionType,
  BUTTON_COUNT,
  BUTTON_NAMES,
  DEFAULT_BUTTONS,
  MouseDriver,
  MouseDriverError,
  POLLING_RATES,
  macroAction,
  type BatteryStatus,
  type ButtonAction,
  type ConnectionMode,
  type MouseConfig,
  type PollingRate,
} from './driver/protocol';
import { useHotkeys, type HotkeyBinding } from './hooks/useHotkeys';
import {
  DEFAULT_PROFILE,
  loadCycles,
  loadMacros,
  loadStored,
  newCycle,
  store,
  type DeviceProfile,
  type MacroCycle,
  type StoredMacro,
} from './state/types';

const DEFAULT_DPI_COLORS = ['#a259ff', '#c4183c', '#6d28d9', '#e879f9', '#94a3b8', '#38bdf8'];
const DPI_WRITE_DEBOUNCE_MS = 250;
const MACRO_SYNC_DEBOUNCE_MS = 800;
const BATTERY_POLL_MS = 60_000;

type Page = 'dpi' | 'performance' | 'buttons' | 'macros' | 'cycles' | 'profiles' | 'device' | 'settings';

const PAGES: { id: Page; label: string; hint: string; icon: string; needsMouse: boolean }[] = [
  { id: 'dpi', label: 'Sensibilidade', hint: 'Níveis de DPI', needsMouse: true, icon: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z' },
  { id: 'performance', label: 'Desempenho', hint: 'Polling, sensor, energia', needsMouse: true, icon: 'M3 13a9 9 0 0 1 18 0M12 13l4-5M5 19h14' },
  { id: 'buttons', label: 'Botões', hint: 'Função de cada botão', needsMouse: true, icon: 'M12 3a6 6 0 0 0-6 6v6a6 6 0 0 0 12 0V9a6 6 0 0 0-6-6ZM12 3v7M6 10h12' },
  { id: 'macros', label: 'Macros', hint: 'Sequências de teclas', needsMouse: false, icon: 'M4 6h16M4 12h10M4 18h6M17 15l3 3-3 3' },
  { id: 'cycles', label: 'Atalhos', hint: 'Trocar macros no teclado', needsMouse: false, icon: 'M4 7h13l-3-3M20 17H7l3 3' },
  { id: 'profiles', label: 'Por programa', hint: 'Macros por jogo ou app', needsMouse: false, icon: 'M3 5h18v12H3zM8 21h8M12 17v4M7 10l2 2 4-4' },
  { id: 'device', label: 'Dispositivo', hint: 'Nome, ícone, fábrica', needsMouse: false, icon: 'M12 3a6 6 0 0 0-6 6v6a6 6 0 0 0 12 0V9a6 6 0 0 0-6-6ZM9 21h6' },
  { id: 'settings', label: 'Configurações', hint: 'Tema, backup, programa', needsMouse: false, icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12l2-1-1-3-2 .2-1.3-1.5.3-2.1-3-1-1 1.8h-2l-1-1.8-3 1 .3 2.1L6 8.2 4 8l-1 3 2 1v1l-2 1 1 3 2-.2 1.3 1.5-.3 2.1 3 1 1-1.8h2l1 1.8 3-1-.3-2.1 1.3-1.5 2 .2 1-3-2-1Z' },
];

const PAGE_INTRO: Record<Page, string> = {
  dpi: 'Defina até 6 níveis de sensibilidade. O botão DPI do mouse alterna entre os níveis ativos, e cada mudança é salva na hora.',
  performance: 'Ajustes finos do sensor, da taxa de resposta e de economia de energia. Tudo fica gravado na memória do mouse.',
  buttons: 'Troque a função de qualquer botão: outro clique, uma tecla ou combinação, um comando de mídia ou uma macro. Este é o padrão, usado quando nenhum perfil por programa está ativo.',
  macros: 'Monte sequências de teclas e cliques, ajuste cada evento e atribua a macro a um botão em Botões, Atalhos ou Por programa.',
  cycles: 'Troque a macro de um botão com um atalho de teclado: cada toque passa para a próxima macro da lista.',
  profiles: 'Troque as macros dos botões automaticamente quando um jogo ou programa abrir. Quando ele fechar, tudo volta ao padrão.',
  device: 'Personalize como seu mouse aparece aqui e veja informações do hardware.',
  settings: 'Aparência e opções do aplicativo.',
};

interface Toast {
  id: number;
  kind: 'error' | 'info';
  text: string;
}

interface Hud {
  key: number;
  label: string;
  title: string;
  detail: string;
}

const driver = new MouseDriver();
if (import.meta.env.DEV) {
  // No console: bkr1x.debug = true para ver todos os pacotes.
  (window as unknown as { bkr1x: MouseDriver }).bkr1x = driver;
}

function loadBaseButtons(): ButtonAction[] | null {
  const raw = loadStored<ButtonAction[] | null>('bkr1x.baseButtons', null);
  return Array.isArray(raw) && raw.length === BUTTON_COUNT ? raw : null;
}

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>(MouseDriver.isSupported() ? 'disconnected' : 'unsupported');
  const [mode, setMode] = useState<ConnectionMode | null>(null);
  const [online, setOnline] = useState(false);
  const [firmware, setFirmware] = useState<string | null>(null);
  const [battery, setBattery] = useState<BatteryStatus | null>(null);
  const [config, setConfig] = useState<MouseConfig | null>(null);
  /** Mapeamento padrão (seção Botões). O mouse recebe este + as trocas do perfil ativo. */
  const [buttons, setButtons] = useState<ButtonAction[]>(() => DEFAULT_BUTTONS.map((b) => ({ ...b })));
  const [buttonsLoaded, setButtonsLoaded] = useState(false);
  const [macros, setMacros] = useState<StoredMacro[]>(loadMacros);
  const [macrosPending, setMacrosPending] = useState(false);
  const [cycles, setCycles] = useState<MacroCycle[]>(loadCycles);
  const [appProfiles, setAppProfiles] = useState<AppProfile[]>(loadAppProfiles);
  const [running, setRunning] = useState<ReadonlySet<string>>(new Set());
  const [profile, setProfile] = useState<DeviceProfile>(() => ({ ...DEFAULT_PROFILE, ...loadStored('bkr1x.profile', {}) }));
  const [dpiColors, setDpiColors] = useState<string[]>(() => loadStored('bkr1x.dpiColors', DEFAULT_DPI_COLORS));
  const [theme, setTheme] = useState<ThemeId>(loadTheme);
  const [page, setPage] = useState<Page>(() => {
    const saved = loadStored<Page>('bkr1x.page', 'dpi');
    return PAGES.some((p) => p.id === saved) ? saved : 'dpi';
  });
  const [busy, setBusy] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hud, setHud] = useState<Hud | null>(null);

  const loadRequested = useRef(false);
  const dpiTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const macroTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /**
   * Macros alteradas que ainda não foram gravadas no mouse. Fica salvo no disco: se o app
   * fechar antes de o mouse conectar, a gravação acontece na próxima vez. Sem registro
   * (primeira execução desta versão), assume pendente se houver macros.
   */
  const macroDirty = useRef<boolean>(loadStored<boolean | null>('bkr1x.macrosDirty', null) ?? loadMacros().length > 0);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Último mapeamento gravado no mouse (null = desconhecido). */
  const lastSent = useRef<ButtonAction[] | null>(null);

  // Refs para handlers chamados fora do ciclo de render (atalhos, timers).
  const latest = useRef({ macros, buttons, cycles, ready: false, activeProfile: null as AppProfile | null });

  useEffect(() => store('bkr1x.macros', macros), [macros]);
  useEffect(() => store('bkr1x.cycles', cycles), [cycles]);
  useEffect(() => store('bkr1x.appProfiles', appProfiles), [appProfiles]);
  useEffect(() => store('bkr1x.profile', profile), [profile]);
  useEffect(() => store('bkr1x.dpiColors', dpiColors), [dpiColors]);
  useEffect(() => store('bkr1x.page', page), [page]);
  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => {
    if (buttonsLoaded) store('bkr1x.baseButtons', buttons);
  }, [buttons, buttonsLoaded]);
  useEffect(() => {
    const name = profile.name || DEFAULT_PROFILE.name;
    document.title = desktop ? name : `${name} · Configurador`;
  }, [profile.name]);

  // Desktop: o nome e o ícone do mouse viram o nome e o ícone do programa.
  useEffect(() => {
    if (!desktop) return;
    let cancelled = false;
    renderIconPng(profile.icon)
      .catch(() => null)
      .then((png) => {
        if (!cancelled) void desktop?.setIdentity({ name: profile.name || DEFAULT_PROFILE.name, png });
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'error') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const showHud = useCallback((label: string, title: string, detail: string) => {
    clearTimeout(hudTimer.current);
    setHud({ key: Date.now(), label, title, detail });
    hudTimer.current = setTimeout(() => setHud(null), 2200);
  }, []);

  /** Executa um comando no mouse mostrando atividade e erros amigáveis. */
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      setBusy((n) => n + 1);
      try {
        return await fn();
      } catch (err) {
        console.error(err);
        toast(errorMessage(err));
        return undefined;
      } finally {
        setBusy((n) => n - 1);
      }
    },
    [toast],
  );

  // -- perfis por programa -----------------------------------------------------

  const watched = useMemo(() => watchedExes(appProfiles), [appProfiles]);
  const watchedKey = watched.join('|');
  useEffect(() => {
    if (!desktop) return;
    return desktop.onProcesses((list) => setRunning(new Set(list)));
  }, []);
  useEffect(() => {
    void desktop?.watchProcesses(watchedKey ? watchedKey.split('|') : []);
  }, [watchedKey]);

  const activeProfile = useMemo(() => pickActiveProfile(appProfiles, running), [appProfiles, running]);
  const effective = useMemo(() => effectiveButtons(buttons, activeProfile, macros), [buttons, activeProfile, macros]);

  // Aviso na tela quando o perfil muda (não na primeira leitura).
  const shownProfile = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const id = activeProfile?.id ?? null;
    if (shownProfile.current !== undefined && shownProfile.current !== id) {
      if (activeProfile) showHud('Perfil ativo', activeProfile.name, `${effective.overridden.size} botão(ões) trocado(s)`);
      else showHud('Perfil', 'Padrão', 'Os botões voltaram ao normal');
    }
    shownProfile.current = id;
  }, [activeProfile, effective.overridden.size, showHud]);

  // -- conexão ---------------------------------------------------------------

  const resetState = useCallback(() => {
    clearTimeout(dpiTimer.current);
    setStatus(MouseDriver.isSupported() ? 'disconnected' : 'unsupported');
    setMode(null);
    setOnline(false);
    setFirmware(null);
    setBattery(null);
    setConfig(null);
    setLoadError(false);
    setButtonsLoaded(false);
    lastSent.current = null;
    loadRequested.current = false;
  }, []);

  const loadAll = useCallback(async () => {
    loadRequested.current = true;
    setLoadError(false);
    await run(async () => setFirmware(await driver.getFirmwareVersion()));
    await run(async () => {
      const b = await driver.getBattery();
      if (b.level > 0) setBattery(b);
    });
    const cfg = await run(() => driver.readConfig());
    if (cfg) setConfig(cfg);
    else setLoadError(true);
    const onDevice = await run(() => driver.readKeyMapping());
    if (onDevice) {
      lastSent.current = onDevice;
      // Se um perfil estava aplicado quando o app fechou, o mouse está com as trocas dele:
      // o padrão de verdade é o que ficou salvo.
      const savedBase = loadBaseButtons();
      const profileWasApplied = loadStored<string | null>('bkr1x.appliedProfile', null) !== null;
      setButtons(profileWasApplied && savedBase ? savedBase : onDevice);
      setButtonsLoaded(true);
    }
  }, [run]);

  const afterAttach = useCallback(async () => {
    setStatus('connected');
    setMode(driver.connectionMode);
    setOnline((await run(() => driver.getOnline())) ?? false);
  }, [run]);

  useEffect(() => {
    const offs = [
      driver.on('battery', (b) => setBattery(b)),
      driver.on('status', ({ dpiIndex, pollingRateIndex }) =>
        setConfig((c) =>
          c
            ? {
                ...c,
                dpiIndex: dpiIndex >= 0 ? dpiIndex : c.dpiIndex,
                pollingRateIndex: pollingRateIndex >= 0 && pollingRateIndex < POLLING_RATES.length ? pollingRateIndex : c.pollingRateIndex,
              }
            : c,
        ),
      ),
      driver.on('online', (isOnline) => {
        setOnline(isOnline);
        if (!isOnline) {
          loadRequested.current = false;
          setConfig(null);
          setButtonsLoaded(false);
          lastSent.current = null;
        }
      }),
      driver.on('disconnect', () => {
        resetState();
        toast('O mouse foi desconectado.', 'info');
      }),
    ];

    let cancelled = false;
    if (MouseDriver.isSupported()) {
      setStatus('connecting');
      driver
        .reconnect()
        .then((ok) => {
          if (cancelled) return;
          if (ok) return afterAttach();
          setStatus('disconnected');
        })
        .catch((err) => {
          if (cancelled) return;
          setStatus('disconnected');
          toast(errorMessage(err));
        });
    }
    return () => {
      cancelled = true;
      offs.forEach((off) => off());
    };
  }, [afterAttach, resetState, toast]);

  useEffect(() => {
    if (status === 'connected' && online && !loadRequested.current) void loadAll();
  }, [status, online, loadAll]);

  useEffect(() => {
    if (status !== 'connected' || !online || mode !== '2.4G') return;
    const timer = setInterval(() => {
      driver.getBattery().then((b) => b.level > 0 && setBattery(b)).catch(() => undefined);
    }, BATTERY_POLL_MS);
    return () => clearInterval(timer);
  }, [status, online, mode]);

  const connect = async () => {
    setStatus('connecting');
    try {
      if (await driver.connect()) await afterAttach();
      else setStatus('disconnected');
    } catch (err) {
      setStatus('disconnected');
      toast(errorMessage(err));
    }
  };

  const disconnect = async () => {
    await driver.disconnect();
    resetState();
  };

  const ready = status === 'connected' && online && config !== null;
  latest.current = { macros, buttons, cycles, ready, activeProfile };

  // -- macros: sincronização automática --------------------------------------

  /** Grava as macros no mouse se houver alteração pendente. */
  const flushMacros = useCallback(
    async (list?: StoredMacro[]) => {
      clearTimeout(macroTimer.current);
      if (!macroDirty.current || !latest.current.ready) return;
      macroDirty.current = false;
      setMacrosPending(false);
      const ok = await run(async () => {
        await driver.sendMacros(list ?? latest.current.macros);
        return true;
      });
      if (ok) store('bkr1x.macrosDirty', false);
      else {
        macroDirty.current = true;
        setMacrosPending(true);
      }
    },
    [run],
  );

  const markMacrosDirty = () => {
    macroDirty.current = true;
    store('bkr1x.macrosDirty', true);
  };

  const scheduleMacroSync = () => {
    markMacrosDirty();
    setMacrosPending(true);
    clearTimeout(macroTimer.current);
    macroTimer.current = setTimeout(() => void flushMacros(), MACRO_SYNC_DEBOUNCE_MS);
  };

  // Alterações feitas com o mouse desligado são enviadas quando ele volta.
  useEffect(() => {
    if (ready && macroDirty.current) void flushMacros();
  }, [ready, flushMacros]);

  // -- botões: o mouse sempre recebe o mapeamento efetivo ----------------------

  useEffect(() => {
    if (!ready || !buttonsLoaded) return;
    const target = effective.buttons;
    if (lastSent.current && sameButtons(lastSent.current, target)) return;
    lastSent.current = target;
    const profileId = activeProfile?.id ?? null;
    void (async () => {
      if (target.some((b) => b.type === ActionType.Macro)) await flushMacros();
      const ok = await run(async () => {
        await driver.sendKeyMapping(target);
        return true;
      });
      if (ok) store('bkr1x.appliedProfile', profileId);
      else lastSent.current = null;
    })();
  }, [ready, buttonsLoaded, effective, activeProfile, flushMacros, run]);

  const changeMacros = (next: StoredMacro[]) => {
    setMacros(next);
    scheduleMacroSync();
  };

  /** Excluir muda os índices no firmware: reaponta botões, ciclos e perfis. */
  const deleteMacro = async (id: string) => {
    const index = macros.findIndex((m) => m.id === id);
    if (index < 0) return;
    const next = macros.filter((m) => m.id !== id);
    const nextButtons = buttons.map((b, i) => {
      if (b.type !== ActionType.Macro || b.code1 < index) return b;
      return b.code1 === index ? { ...DEFAULT_BUTTONS[i]! } : { ...b, code1: b.code1 - 1 };
    });
    markMacrosDirty();
    setMacros(next);
    setButtons(nextButtons);
    setCycles((cs) =>
      cs.map((c) => {
        const ids = c.macroIds.filter((m) => m !== id);
        return ids.length === c.macroIds.length ? c : { ...c, macroIds: ids, current: Math.min(c.current, Math.max(0, ids.length - 1)) };
      }),
    );
    setAppProfiles((ps) =>
      ps.map((p) => ({ ...p, overrides: Object.fromEntries(Object.entries(p.overrides).filter(([, o]) => o.macroId !== id)) })),
    );
    await flushMacros(next);
  };

  const macroUsage = useMemo(() => {
    const usage: Record<string, string[]> = {};
    buttons.forEach((b, i) => {
      const m = b.type === ActionType.Macro ? macros[b.code1] : undefined;
      if (m) (usage[m.id] ??= []).push(BUTTON_NAMES[i]!);
    });
    cycles.forEach((c) => c.macroIds.forEach((id) => (usage[id] ??= []).push(`ciclo “${c.name}”`)));
    appProfiles.forEach((p) =>
      new Set(Object.values(p.overrides).map((o) => o.macroId)).forEach((id) => (usage[id] ??= []).push(`perfil “${p.name}”`)),
    );
    return usage;
  }, [buttons, macros, cycles, appProfiles]);

  // -- ciclos de macro ---------------------------------------------------------

  const stepCycle = useCallback(
    async (cycleId: string, direction: 1 | -1) => {
      const { macros, buttons, cycles, ready, activeProfile } = latest.current;
      const cycle = cycles.find((c) => c.id === cycleId);
      if (!cycle) return;
      if (!ready) return toast('Conecte o mouse para trocar de macro.');
      const ids = cycle.macroIds.filter((id) => macros.some((m) => m.id === id));
      if (ids.length === 0) return toast(`O ciclo “${cycle.name}” não tem macros.`);

      const current = Math.min(cycle.current, ids.length - 1);
      const currentIndex = macros.findIndex((m) => m.id === ids[current]);
      const assigned = buttons[cycle.button];
      // Primeiro toque aplica a macro atual se o botão ainda não estiver nela.
      const alreadyOn = assigned?.type === ActionType.Macro && assigned.code1 === currentIndex;
      const pos = alreadyOn ? (current + direction + ids.length) % ids.length : current;
      const macroIndex = macros.findIndex((m) => m.id === ids[pos]);
      const macro = macros[macroIndex]!;

      setCycles((cs) => cs.map((c) => (c.id === cycleId ? { ...c, current: pos } : c)));
      const blocked = activeProfile?.overrides[cycle.button] !== undefined;
      showHud(
        'Macro ativa',
        macro.name,
        blocked
          ? `Perfil “${activeProfile!.name}” está usando este botão; vale quando ele fechar`
          : `${BUTTON_NAMES[cycle.button]} · ${pos + 1}/${ids.length}`,
      );
      setButtons(buttons.map((b, i) => (i === cycle.button ? macroAction(macroIndex, cycle.mode, cycle.repeat) : b)));
    },
    [showHud, toast],
  );

  const hotkeys = useMemo<HotkeyBinding[]>(
    () =>
      cycles
        .filter((c) => c.enabled)
        .flatMap((c) => [
          ...(c.next ? [{ id: `${c.id}:next`, hotkey: c.next, run: () => void stepCycle(c.id, 1) }] : []),
          ...(c.prev ? [{ id: `${c.id}:prev`, hotkey: c.prev, run: () => void stepCycle(c.id, -1) }] : []),
        ]),
    [cycles, stepCycle],
  );
  const failedHotkeys = useHotkeys(hotkeys);

  const cycleOwners = useMemo(() => {
    const owners: Record<number, string> = {};
    cycles.forEach((c) => c.enabled && c.macroIds.length > 0 && (owners[c.button] = c.name));
    return owners;
  }, [cycles]);

  // -- configuração ------------------------------------------------------------

  const updateConfig = (patch: Partial<MouseConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...patch });
    void run(async () => setConfig(await driver.updateConfig(patch)));
  };

  const setStageValue = (index: number, value: number) => {
    if (!config) return;
    const dpi = config.dpi.map((v, i) => (i === index ? value : v));
    setConfig({ ...config, dpi });
    clearTimeout(dpiTimer.current);
    dpiTimer.current = setTimeout(() => void run(() => driver.sendDPI({ values: dpi })), DPI_WRITE_DEBOUNCE_MS);
  };

  const setActiveStage = (index: number) => {
    if (!config) return;
    setConfig({ ...config, dpiIndex: index });
    void run(() => driver.sendDPI({ activeIndex: index }));
  };

  const setStageCount = (count: number) => {
    if (!config) return;
    const dpiIndex = Math.min(config.dpiIndex, count - 1);
    setConfig({ ...config, dpiCount: count, dpiIndex });
    void run(() => driver.sendDPI({ count, activeIndex: dpiIndex }));
  };

  const setPollingRate = (rate: PollingRate) => {
    void run(async () => setConfig(await driver.sendPollingRate(rate)));
  };

  const setButton = (index: number, action: ButtonAction) => setButtons(buttons.map((b, i) => (i === index ? action : b)));

  const resetButtons = () => {
    if (!confirm('Restaurar a função original de todos os botões?')) return;
    setButtons(DEFAULT_BUTTONS.map((b) => ({ ...b })));
  };

  const exportBackup = () => downloadBackup(makeBackup({ macros, cycles, profile, dpiColors, appProfiles, theme }));

  const importBackup = async (file: File) => {
    let backup;
    try {
      backup = parseBackup(await file.text());
    } catch (err) {
      return toast(err instanceof Error ? err.message : 'Não foi possível ler o arquivo.');
    }
    const summary = `${backup.macros.length} macro(s), ${backup.cycles.length} ciclo(s) e ${backup.appProfiles.length} perfil(is)`;
    if (!confirm(`Importar ${summary}? Isso substitui as macros, ciclos, perfis, nome e ícone atuais deste computador e grava as macros no mouse.`)) return;
    setMacros(backup.macros);
    setCycles(backup.cycles);
    setAppProfiles(backup.appProfiles);
    setProfile(backup.profile);
    if (backup.dpiColors.length) setDpiColors(backup.dpiColors);
    if (backup.theme) setTheme(backup.theme);
    markMacrosDirty();
    setMacrosPending(true);
    await flushMacros(backup.macros);
    toast(`Importado: ${summary}.`, 'info');
  };

  const factoryReset = () => {
    if (!confirm('Restaurar DPI, polling, sensor, energia e botões para o padrão de fábrica?')) return;
    void run(async () => {
      setConfig(await driver.restoreFactorySettings());
      const defaults = DEFAULT_BUTTONS.map((b) => ({ ...b }));
      lastSent.current = defaults;
      setButtons(defaults);
      toast('Configurações de fábrica restauradas.', 'info');
    });
  };

  // -- render ------------------------------------------------------------------

  const saving = busy > 0 || macrosPending;
  const current = PAGES.find((p) => p.id === page)!;
  const liveProfile = activeProfile ? { name: activeProfile.name, buttons: effective.overridden, actions: effective.buttons } : null;

  return (
    <div className="min-h-screen">
      <Header
        status={status}
        mode={mode}
        online={online}
        battery={battery}
        profile={profile}
        saving={saving}
        activeProfileName={activeProfile?.name ?? null}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_1fr]">
        <nav className="app-nav flex gap-1 overflow-x-auto lg:sticky lg:top-24 lg:flex-col lg:self-start lg:overflow-visible" aria-label="Seções">
          {PAGES.map((p) => {
            const active = page === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPage(p.id)}
                aria-current={active ? 'page' : undefined}
                className={`group flex shrink-0 items-center gap-3 rounded-md border px-3 py-2.5 text-left transition ${
                  active
                    ? 'border-accent/50 bg-gradient-to-r from-accent/20 to-transparent shadow-[inset_3px_0_0_var(--color-accent)]'
                    : 'border-transparent hover:bg-panel-2'
                }`}
              >
                <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 fill-none stroke-[1.6] ${active ? 'stroke-accent-bright' : 'stroke-muted group-hover:stroke-ink'}`}>
                  <path d={p.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <span className={`gothic-title block text-xs font-bold uppercase ${active ? 'text-ink' : 'text-muted group-hover:text-ink'}`}>{p.label}</span>
                  <span className="hidden text-[11px] text-muted/80 lg:block">{p.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <main key={page} className="rise-in min-w-0">
          <PageIntro title={current.label}>{PAGE_INTRO[page]}</PageIntro>
          {current.needsMouse && (!ready || !config) ? (
            <ConnectionNotice status={status} online={online} loadError={loadError} busy={busy > 0} onConnect={connect} onRetry={() => void loadAll()} />
          ) : (
            <div className="space-y-5">
              {page === 'dpi' && config && (
                <DPIConfig
                  config={config}
                  colors={dpiColors}
                  disabled={!ready}
                  onStageValue={setStageValue}
                  onActiveStage={setActiveStage}
                  onStageCount={setStageCount}
                  onColor={(i, color) => setDpiColors((c) => c.map((x, j) => (j === i ? color : x)))}
                />
              )}
              {page === 'performance' && config && (
                <PerformanceConfig config={config} isUsb={mode === 'USB'} disabled={!ready} onPollingRate={setPollingRate} onChange={updateConfig} />
              )}
              {page === 'buttons' && (
                <ButtonMapping
                  buttons={buttons}
                  macros={macros}
                  cycleOwners={cycleOwners}
                  liveProfile={liveProfile}
                  disabled={!ready}
                  onChange={setButton}
                  onReset={resetButtons}
                />
              )}
              {page === 'macros' && <MacroEditor macros={macros} usage={macroUsage} onChange={changeMacros} onDelete={(id) => void deleteMacro(id)} />}
              {page === 'cycles' && (
                <MacroCycles
                  cycles={cycles}
                  macros={macros}
                  connected={ready}
                  onChange={setCycles}
                  onAdd={() => setCycles((cs) => [...cs, newCycle(cs.length)])}
                  failedHotkeys={failedHotkeys}
                  onStep={(id, dir) => void stepCycle(id, dir)}
                />
              )}
              {page === 'profiles' && (
                <AppProfiles
                  profiles={appProfiles}
                  macros={macros}
                  running={running}
                  activeId={activeProfile?.id ?? null}
                  cycleOwners={cycleOwners}
                  onChange={setAppProfiles}
                  onAdd={() => setAppProfiles((ps) => [...ps, newAppProfile(ps.length)])}
                />
              )}
              {page === 'device' && (
                <DeviceSettings profile={profile} firmware={firmware} mode={mode} disabled={!ready} onProfile={setProfile} onFactoryReset={factoryReset} />
              )}
              {page === 'settings' && (
                <AppSettings theme={theme} onTheme={setTheme} onExport={exportBackup} onImport={(file) => void importBackup(file)} />
              )}
            </div>
          )}
        </main>
      </div>

      {hud && (
        <div key={hud.key} className="rise-in pointer-events-none fixed top-20 left-1/2 z-40 -translate-x-1/2" role="status">
          <div
            className="gothic-panel px-8 py-4 text-center shadow-[0_0_60px_-10px_var(--glow)]"
            style={{ background: 'var(--color-panel)', borderColor: 'var(--color-accent)', backdropFilter: 'none' }}
          >
            <div className="text-[10px] tracking-[0.3em] text-muted uppercase">{hud.label}</div>
            <div className="gothic-title mt-1 text-xl font-bold text-accent-bright">{hud.title}</div>
            <div className="mt-0.5 text-xs text-muted">{hud.detail}</div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed right-4 bottom-4 left-4 z-30 flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`rise-in pointer-events-auto max-w-md rounded-md border px-4 py-3 text-sm shadow-xl ${
              t.kind === 'error' ? 'border-danger/70 bg-panel text-ink' : 'border-accent/60 bg-panel text-ink'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectionNotice({ status, online, loadError, busy, onConnect, onRetry }: {
  status: ConnectionStatus;
  online: boolean;
  loadError: boolean;
  busy: boolean;
  onConnect: () => void;
  onRetry: () => void;
}) {
  if (status === 'unsupported') {
    return (
      <Notice title="Navegador sem suporte">
        Abra esta página no <b className="text-ink">Google Chrome</b> ou no <b className="text-ink">Microsoft Edge</b> no computador. Firefox,
        Safari e navegadores de celular não acessam dispositivos USB.
      </Notice>
    );
  }
  if (status !== 'connected') {
    return (
      <Notice title={status === 'connecting' ? 'Procurando o mouse…' : 'Conecte seu mouse'}>
        Plugue o receptor 2.4G ou o cabo USB e clique em <b className="text-ink">Conectar mouse</b>. Na janela que abrir, escolha “USB Receiver”.
        Macros, atalhos, perfis e configurações funcionam mesmo sem o mouse.
        <div className="mt-6">
          <Button variant="primary" onClick={onConnect} disabled={status !== 'disconnected'}>
            Conectar mouse
          </Button>
        </div>
      </Notice>
    );
  }
  if (!online) {
    return (
      <Notice title="O mouse está dormindo">
        O receptor está conectado, mas o mouse não respondeu. Ligue o mouse ou mexa nele para acordá-lo; a tela atualiza sozinha.
      </Notice>
    );
  }
  if (loadError) {
    return (
      <Notice title="Não foi possível ler o mouse">
        Mexa o mouse para acordá-lo e tente de novo.
        <div className="mt-6">
          <Button variant="primary" onClick={onRetry} disabled={busy}>
            Tentar novamente
          </Button>
        </div>
      </Notice>
    );
  }
  return <Notice title="Lendo o mouse…">Só um instante.</Notice>;
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="gothic-panel mx-auto mt-6 max-w-xl p-10 text-center">
      <h2 className="gothic-title text-xl font-bold text-ink">{title}</h2>
      <div className="flex justify-center">
        <Divider />
      </div>
      <div className="text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof MouseDriverError) return err.message;
  if (err instanceof DOMException && err.name === 'NotAllowedError') return 'Permissão negada pelo navegador.';
  if (err instanceof Error) return `Erro inesperado: ${err.message}`;
  return 'Erro inesperado.';
}
