import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./html";

describe("sanitizeHtml", () => {
  it("strips scripts and event handlers", () => {
    const out = sanitizeHtml(`<p onclick="x()">hi</p><script>alert(1)</script>`);
    expect(out).toBe("<p>hi</p>");
  });
  it("keeps WordPress block markup", () => {
    const input = `<figure class="wp-block-image"><img src="/a.jpg" alt="A" width="10" height="5"></figure><blockquote><p>q</p></blockquote><table><tr><td>1</td></tr></table>`;
    const out = sanitizeHtml(input);
    expect(out).toContain('<figure class="wp-block-image">');
    expect(out).toContain("<blockquote><p>q</p></blockquote>");
    expect(out).toContain("<table>");
  });
  it("forces lazy loading on images", () => {
    expect(sanitizeHtml(`<img src="/a.jpg" alt="">`)).toContain('loading="lazy"');
  });
  it("allows iframes only from embed hosts", () => {
    expect(sanitizeHtml(`<iframe src="https://www.youtube.com/embed/x"></iframe>`)).toContain(
      "<iframe",
    );
    expect(sanitizeHtml(`<iframe src="https://evil.example/x"></iframe>`)).not.toContain("<iframe");
  });
  it("drops javascript: links", () => {
    expect(sanitizeHtml(`<a href="javascript:alert(1)">x</a>`)).toBe("<a>x</a>");
  });
});
