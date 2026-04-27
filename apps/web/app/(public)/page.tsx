import Link from 'next/link';

/**
 * Phase 4.1 placeholder landing. The real Ranked Index Table ships in 4.2.
 * Kept deliberately bare so the layout shell, fonts, and color tokens are
 * the only visible deliverables of this commit.
 */
export default function LandingPage() {
  return (
    <section className="mx-auto max-w-editorial px-6 py-24">
      <p className="text-data-sm uppercase tracking-widest text-muted-foreground">
        Preview release
      </p>
      <h1 className="mt-2 font-serif text-display-xl text-ink">Global Talent Mobility Index</h1>
      <p className="mt-6 text-dek text-muted-foreground">
        GTMI ranks 85 talent-based mobility programs across the world&rsquo;s 30 most appealing
        economies, using a methodology where every weight is published and every data point traces
        to its government source.
      </p>
      <p className="mt-8 text-data-sm text-muted-foreground">
        Phase 4.1: theme tokens and layout shell. The ranked index, methodology page, and program
        detail surfaces ship in subsequent phases. Internal reviewers can access the queue at{' '}
        <Link href="/review" className="text-accent underline-offset-4 hover:underline">
          /review
        </Link>
        .
      </p>
    </section>
  );
}
