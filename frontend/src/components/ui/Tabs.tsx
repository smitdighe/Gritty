import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  /** Controlled active id. */
  value?: string;
  /** Uncontrolled initial id (defaults to first item). */
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  className?: string;
}

/**
 * Minimal accessible tabs. Controlled if `value` is provided, otherwise
 * manages its own state. No motion.
 */
export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  className,
}: TabsProps) {
  const baseId = useId();
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.id);
  const active = value ?? internal;

  const select = (id: string) => {
    if (value === undefined) setInternal(id);
    onValueChange?.(id);
  };

  const activeItem = items.find((i) => i.id === active);

  return (
    <div className={cn('flex flex-col', className)}>
      <div role="tablist" className="flex items-center gap-1 border-b border-border">
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              disabled={item.disabled}
              onClick={() => select(item.id)}
              className={cn(
                'font-sans -mb-px border-b-2 px-3 py-1.5 text-sm transition-colors',
                'outline-none focus-visible:ring-2 focus-visible:ring-accent',
                'disabled:cursor-not-allowed disabled:opacity-40',
                selected
                  ? 'border-accent text-fg'
                  : 'border-transparent text-fg-muted hover:text-fg',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${active}`}
        aria-labelledby={`${baseId}-tab-${active}`}
        className="pt-3"
      >
        {activeItem?.content}
      </div>
    </div>
  );
}
