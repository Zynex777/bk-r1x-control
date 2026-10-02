export type MouseZone = 'left' | 'right' | 'middle' | 'wheelUp' | 'wheelDown' | 'dpi' | 'forward' | 'back';

/** Ordem dos botões no firmware (BUTTON_NAMES). */
export const BUTTON_ZONES: MouseZone[] = ['left', 'right', 'middle', 'back', 'forward', 'dpi', 'wheelUp', 'wheelDown'];

const BADGE_POS: Record<MouseZone, [number, number]> = {
  left: [62, 108],
  right: [158, 108],
  middle: [138, 69],
  wheelUp: [82, 46],
  wheelDown: [82, 90],
  dpi: [138, 120],
  forward: [14, 169],
  back: [14, 213],
};

interface MouseDiagramProps {
  /** Zonas clicáveis; as demais aparecem apagadas. */
  zones: readonly MouseZone[];
  selected?: MouseZone | null;
  onSelect: (zone: MouseZone) => void;
  /** Texto do marcador de cada zona (ex.: número do botão). */
  badges?: Partial<Record<MouseZone, string>>;
  /** Zonas com um destaque extra (ex.: botão controlado por ciclo de macro). */
  marked?: ReadonlySet<MouseZone>;
  disabled?: boolean;
  className?: string;
}

export function MouseDiagram({ zones, selected, onSelect, badges, marked, disabled, className }: MouseDiagramProps) {
  const enabled = new Set(zones);
  const zone = (z: MouseZone) => ({
    onClick: () => !disabled && enabled.has(z) && onSelect(z),
    role: enabled.has(z) ? 'button' : undefined,
    'aria-label': z,
    strokeWidth: 1.5,
    className: !enabled.has(z)
      ? 'fill-white/[0.015] stroke-line'
      : `transition-all ${disabled ? '' : 'cursor-pointer'} ${
          selected === z
            ? 'fill-accent/40 stroke-accent-bright'
            : marked?.has(z)
              ? 'fill-blood/25 stroke-blood hover:fill-blood/35'
              : 'fill-accent/[0.06] stroke-line-strong hover:fill-accent/20 hover:stroke-accent'
        }`,
  });

  return (
    <svg viewBox="0 0 220 340" className={className ?? 'mx-auto w-full max-w-[280px]'}>
      <defs>
        <linearGradient id="md-shell" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-panel-2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-void)' }} />
        </linearGradient>
        <filter id="md-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <path d="M110 12c-52 0-74 40-74 104v104c0 62 30 108 74 108s74-46 74-108V116c0-64-22-104-74-104z" className="fill-accent/20" filter="url(#md-glow)" />
      <path d="M110 12c-52 0-74 40-74 104v104c0 62 30 108 74 108s74-46 74-108V116c0-64-22-104-74-104z" fill="url(#md-shell)" className="stroke-line-strong" strokeWidth="2" />
      {/* filigrana */}
      <path d="M110 200l10 18-10 18-10-18z M88 300c8 8 36 8 44 0" className="fill-none stroke-accent/30" strokeWidth="1.2" />

      <path {...zone('left')} d="M106 16c-46 2-66 40-66 98v18h66z" />
      <path {...zone('right')} d="M114 16c46 2 66 40 66 98v18h-66z" />

      <rect x="99" y="40" width="22" height="58" rx="11" className="fill-void stroke-line" strokeWidth="1.5" />
      <path {...zone('wheelUp')} d="M101 58v-6a9 9 0 0 1 18 0v6z" />
      <rect {...zone('middle')} x="101" y="60" width="18" height="18" rx="3" />
      <path {...zone('wheelDown')} d="M101 80h18v6a9 9 0 0 1-18 0z" />

      <rect {...zone('dpi')} x="101" y="108" width="18" height="24" rx="5" />

      <rect {...zone('forward')} x="30" y="150" width="14" height="38" rx="5" />
      <rect {...zone('back')} x="30" y="194" width="14" height="38" rx="5" />

      {Object.entries(badges ?? {}).map(([z, text]) => {
        const [x, y] = BADGE_POS[z as MouseZone];
        const active = selected === z;
        return (
          <g key={z} pointerEvents="none">
            <rect x={x - 8} y={y - 8} width="16" height="16" rx="3" transform={`rotate(45 ${x} ${y})`} className={active ? 'fill-accent' : 'fill-panel-2 stroke-line-strong'} />
            <text x={x} y={y + 3.5} textAnchor="middle" className={`text-[10px] font-bold ${active ? 'fill-white' : 'fill-ink'}`}>
              {text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
