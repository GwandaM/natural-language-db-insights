interface RankedListItem {
  label: string;
  value: number;
  sub?: string;
}

interface RankedListProps {
  title: string;
  caption: string;
  items: RankedListItem[];
  valueLabel?: string;
}

export function RankedList({ title, caption, items, valueLabel = "companies" }: RankedListProps) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{caption}</p>
      </div>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-4 text-right shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm text-foreground truncate" title={item.label}>
                  {item.label}
                </span>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">
                  {item.value} {valueLabel}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </div>
              {item.sub && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
