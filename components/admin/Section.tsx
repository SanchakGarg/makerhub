import type { LucideIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Titled card that groups related fields on the full-page printer forms. */
export function Section({
  icon: Icon,
  title,
  description,
  tone = 'default',
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: 'default' | 'destructive';
  children: React.ReactNode;
}) {
  const destructive = tone === 'destructive';
  return (
    <section
      className={cn(
        'rounded-xl bg-card ring-1',
        destructive ? 'ring-destructive/30' : 'ring-foreground/10'
      )}
    >
      <div className="flex items-start gap-3 px-5 pt-5">
        <span
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            destructive ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className={cn('font-heading text-sm font-semibold', destructive && 'text-destructive')}>
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="space-y-4 px-5 pt-4 pb-5">{children}</div>
    </section>
  );
}

/** Label + control + hint, so every field on the page lines up identically. */
export function Field({
  id,
  label,
  hint,
  required,
  className,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}
