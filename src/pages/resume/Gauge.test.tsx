import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Gauge } from "./Gauge";

const CIRCUMFERENCE = Math.PI * 40;

const progressOffset = (container: HTMLElement) =>
  Number(container.querySelectorAll("path")[1].style.strokeDashoffset);

describe("Gauge", () => {
  it("shows the value as a percentage", () => {
    render(<Gauge value={82} />);
    expect(screen.getByText("82%")).toBeInTheDocument();
  });

  it.each([
    [0, CIRCUMFERENCE],
    [50, CIRCUMFERENCE / 2],
    [100, 0],
  ])("fills the arc for %i%%", (value, offset) => {
    const { container } = render(<Gauge value={value} />);
    expect(progressOffset(container)).toBeCloseTo(offset);
  });

  it.each([
    [150, "100%"],
    [-10, "0%"],
  ])("clamps %i to %s", (value, label) => {
    render(<Gauge value={value} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("uses the size prop as its width", () => {
    const { container } = render(<Gauge value={10} size={120} />);
    expect(container.firstElementChild).toHaveStyle({ width: "120px" });
  });
});
