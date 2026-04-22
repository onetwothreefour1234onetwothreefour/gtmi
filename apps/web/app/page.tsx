import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-24">
      <h1 className="text-4xl font-bold">GTMI</h1>
      <nav className="flex gap-4">
        <Link href="/review" className="text-blue-600 hover:underline">
          Review Queue
        </Link>
      </nav>
    </main>
  );
}
