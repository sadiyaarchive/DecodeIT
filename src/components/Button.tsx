import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ink' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /**
   * Looks unavailable and says why, but stays focusable and clickable so the click can point at
   * what is missing. (A plain `disabled` button cannot be focused or explain itself.)
   */
  unavailable?: boolean;
  loading?: boolean;
  icon?: boolean;
}

const CLASS: Record<Variant, string> = {
  primary: 'btn btn-primary',
  secondary: 'btn',
  ink: 'btn btn-primary',
  ghost: 'btn btn-ghost',
};

export function Button({ variant = 'secondary', unavailable = false, loading = false, icon = false, className = '', onClick, children, ...rest }: Props) {
  const blocked = unavailable || loading;
  return (
    <button
      type="button"
      {...rest}
      className={`${CLASS[variant]}${icon ? ' btn-icon' : ''} ${className}`.trim()}
      aria-disabled={blocked || undefined}
      data-loading={loading || undefined}
      onClick={(e) => {
        if (loading) return;
        onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}
