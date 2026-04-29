import { InternalBadge } from '@/components/gtmi';

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <InternalBadge />
      <div
        className="flex items-center justify-between border-b px-8 py-2 text-data-sm"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper-2)' }}
      >
        <span className="num text-ink-3" style={{ fontSize: 12 }}>
          GTMI · Editorial review
        </span>
      </div>
      {children}
    </div>
  );
}
