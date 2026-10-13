import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeSupabase, renderWithRouter, TEST_USER } from "../test/utils";
import HomePage from "./HomePage";

describe("HomePage", () => {
  it("shows active applications and the response rate", async () => {
    fakeSupabase.seed("applications", [
      { id: "a1", user_id: TEST_USER.id, company: "Acme", title: "Dev", status: "interview" },
      { id: "a2", user_id: TEST_USER.id, company: "Globex", title: "Dev", status: "applied" },
      { id: "a3", user_id: TEST_USER.id, company: "Initech", title: "Dev", status: "rejected" },
    ]);
    fakeSupabase.seed("response_stats", [
      { id: "r", applied: 3, responded: 2, response_rate: 0.667, median_days_to_response: 4 },
    ]);
    renderWithRouter(<HomePage />);

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(await screen.findByText("2")).toBeInTheDocument();
    expect(screen.getByText("Active applications")).toBeInTheDocument();
    expect(await screen.findByText("67%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Applications" })).toHaveAttribute("href", "/applications");
  });

  it("shows load errors", async () => {
    fakeSupabase.failNext("applications", "network down");
    renderWithRouter(<HomePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load your dashboard: network down",
    );
  });
});
