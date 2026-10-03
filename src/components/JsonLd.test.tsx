import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { JsonLd } from "./JsonLd";

describe("JsonLd", () => {
  it("escapes < so data cannot close the script tag", () => {
    const { container } = render(<JsonLd data={{ x: "</script>" }} />);
    const html = container.querySelector("script")?.innerHTML ?? "";
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c/script>");
    expect(JSON.parse(html)).toEqual({ x: "</script>" });
  });
});
