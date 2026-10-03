import sanitize from "sanitize-html";

const EMBED_HOSTS = ["www.youtube.com", "youtube.com", "player.vimeo.com", "open.spotify.com"];

const options: sanitize.IOptions = {
  allowedTags: [
    ...sanitize.defaults.allowedTags,
    "img",
    "figure",
    "figcaption",
    "iframe",
    "video",
    "source",
    "audio",
    "picture",
    "h1",
    "h2",
  ],
  allowedAttributes: {
    "*": ["class", "id"],
    a: ["href", "name", "target", "rel", "title"],
    img: ["src", "srcset", "sizes", "alt", "width", "height", "loading", "decoding"],
    iframe: ["src", "width", "height", "allow", "allowfullscreen", "title", "loading"],
    video: [
      "src",
      "poster",
      "controls",
      "autoplay",
      "muted",
      "loop",
      "playsinline",
      "width",
      "height",
    ],
    source: ["src", "type", "srcset", "media"],
    audio: ["src", "controls"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan", "scope"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedIframeHostnames: EMBED_HOSTS,
  // sanitize-html drops a disallowed iframe src but keeps the empty tag; remove it entirely.
  exclusiveFilter: (frame) => frame.tag === "iframe" && !frame.attribs.src,
  transformTags: {
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: "lazy", decoding: "async" },
    }),
    a: (tagName, attribs) => {
      const external = /^https?:\/\//.test(attribs.href ?? "");
      return { tagName, attribs: external ? { ...attribs, rel: "noopener noreferrer" } : attribs };
    },
  },
};

export function sanitizeHtml(html: string): string {
  return sanitize(html, options);
}
