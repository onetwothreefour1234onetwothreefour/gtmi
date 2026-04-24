export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm text-center">
        <h1 className="mb-2 text-xl font-bold text-gray-900">Check your email</h1>
        <p className="text-sm text-gray-600">
          We sent a sign-in link to{' '}
          <span className="font-medium text-gray-900">{email ?? 'your email'}</span>.
          <br />
          Click the link in the email to continue.
        </p>
      </div>
    </main>
  );
}
