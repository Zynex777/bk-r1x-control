/**
 * Driver WebHID do mouse BK-R1X.
 *
 * Protocolo documentado em ./protocol_docs.md (engenharia reversa do app oficial
 * bk-r1x.yjx2012.com). Offsets nos comentários são do payload de 64 bytes,
 * isto é, sem o reportId.
 */

// ---------------------------------------------------------------------------
// Identificação / transporte
// ---------------------------------------------------------------------------

export const VENDOR_ID_USB = 0xa8a4;
export const VENDOR_ID_DONGLE = 0xa8a5;
export const PRODUCT_ID = 0x2255;
export const USAGE_PAGE = 0xff01;
export const USAGE = 0x10;

export const DEVICE_FILTERS: HIDDeviceFilter[] = [
  { vendorId: VENDOR_ID_USB, productId: PRODUCT_ID, usagePage: USAGE_PAGE, usage: USAGE },
  { vendorId: VENDOR_ID_DONGLE, productId: PRODUCT_ID, usagePage: USAGE_PAGE, usage: USAGE },
];

const REPORT_ID = 0x00;
const PAYLOAD_SIZE = 64;
const MAGIC = 0x55;
const RESPONSE_TIMEOUT_MS = 500;

const Cmd = {
  Version: 0x03,
  ReadKeys: 0x08,
  WriteKeys: 0x09,
  MacroData: 0x0d,
  ReadConfig: 0x0e,
  WriteConfig: 0x0f,
  MacroCommit: 0x10,
  LightMode: 0x21,
  Battery: 0x30,
  Online: 0xed,
} as const;

// ---------------------------------------------------------------------------
// Valores do domínio
// ---------------------------------------------------------------------------

export type ConnectionMode = 'USB' | '2.4G';

export const POLLING_RATES = [125, 250, 500, 1000] as const;
export type PollingRate = (typeof POLLING_RATES)[number];

export const DPI_MIN = 200;
export const DPI_MAX = 18000;
export const DPI_STEP = 100;
export const DPI_STAGES = 6;

export const LightMode = {
  Off: 0,
  Wave: 1,
  Neon: 2,
  RotatingBlink: 3,
  YoYo: 4,
  UnidirectionalBlink: 5,
  Breathing: 6,
} as const;
export type LightMode = (typeof LightMode)[keyof typeof LightMode];

export const SensorFlag = {
  RippleControl: 0x01,
  AngleSnapping: 0x10,
  MotionSync: 0x20,
} as const;

export const SLEEP_MINUTES = [1, 3, 5, 10, 20, 30, 60] as const;
export type SleepMinutes = (typeof SLEEP_MINUTES)[number];

export type LiftOffDistance = 1 | 2;

export interface MouseConfig {
  lightMode: LightMode;
  /** Índice em POLLING_RATES. */
  pollingRateIndex: number;
  /** Quantos estágios de DPI estão ativos no ciclo (1–6). */
  dpiCount: number;
  /** Estágio ativo (0–5). */
  dpiIndex: number;
  /** Sempre DPI_STAGES valores. */
  dpi: number[];
  scrollInverted: boolean;
  lod: LiftOffDistance;
  /** Bitmask de SensorFlag; bits desconhecidos devem ser preservados. */
  sensorFlags: number;
  /** `key_respond`: atraso de resposta do botão (debounce) em ms. */
  debounceMs: number;
  sleepMinutes: number;
  highspeedMode: number;
  wakeOnMove: boolean;
  disableLightOnMove: boolean;
}

export const DEFAULT_CONFIG: Readonly<MouseConfig> = Object.freeze({
  lightMode: LightMode.Off,
  pollingRateIndex: 3,
  dpiCount: 5,
  dpiIndex: 3,
  dpi: [800, 1200, 1600, 3200, 5000, 18000],
  scrollInverted: false,
  lod: 1,
  sensorFlags: 53,
  debounceMs: 2,
  sleepMinutes: 10,
  highspeedMode: 0,
  wakeOnMove: true,
  disableLightOnMove: true,
});

