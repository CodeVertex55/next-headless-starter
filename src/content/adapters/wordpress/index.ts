import { ContentError } from "@/content/errors";
import type { ContentSource } from "@/content/source";
import type { getEnv } from "@/lib/env";

export function createWordPressSource(env: ReturnType<typeof getEnv>): ContentSource {
  void env;
  throw new ContentError("config", "WordPress adapter is not implemented yet; see Task 9");
}
