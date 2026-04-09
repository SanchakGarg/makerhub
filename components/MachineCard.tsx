import { Machine } from '@/lib/machines';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function MachineCard({ machine, onClick }: { machine: Machine; onClick: () => void }) {
  return (
    <Card
      onClick={onClick}
      className="relative bg-card border-border cursor-pointer hover:border-muted-foreground/40 transition-colors overflow-hidden group"
    >
      {/* Accent strip top-right corner */}
      <div
        className="absolute top-0 right-0 w-24 h-1"
        style={{ backgroundColor: machine.accent }}
      />
      {/* Corner glow */}
      <div
        className="absolute top-0 right-0 w-32 h-32 opacity-10 group-hover:opacity-20 transition-opacity rounded-bl-full"
        style={{ backgroundColor: machine.accent }}
      />

      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {machine.name}
              </h2>
              <span
                className="text-xs font-mono px-2 py-0.5 rounded-full border"
                style={{ color: machine.accent, borderColor: machine.accent + '55' }}
              >
                {machine.extruder}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{machine.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {machine.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs text-muted-foreground">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground shrink-0">
            <div className="font-mono">{machine.nozzle}</div>
            <div className="text-xs mt-1">{machine.model}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