export const ActionType = {
  Keyboard: 0x10,
  MouseButton: 0x20,
  MouseFunction: 0x21,
  Media: 0x30,
  Macro: 0x70,
  Dpi: 0xf0,
} as const;

export interface ButtonAction {
  type: number;
  code1: number;
  code2: number;
  code3: number;
}

export const BUTTON_COUNT = 8;
export const BUTTON_NAMES = [
  'Botão esquerdo',
  'Botão direito',
  'Botão do meio',
  'Voltar',
  'Avançar',
  'Botão DPI',
  'Roda para cima',
  'Roda para baixo',
] as const;

export const DEFAULT_BUTTONS: readonly ButtonAction[] = Object.freeze([
  { type: 0x20, code1: 0x01, code2: 0, code3: 0 },
  { type: 0x20, code1: 0x02, code2: 0, code3: 0 },
  { type: 0x20, code1: 0x04, code2: 0, code3: 0 },
  { type: 0x20, code1: 0x08, code2: 0, code3: 0 },
  { type: 0x20, code1: 0x10, code2: 0, code3: 0 },
  { type: 0x21, code1: 0x55, code2: 0, code3: 0 },
  { type: 0x21, code1: 0x38, code2: 0x01, code3: 0 },
  { type: 0x21, code1: 0x38, code2: 0xff, code3: 0 },
]);

export const MacroLoopMode = {
  FixedCount: 0,
  // O valor 1 é um loop infinito que nada interrompe (testado em hardware). Nunca enviar.
  UntilReleased: 2,
  UntilAnyKey: 3,
} as const;
export type MacroLoopMode = (typeof MacroLoopMode)[keyof typeof MacroLoopMode];

export interface MacroEvent {
  kind: 'key' | 'mouse';
  /** Teclado: HID usage ID. Mouse: bitmask (1=L, 2=R, 4=M, 8=Voltar, 16=Avançar). */
  code: number;
  pressed: boolean;
  /** Pausa depois deste evento, em ms. */
  delayMs: number;
  label: string;
}

export interface Macro {
  name: string;
  events: MacroEvent[];
}

export const MACRO_MAX_COUNT = 32;
export const MACRO_MAX_BYTES = 4096;
const MACRO_TABLE_SIZE = 64;
const MACRO_CHUNK = 56;

/** Valores de code3 seguros. Qualquer outro (ex.: 1 = loop infinito) vira FixedCount. */
export function safeLoopMode(value: number | undefined): MacroLoopMode {
  return value === MacroLoopMode.UntilReleased || value === MacroLoopMode.UntilAnyKey ? value : MacroLoopMode.FixedCount;
}

export function macroAction(index: number, mode: MacroLoopMode, repeat = 1): ButtonAction {
  mode = safeLoopMode(mode);
  return {
    type: ActionType.Macro,
    code1: index,
    code2: mode === MacroLoopMode.FixedCount ? clamp(repeat, 1, 255) : 1,
    code3: mode,
  };
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export interface BatteryStatus {
  level: number;
  charging: boolean;
}

export interface DriverEventMap {
  battery: BatteryStatus;
  /** O usuário trocou DPI/polling pelo botão físico do mouse. */
  status: { dpiIndex: number; pollingRateIndex: number };
  /** Mouse alcançável pelo dongle (sempre true no cabo). */
  online: boolean;
  pairing: undefined;
  disconnect: undefined;
}

type Listener<T> = (payload: T) => void;

export class MouseDriverError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MouseDriverError';
  }
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

interface PendingResponse {
  resolve: (report: Uint8Array | null) => void;
  /** Report com formato de evento recebido durante a transação; usado se nada melhor chegar. */
  fallback: Uint8Array | null;
  timer: ReturnType<typeof setTimeout>;
}

export class MouseDriver {
  /** Loga todos os pacotes no console. */
  debug = false;

