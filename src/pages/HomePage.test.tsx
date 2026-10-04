import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./HomePage";

describe("HomePage", () => {
  it("shows the statistics placeholder", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Statistics are coming soon.")).toBeInTheDocument();
  });
});
