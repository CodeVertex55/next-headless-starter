export function PreviewBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-4 bg-black px-4 py-2 text-sm text-white">
      <span>Preview mode</span>
      {/* A plain anchor: the exit route is a handler that redirects, not a page. The
          catch-all page route makes the Next lint rule mistake it for a page. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/api/preview/exit" className="underline">
        Exit preview
      </a>
    </div>
  );
}
