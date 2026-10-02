export type ThemeId = 'gothic' | 'dark' | 'light' | 'aero' | 'jump';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  description: string;
  /** Cores da prévia: fundo, painel, destaque, texto. */
  swatch: [string, string, string, string];
}

export const THEMES: ThemeInfo[] = [
  { id: 'gothic', name: 'Roxo Gótico', description: 'Preto, roxo e detalhes ornamentados.', swatch: ['#07050b', '#1a1224', '#a259ff', '#ece4f7'] },
  { id: 'dark', name: 'Escuro', description: 'Escuro neutro e limpo, destaque azul.', swatch: ['#0b0d10', '#1b1f26', '#4f8cff', '#e8eaee'] },
  { id: 'light', name: 'Claro', description: 'Fundo claro para ambientes iluminados.', swatch: ['#eef0f5', '#ffffff', '#6d28d9', '#151922'] },
  { id: 'aero', name: 'Frutiger Aero', description: 'Céu, vidro, bolhas e botões de gel.', swatch: ['#2fa8e6', '#f4fbff', '#00a2e8', '#06324f'] },
  { id: 'jump', name: 'Jumpstyle', description: 'Neon ciano e magenta, clima de pista.', swatch: ['#030306', '#13131f', '#00f0ff', '#ff2bd6'] },
];

const KEY = 'bkr1x.theme';

export function loadTheme(): ThemeId {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return THEMES.some((t) => t.id === raw) ? (raw as ThemeId) : 'gothic';
  } catch {
    return 'gothic';
  }
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(KEY, JSON.stringify(id));
  } catch {
    // Sem armazenamento: o tema vale só nesta sessão.
  }
}
