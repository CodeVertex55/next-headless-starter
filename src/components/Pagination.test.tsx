import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("renders nothing for one page", () => {
    const { container } = render(<Pagination page={1} totalPages={1} basePath="/blog" />);
    expect(container).toBeEmptyDOMElement();
  });
  it("links previous and next with /blog and /blog/page/n", () => {
    render(<Pagination page={2} totalPages={3} basePath="/blog" />);
    expect(screen.getByRole("link", { name: /previous/i })).toHaveAttribute("href", "/blog");
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute("href", "/blog/page/3");
  });
});