  private device: HIDDevice | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private pending: PendingResponse | null = null;
  private attachLock: Promise<void> = Promise.resolve();
  private cachedConfig: MouseConfig | null = null;
  private listeners = new Map<keyof DriverEventMap, Set<Listener<never>>>();

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'hid' in navigator && !!navigator.hid;
  }

  get connected(): boolean {
    return this.device?.opened ?? false;
  }

  get connectionMode(): ConnectionMode | null {
    if (!this.device) return null;
    return this.device.vendorId === VENDOR_ID_USB ? 'USB' : '2.4G';
  }

  get productName(): string {
    return this.device?.productName ?? '';
  }

  /** Último config lido ou gravado. */
  get config(): MouseConfig | null {
    return this.cachedConfig ? cloneConfig(this.cachedConfig) : null;
  }

  // -- ciclo de vida --------------------------------------------------------

  /**
   * Abre o seletor do navegador. Precisa ser chamado a partir de um gesto do usuário.
   * Retorna false se o usuário fechar o seletor sem escolher.
   */
  async connect(): Promise<boolean> {
    assertSupported();
    let devices: HIDDevice[];
    try {
      devices = await navigator.hid.requestDevice({ filters: DEVICE_FILTERS });
    } catch (err) {
      throw new MouseDriverError('Não foi possível abrir o seletor de dispositivos.', { cause: err });
    }
    if (devices.length === 0) return false;
    const device = pickVendorInterface(devices);
    if (!device) {
      throw new MouseDriverError('O dispositivo escolhido não expõe a interface de configuração do BK-R1X.');
    }
    await this.attach(device);
    return true;
  }

  /** Reconecta, sem diálogo, a um mouse já autorizado antes. */
  async reconnect(): Promise<boolean> {
    if (!MouseDriver.isSupported()) return false;
    const device = pickVendorInterface(await navigator.hid.getDevices());
    if (!device) return false;
    await this.attach(device);
    return true;
  }

  async disconnect(): Promise<void> {
    const device = this.device;
    this.detach();
    if (device?.opened) {
      try {
        await device.close();
      } catch {
        // O dispositivo pode já ter sumido; nada a fazer.
      }
    }
  }

  /** Serializa attach: reconnect() e connect() podem correr ao mesmo tempo (ex.: StrictMode). */
  private attach(device: HIDDevice): Promise<void> {
    const next = this.attachLock.then(() => this.doAttach(device));
    this.attachLock = next.catch(() => undefined);
    return next;
  }

  private async doAttach(device: HIDDevice): Promise<void> {
    if (this.device === device && device.opened) return;
    if (this.device) await this.disconnect();
    try {
      if (!device.opened) await device.open();
    } catch (err) {
      throw new MouseDriverError(
        'Não foi possível abrir o mouse. Feche outros apps/abas que estejam usando o dispositivo.',
        { cause: err },
      );
    }
    device.addEventListener('inputreport', this.handleInputReport);
    navigator.hid.addEventListener('disconnect', this.handleHidDisconnect);
    this.device = device;
    this.queue = Promise.resolve();
  }

  private detach(): void {
    this.device?.removeEventListener('inputreport', this.handleInputReport);
    if (MouseDriver.isSupported()) {
      navigator.hid.removeEventListener('disconnect', this.handleHidDisconnect);
    }
    this.device = null;
    this.cachedConfig = null;
    if (this.pending) this.settlePending(null);
  }

  private handleHidDisconnect = (event: HIDConnectionEvent): void => {
    if (event.device !== this.device) return;
    this.detach();
    this.emit('disconnect', undefined);
  };

  // -- eventos --------------------------------------------------------------

  on<K extends keyof DriverEventMap>(event: K, listener: Listener<DriverEventMap[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    const stored = listener as Listener<never>;
    set.add(stored);
    return () => set.delete(stored);
  }

  private emit<K extends keyof DriverEventMap>(event: K, payload: DriverEventMap[K]): void {
    this.listeners.get(event)?.forEach((listener) => (listener as Listener<DriverEventMap[K]>)(payload));
  }

  private handleInputReport = (event: HIDInputReportEvent): void => {
    const data = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
    if (this.debug) console.debug('[BK-R1X] RX', event.reportId, hex(data));

    const isEvent = this.dispatchUnsolicited(data);
    if (!this.pending) return;
    if (!isEvent) this.settlePending(data);
    else this.pending.fallback ??= data;
  };

  /** Interpreta reports enviados pelo mouse por conta própria. Retorna true se reconheceu. */
  private dispatchUnsolicited(d: Uint8Array): boolean {
    if (d[0] === 0xaa && d[1] === 0xfa) {
      if (d[8] === 0xd0) {
        this.emit('battery', { level: d[9] ?? 0, charging: d[10] === 1 });
      } else {
        const status = { dpiIndex: (d[9] ?? 1) - 1, pollingRateIndex: (d[10] ?? 1) - 1 };
        if (this.cachedConfig) {
          if (status.dpiIndex >= 0 && status.dpiIndex < DPI_STAGES) {
            this.cachedConfig.dpiIndex = status.dpiIndex;
          }
          if (status.pollingRateIndex >= 0 && status.pollingRateIndex < POLLING_RATES.length) {
            this.cachedConfig.pollingRateIndex = status.pollingRateIndex;
          }
        }
        this.emit('status', status);
      }
      return true;
    }
    if (d[0] === 0xaa && d[1] === 0xed) {
      this.emit('online', d[8] === 2);
      return true;
    }
    if (d[0] === 0x13 && d[1] === 0xe2) {
      this.emit('pairing', undefined);
      return true;
    }
    return false;
  }

  // -- transporte -----------------------------------------------------------

  private settlePending(report: Uint8Array | null): void {
    const pending = this.pending;
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending = null;
    pending.resolve(report);
  }

  /**
   * Envia um payload e espera o próximo input report. Os comandos são serializados:
   * o mouse responde pelo mesmo canal dos eventos e não há ID de transação.
   */
  private transact(payload: Bytes): Promise<Uint8Array | null> {
    const run = async (): Promise<Uint8Array | null> => {
      const device = this.device;
      if (!device?.opened) throw new MouseDriverError('Mouse não conectado.');

      const response = new Promise<Uint8Array | null>((resolve) => {
        this.pending = {
          resolve,
          fallback: null,
          timer: setTimeout(() => this.settlePending(this.pending?.fallback ?? null), RESPONSE_TIMEOUT_MS),
        };
      });

      if (this.debug) console.debug('[BK-R1X] TX', hex(payload));
      try {
        await device.sendReport(REPORT_ID, payload);
      } catch (err) {
        this.settlePending(null);
        throw new MouseDriverError('Falha ao enviar comando ao mouse.', { cause: err });
      }
      return response;
    };

    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** Comando de leitura: exige resposta. */
  private async query(payload: Bytes): Promise<Uint8Array> {
    const response = await this.transact(payload);
    if (!response) {
      throw new MouseDriverError(
        this.connectionMode === '2.4G'
          ? 'O mouse não respondeu. Verifique se ele está ligado e acordado (mexa o mouse).'
          : 'O mouse não respondeu.',
      );
    }
    return response;
  }

  /** Comando de escrita: a resposta é só um ACK e é ignorada. */
  private async command(payload: Bytes): Promise<void> {
    const response = await this.transact(payload);
    if (!response && this.debug) console.warn('[BK-R1X] sem ACK para', hex(payload.subarray(0, 8)));
  }

  // -- leitura de status ----------------------------------------------------

  async getFirmwareVersion(): Promise<string> {
    const r = await this.query(packet(MAGIC, Cmd.Version));
    const digit = (b: number | undefined) => (b !== undefined && b >= 0x30 && b <= 0x39 ? String.fromCharCode(b) : '0');
    return `${digit(r[23])}.${digit(r[24])}.${digit(r[25])}`;
  }

  async getBattery(): Promise<BatteryStatus> {
    const r = await this.query(packet(MAGIC, Cmd.Battery, 0xa5, 0x0b, 0x2e, 0x01, 0x01));
    return { level: r[8] ?? 0, charging: r[9] === 1 };
  }

  /** No dongle 2.4G: o mouse está ligado e pareado? */
  async getOnline(): Promise<boolean> {
    if (this.connectionMode === 'USB') return true;
    const r = await this.query(packet(MAGIC, Cmd.Online, 0x00, 0x01, 0x2e));
    return r[8] === 2;
  }

  // -- configuração ---------------------------------------------------------

  async readConfig(): Promise<MouseConfig> {
    const r = await this.query(packet(MAGIC, Cmd.ReadConfig, 0xa5, 0x0b, 0x2f, 0x01, 0x01));
    const blank = [r[13], r[14], r[15]].every((b) => b === 0x00) || [r[13], r[14], r[15]].every((b) => b === 0xff);
    const config: MouseConfig = blank ? cloneConfig(DEFAULT_CONFIG) : parseConfig(r);
    this.cachedConfig = config;
    return cloneConfig(config);
  }

  /** Grava o bloco de configuração inteiro (não existe escrita parcial no protocolo). */
  async writeConfig(config: MouseConfig): Promise<void> {
    const normalized = normalizeConfig(config, this.connectionMode);
    await this.command(encodeConfig(normalized));
    this.cachedConfig = normalized;
  }

  /** Read-modify-write sobre o último config conhecido. */
  async updateConfig(patch: Partial<MouseConfig>): Promise<MouseConfig> {
    const base = this.cachedConfig ?? (await this.readConfig());
    const next = { ...base, ...patch, dpi: patch.dpi ? [...patch.dpi] : [...base.dpi] };
    await this.writeConfig(next);
    return cloneConfig(this.cachedConfig ?? next);
  }

  async sendDPI(stages: { values?: number[]; activeIndex?: number; count?: number }): Promise<MouseConfig> {
    const patch: Partial<MouseConfig> = {};
    if (stages.values) patch.dpi = stages.values;
    if (stages.activeIndex !== undefined) patch.dpiIndex = stages.activeIndex;
    if (stages.count !== undefined) patch.dpiCount = stages.count;
    return this.updateConfig(patch);
  }

  async sendPollingRate(rate: PollingRate): Promise<MouseConfig> {
    const index = POLLING_RATES.indexOf(rate);
    if (index < 0) throw new MouseDriverError(`Polling rate inválido: ${rate}`);
    return this.updateConfig({ pollingRateIndex: index });
  }

  /**
   * O protocolo só aceita o modo de efeito: não há comando de cor, velocidade ou brilho.
   * Assim como o app original, o modo é aplicado com o comando 0x21 e só guardado no cache.
   */
  async sendRGBConfig(mode: LightMode): Promise<void> {
    if (mode < 0 || mode > 6) throw new MouseDriverError(`Modo de luz inválido: ${mode}`);
    await this.command(packet(MAGIC, Cmd.LightMode, 0x00, 0x00, 0x03, 0, 0, 0, 0, 0, mode));
    if (this.cachedConfig) this.cachedConfig.lightMode = mode;
  }

  // -- botões ---------------------------------------------------------------

  async readKeyMapping(): Promise<ButtonAction[]> {
    const r = await this.query(packet(MAGIC, Cmd.ReadKeys, 0xa5, 0x0b, 0x20));
    return Array.from({ length: BUTTON_COUNT }, (_, i) => {
      const o = 8 + 4 * i;
      const action = { type: r[o] ?? 0, code1: r[o + 1] ?? 0, code2: r[o + 2] ?? 0, code3: r[o + 3] ?? 0 };
      // 0x00 / 0xFF = posição não programada: o firmware usa o padrão.
      return action.type === 0x00 || action.type === 0xff ? { ...DEFAULT_BUTTONS[i]! } : action;
    });
  }

  async sendKeyMapping(actions: readonly ButtonAction[]): Promise<void> {
    if (actions.length !== BUTTON_COUNT) {
      throw new MouseDriverError(`São necessárias ${BUTTON_COUNT} ações de botão.`);
    }
    const p = packet(MAGIC, Cmd.WriteKeys, 0xa5, 0x22, 0x20);
    actions.forEach((a, i) => {
      p.set([a.type & 0xff, a.code1 & 0xff, a.code2 & 0xff, a.code3 & 0xff], 8 + 4 * i);
    });
    await this.command(p);
  }

  resetKeyMapping(): Promise<void> {
    return this.sendKeyMapping(DEFAULT_BUTTONS);
  }

  // -- macros ---------------------------------------------------------------

  /** Envia todas as macros (o firmware não tem escrita por macro). */
  async sendMacros(macros: readonly Macro[]): Promise<void> {
    const blob = encodeMacros(macros);
    for (let offset = 0; offset < blob.length; offset += MACRO_CHUNK) {
      const chunk = blob.subarray(offset, Math.min(offset + MACRO_CHUNK, blob.length));
      const p = packet(MAGIC, Cmd.MacroData, 0x00, 0x00, chunk.length, offset & 0xff, offset >> 8, 0x00);
      p.set(chunk, 8);
      await this.command(p);
    }
    await this.command(packet(MAGIC, Cmd.MacroCommit, 0xa5, 0x22, 0x00, 0x00, 0x00, 0x05));
  }

  // -- fábrica --------------------------------------------------------------

  async restoreFactorySettings(): Promise<MouseConfig> {
    await this.resetKeyMapping();
    await this.writeConfig(cloneConfig(DEFAULT_CONFIG));
    await this.sendRGBConfig(DEFAULT_CONFIG.lightMode);
    return cloneConfig(DEFAULT_CONFIG);
  }
}

// ---------------------------------------------------------------------------
// Codificação
// ---------------------------------------------------------------------------

/** Buffer apoiado em ArrayBuffer comum, como sendReport exige. */
type Bytes = Uint8Array<ArrayBuffer>;

function packet(...header: number[]): Bytes {
  const p = new Uint8Array(PAYLOAD_SIZE);
  p.set(header);
  return p;
}

function u16(r: Uint8Array, offset: number): number {
  return (r[offset] ?? 0) | ((r[offset + 1] ?? 0) << 8);
}

function parseConfig(r: Uint8Array): MouseConfig {
  const flags = r[55] ?? 0;
  return normalizeConfig(
    {
      lightMode: (r[9] ?? 0) as LightMode,
      pollingRateIndex: (r[10] ?? 4) - 1,
      dpiCount: r[11] ?? DEFAULT_CONFIG.dpiCount,
      dpiIndex: (r[12] ?? 1) - 1,
      dpi: Array.from({ length: DPI_STAGES }, (_, i) => u16(r, 13 + 2 * i)),
      scrollInverted: r[48] === 1,
      lod: r[49] === 2 ? 2 : 1,
      sensorFlags: r[50] ?? DEFAULT_CONFIG.sensorFlags,
      debounceMs: r[51] ?? DEFAULT_CONFIG.debounceMs,
      sleepMinutes: r[52] ?? DEFAULT_CONFIG.sleepMinutes,
      highspeedMode: r[53] ?? 0,
      // Leitura em r[55] com wakeup no nibble baixo; a escrita (encodeConfig) usa p[54] com
      // wakeup no nibble alto. É o que o app original faz; ver protocol_docs.md §3.4.
      wakeOnMove: (flags & 0x0f) === 1,
      disableLightOnMove: ((flags >> 4) & 0x0f) === 1,
    },
    null,
  );
}

function encodeConfig(c: MouseConfig): Bytes {
  const p = packet(MAGIC, Cmd.WriteConfig, 0xae, 0x0a, 0x2f, 0x01, 0x01, 0x00, 0x00);
  p[9] = c.lightMode;
  p[10] = c.pollingRateIndex + 1;
  p[11] = c.dpiCount;
  p[12] = c.dpiIndex + 1;
  c.dpi.forEach((value, i) => {
    p[13 + 2 * i] = value & 0xff;
    p[14 + 2 * i] = value >> 8;
  });
  p[48] = c.scrollInverted ? 1 : 0;
  p[49] = c.lod;
  p[50] = c.sensorFlags & 0xff;
  p[51] = c.debounceMs & 0xff;
  p[52] = c.sleepMinutes & 0xff;
  p[53] = c.highspeedMode & 0xff;
  p[54] = ((c.wakeOnMove ? 1 : 0) << 4) | (c.disableLightOnMove ? 1 : 0);
  return p;
}

function normalizeConfig(c: MouseConfig, mode: ConnectionMode | null): MouseConfig {
  const dpi = Array.from({ length: DPI_STAGES }, (_, i) => {
    const v = c.dpi[i] ?? DEFAULT_CONFIG.dpi[i]!;
    return clamp(Math.round(v / DPI_STEP) * DPI_STEP, DPI_MIN, DPI_MAX);
  });
  const dpiCount = clamp(c.dpiCount, 1, DPI_STAGES);
  return {
    ...c,
    lightMode: clamp(c.lightMode, 0, 6) as LightMode,
    // No cabo o firmware só trabalha a 1000 Hz (o app original força o índice 3).
    pollingRateIndex: mode === 'USB' ? 3 : clamp(c.pollingRateIndex, 0, POLLING_RATES.length - 1),
    dpi,
    dpiCount,
    dpiIndex: clamp(c.dpiIndex, 0, dpiCount - 1),
    debounceMs: clamp(c.debounceMs, 0, 255),
    sleepMinutes: clamp(c.sleepMinutes, 1, 255),
  };
}

export function encodeMacros(macros: readonly Macro[]): Bytes {
  if (macros.length > MACRO_MAX_COUNT) {
    throw new MouseDriverError(`Máximo de ${MACRO_MAX_COUNT} macros.`);
  }
  const eventBytes = macros.reduce((n, m) => n + 4 * m.events.length, 0);
  const size = MACRO_TABLE_SIZE + eventBytes;
  if (size > MACRO_MAX_BYTES) {
    throw new MouseDriverError(`As macros excedem a memória do mouse (${size}/${MACRO_MAX_BYTES} bytes).`);
  }

  const blob = new Uint8Array(size);
  let offset = MACRO_TABLE_SIZE;
  macros.forEach((macro, index) => {
    if (macro.events.length === 0) return;
    blob[2 * index] = offset & 0xff;
    blob[2 * index + 1] = offset >> 8;
    macro.events.forEach((ev, i) => {
      let flags = ev.kind === 'mouse' ? 0x03 : 0x02;
      if (ev.pressed) flags |= 0x40;
      if (i === macro.events.length - 1) flags |= 0x80;
      const delay = clamp(Math.round(ev.delayMs), 0, 0xffff);
      blob.set([delay & 0xff, delay >> 8, flags, ev.code & 0xff], offset + 4 * i);
    });
    offset += 4 * macro.events.length;
  });
  return blob;
}

/** Bytes que as macros ocupam na memória do mouse. */
export function macroBytes(macros: readonly Macro[]): number {
  return MACRO_TABLE_SIZE + macros.reduce((n, m) => n + 4 * m.events.length, 0);
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function pickVendorInterface(devices: readonly HIDDevice[]): HIDDevice | undefined {
  return devices.find(
    (d) =>
      d.productId === PRODUCT_ID &&
      (d.vendorId === VENDOR_ID_USB || d.vendorId === VENDOR_ID_DONGLE) &&
      d.collections.some((c) => c.usagePage === USAGE_PAGE && c.usage === USAGE),
  );
}

function assertSupported(): void {
  if (!MouseDriver.isSupported()) {
    throw new MouseDriverError('Este navegador não suporta WebHID. Use Chrome ou Edge no computador.');
  }
  if (!window.isSecureContext) {
    throw new MouseDriverError('WebHID só funciona em HTTPS ou em http://localhost.');
  }
}

function cloneConfig(c: Readonly<MouseConfig>): MouseConfig {
  return { ...c, dpi: [...c.dpi] };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}
