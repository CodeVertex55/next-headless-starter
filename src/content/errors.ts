export type ContentErrorCode = "network" | "graphql" | "not_found" | "config";
export class ContentError extends Error {
  constructor(
    public code: ContentErrorCode,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "ContentError";
  }
}
