import { loadPosts } from "@/app/_lib/loaders";
import { Pagination } from "@/components/Pagination";
import { PostCard } from "@/components/PostCard";

export async function PostList({ page }: { page: number }) {
  const { items, totalPages } = await loadPosts(page);
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-8 text-4xl font-semibold">Blog</h1>
      <div className="grid gap-10 md:grid-cols-2">
        {items.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} basePath="/blog" />
    </main>
  );
}
