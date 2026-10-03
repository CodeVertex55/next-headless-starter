import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { ContentError } from "@/content/errors";

// Server-only on purpose: this module reads the WordPress application password. It has no
// "use client" directive and is only reached through the dynamic import in src/content/source.ts.

export type WpClientOptions = { url: string; appUser?: string; appPassword?: string };

export type RequestOptions = {
  /** Next.js cache tags for the response. Ignored for authenticated (preview) requests. */
  tags: string[];
  /** Send the application password and bypass every cache. Used for draft previews only. */
  auth?: boolean;
};

/** Template tag for GraphQL documents. It only concatenates; it exists so editors highlight them. */
export function gql(strings: TemplateStringsArray, ...values: unknown[]) {
  return strings.reduce((acc, s, i) => acc + s + String(values[i] ?? ""), "");
}

export type WpRequest = <T>(
  query: string,
  variables: Record<string, unknown>,
  options: RequestOptions,
) => Promise<T>;

function errorMessage(e: unknown): string {
  const message = (e as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : "Unknown GraphQL error";
}

export function createClient(opts: WpClientOptions): WpRequest {
  async function send(
    query: string,
    variables: Record<string, unknown>,
    { tags, auth = false }: RequestOptions,
  ): Promise<unknown> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (auth) {
      if (!opts.appUser || !opts.appPassword) {
        throw new ContentError(
          "config",
          "WP_APP_USER and WP_APP_PASSWORD are required for preview",
        );
      }
      headers.authorization =
        "Basic " + Buffer.from(`${opts.appUser}:${opts.appPassword}`).toString("base64");
    }
    let res: Response;
    try {
      res = await fetch(opts.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
        // Next.js 16 does not cache fetch by default. A numeric revalidate opts the request in, and
        // the tags let the revalidate webhook purge it. Drafts must never be cached.
        ...(auth ? { cache: "no-store" as const } : { next: { revalidate: 3600, tags } }),
      });
    } catch (e) {
      // Next.js signals dynamic rendering and similar control flow by throwing from fetch.
      unstable_rethrow(e);
      throw new ContentError("network", `WPGraphQL request failed: ${(e as Error).message}`, e);
    }
    if (!res.ok) {
      // Current WPGraphQL answers validation errors (such as an unknown field) with HTTP 500 and a
      // GraphQL body. Those are GraphQL errors, not outages, and callers rely on telling them apart.
      const errors = await res
        .json()
        .then((b: unknown) => (b as { errors?: unknown } | null)?.errors)
        .catch(() => undefined);
      if (Array.isArray(errors) && errors.length) {
        throw new ContentError("graphql", errors.map((e) => errorMessage(e)).join("; "));
      }
      throw new ContentError("network", `WPGraphQL responded ${res.status}`);
    }
    let json: { data?: unknown; errors?: { message: string }[] };
    try {
      json = (await res.json()) as typeof json;
    } catch (e) {
      unstable_rethrow(e);
      throw new ContentError("network", "WPGraphQL response was not valid JSON", e);
    }
    if (json.errors?.length) {
      throw new ContentError("graphql", json.errors.map((e) => e.message).join("; "));
    }
    if (!json.data) throw new ContentError("graphql", "WPGraphQL returned no data");
    return json.data;
  }

  // Next.js only memoises GET fetches within a render, and these are POSTs, so generateMetadata and
  // the page component would each hit WordPress. React.cache dedupes per server render instead. It
  // compares arguments by identity, so the key is made of strings. Outside a render it is a pass
  // through. Auth requests skip it: drafts must never be shared between callers.
  const deduped = cache((query: string, variablesKey: string, tagsKey: string) =>
    send(query, JSON.parse(variablesKey) as Record<string, unknown>, {
      tags: JSON.parse(tagsKey) as string[],
    }),
  );

  return async function request<T>(
    query: string,
    variables: Record<string, unknown>,
    options: RequestOptions,
  ): Promise<T> {
    if (options.auth) return (await send(query, variables, options)) as T;
    return (await deduped(query, JSON.stringify(variables), JSON.stringify(options.tags))) as T;
  };
}
