import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-24 text-center">
      <p className="text-sm opacity-70">404</p>
      <h1 className="mt-2 mb-4 text-4xl font-semibold">Page not found</h1>
      <p className="mb-8">The page you are looking for does not exist or has moved.</p>
      <Link href="/" className="underline">
        Back to the home page
      </Link>
    </main>
  );
}
