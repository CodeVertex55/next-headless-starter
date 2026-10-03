import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  basePath,
}: {
  page: number;
  totalPages: number;
  basePath: string;
}) {
  if (totalPages <= 1) return null;
  const href = (n: number) => (n === 1 ? basePath : `${basePath}/page/${n}`);
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-between text-sm">
      {page > 1 ? <Link href={href(page - 1)}>Previous</Link> : <span />}
      <span>
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? <Link href={href(page + 1)}>Next</Link> : <span />}
    </nav>
  );
}
