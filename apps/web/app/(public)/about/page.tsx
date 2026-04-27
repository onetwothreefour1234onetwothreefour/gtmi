import type { Metadata } from 'next';
import { loadContent } from '@/lib/content';

export const metadata: Metadata = {
  title: 'About',
  description:
    'About the Global Talent Mobility Index — TTR Group attribution, data sources, citation guidance, and contact.',
};

export const revalidate = 86400;

export default async function AboutPage() {
  const html = await loadContent('about.md');

  return (
    <article className="mx-auto max-w-page px-6 py-12">
      <header className="mb-10">
        <p className="text-data-sm uppercase tracking-widest text-muted-foreground">About</p>
        <h1 className="mt-2 font-serif text-display-lg text-ink">
          About the Global Talent Mobility Index
        </h1>
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
