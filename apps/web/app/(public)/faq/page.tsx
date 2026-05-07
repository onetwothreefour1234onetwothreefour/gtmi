import type { Metadata } from 'next';
import { loadContent } from '@/lib/content';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Frequently asked questions about the Global Talent Mobility Index — score interpretation, calibration, missing data, and citation guidance.',
};

export const revalidate = 86400;

export default async function FaqPage() {
  const html = await loadContent('faq.md');

  return (
    <article className="mx-auto max-w-page px-6 py-12">
      <header className="mb-10">
        <p className="text-data-sm uppercase tracking-widest text-muted-foreground">FAQ</p>
        <h1 className="mt-2 font-serif text-display-lg text-ink">Frequently asked questions</h1>
      </header>
      {html ? (
        <div
          className="prose prose-neutral max-w-prose text-foreground"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-data-md italic text-muted-foreground">Content forthcoming.</p>
      )}
    </article>
  );
}
