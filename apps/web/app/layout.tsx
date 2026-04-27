import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { SITE_URL } from '@/lib/site-url';
import './globals.css';

const fontSerif = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  axes: ['opsz'],
});

const fontSans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'GTMI — Global Talent Mobility Index',
    template: '%s · GTMI',
  },
  description:
    'GTMI ranks 85 talent-based mobility programs across the 30 most appealing economies in the world. Every weight is published, every value traces to a government source.',
  applicationName: 'GTMI',
  authors: [{ name: 'TTR Group' }],
  creator: 'TTR Group',
  publisher: 'TTR Group',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Global Talent Mobility Index',
    url: SITE_URL,
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSerif.variable} ${fontSans.variable} ${fontMono.variable}`}
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
