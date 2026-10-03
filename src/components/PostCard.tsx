import Image from "next/image";
import Link from "next/link";
import type { PostSummary } from "@/content/types";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function PostCard({ post }: { post: PostSummary }) {
  const img = post.featuredImage;
  return (
    <article className="flex flex-col gap-3">
      {img && (
        <Image
          src={img.src}
          alt={img.alt}
          width={img.width}
          height={img.height}
          sizes="(max-width: 768px) 100vw, 50vw"
          className="h-auto w-full"
        />
      )}
      <h2 className="text-xl font-semibold">
        <Link href={post.path} className="hover:underline">
          {post.title}
        </Link>
      </h2>
      <time dateTime={post.publishedAt} className="text-sm opacity-70">
        {dateFormat.format(new Date(post.publishedAt))}
      </time>
      <p>{post.excerpt}</p>
    </article>
  );
}
