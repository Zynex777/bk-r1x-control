import type { ReactNode } from 'react';

export function Panel({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="gothic-panel rounded-lg">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="gothic-title text-sm font-bold text-accent-bright uppercase">{title}</h2>
          {subtitle && <p className="mt-1 text-xs leading-relaxed text-muted">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Cabeçalho de cada seção da página, com título e explicação curta. */
export function PageIntro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="gothic-title text-2xl font-bold text-ink">{title}</h1>
      <Divider />
      <p className="max-w-3xl text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

export function Divider() {
  return (
    <div className="my-3 flex items-center gap-3 text-line-strong" aria-hidden>
      <span className="h-px w-10 bg-gradient-to-r from-transparent to-line-strong" />
      <svg viewBox="0 0 24 12" className="h-3 w-6 fill-accent/70">
        <path d="M12 0 15 6 12 12 9 6Z" />
        <circle cx="3" cy="6" r="1.5" />
        <circle cx="21" cy="6" r="1.5" />
      </svg>
      <span className="h-px w-24 bg-gradient-to-r from-line-strong to-transparent" />
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, disabled }: {
  options: { label: ReactNode; value: T; disabled?: boolean; title?: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-md border border-line bg-void/70 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            title={o.title}
            disabled={disabled || o.disabled}
            onClick={() => onChange(o.value)}
            className={`rounded px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${
              active
                ? 'bg-gradient-to-b from-accent to-accent-deep text-on-accent shadow-[0_0_18px_-4px_var(--glow)]'
                : 'text-muted hover:bg-panel-2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-40' : ''}`}>
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition ${
          checked ? 'border-accent bg-accent-deep shadow-[0_0_12px_-2px_var(--color-accent)]' : 'border-line bg-void'
        }`}
      >
        <span
          className={`absolute top-[3px] left-[3px] h-4 w-4 rotate-45 rounded-[3px] transition ${
            checked ? 'translate-x-5 bg-accent-bright' : 'bg-muted'
          }`}
        />
      </button>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-xs leading-relaxed text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export function Button({ children, onClick, variant = 'ghost', size = 'md', disabled, title, type = 'button' }: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md';
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary:
      'btn-primary border border-accent/60 bg-gradient-to-b from-accent to-accent-deep text-on-accent hover:brightness-115 shadow-[0_0_22px_-8px_var(--glow)]',
    ghost: 'border border-line-strong text-ink hover:border-accent/60 hover:bg-panel-2',
    subtle: 'text-muted hover:bg-panel-2 hover:text-ink',
    danger: 'border border-blood/60 text-danger hover:bg-blood/15',
  }[variant];
  const sizes = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${styles} ${sizes}`}
    >
      {children}
    </button>
  );
}

export function Chip({ active, children, onClick, disabled, title }: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-35 ${
        active ? 'border-accent bg-accent/15 text-accent-bright' : 'border-line text-ink hover:border-line-strong hover:bg-panel-2'
      }`}
    >
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded border border-line-strong border-b-2 bg-panel-2 px-1.5 py-0.5 font-mono text-xs text-ink">
      {children}
    </kbd>
  );
}

export const inputClass =
  'w-full rounded-md border border-line bg-void/80 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_18%,transparent)] disabled:opacity-40';
export const selectClass = inputClass;
