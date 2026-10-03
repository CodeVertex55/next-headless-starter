import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Nav } from "./Nav";

describe("Nav", () => {
  it("renders items and nested children", () => {
    render(
      <Nav
        siteName="S"
        items={[
          {
            label: "About",
            href: "/about",
            external: false,
            children: [{ label: "Team", href: "/about/team", external: false, children: [] }],
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute("href", "/about/team");
  });
  it("marks external links", () => {
    render(
      <Nav
        siteName="S"
        items={[{ label: "GH", href: "https://x.y", external: true, children: [] }]}
      />,
    );
    expect(screen.getByRole("link", { name: "GH" })).toHaveAttribute("rel", "noopener noreferrer");
  });
});
