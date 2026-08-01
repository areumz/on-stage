export default function NowTicker({ items }: { items: string[] }) {
  const row = (key: string) => (
    <div key={key} className="flex shrink-0 items-center gap-12 pr-12">
      {items.map((text, i) => (
        <span key={i} className="whitespace-nowrap text-sm text-white/70">{text}</span>
      ))}
    </div>
  );
  return (
    <div className="flex items-center gap-6 border-t border-white/10 px-8 py-4">
      <span className="shrink-0 text-sm font-semibold text-brand">● NOW</span>
      <div className="flex overflow-hidden">
        <div className="animate-ticker flex">{row("a")}{row("b")}</div>
      </div>
    </div>
  );
}
