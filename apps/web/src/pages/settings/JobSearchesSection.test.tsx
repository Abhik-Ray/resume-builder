import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, renderWithRouter, seedProfile, TEST_USER } from "../../test/utils";
import JobSearchesSection from "./JobSearchesSection";

const setup = async () => {
  const user = userEvent.setup();
  renderWithRouter(<JobSearchesSection />, { path: "/settings/searches" });
  await screen.findByRole("heading", { name: "Job searches" });
  return user;
};

describe("JobSearchesSection", () => {
  beforeEach(() => seedProfile({ home_city: "Pune", include_remote: true }));

  it("explains where it searches", async () => {
    await setup();
    expect(await screen.findByText(/Searched every morning near Pune, IN, plus remote jobs/)).toBeInTheDocument();
    expect(screen.getByText(/No searches yet/)).toBeInTheDocument();
  });

  it("adds a search", async () => {
    const user = await setup();
    await user.click(screen.getByRole("button", { name: "Add search" }));
    const form = screen.getByRole("form", { name: "New search" });
    await user.type(within(form).getByLabelText("Search name"), "React roles");
    await user.type(within(form).getByLabelText("Keywords 1"), "React");
    await user.click(within(form).getByRole("button", { name: "Add keyword" }));
    await user.type(within(form).getByLabelText("Keywords 2"), "TypeScript");
    await user.click(within(form).getByRole("button", { name: "Add exclusion" }));
    await user.type(within(form).getByLabelText("Exclude jobs mentioning 1"), "PHP");
    await user.click(within(form).getByRole("button", { name: "Save search" }));

    expect(await screen.findByText("React roles")).toBeInTheDocument();
    expect(fakeSupabase.rows("search_profiles")[0]).toMatchObject({
      user_id: TEST_USER.id,
      name: "React roles",
      keywords: ["React", "TypeScript"],
      exclude_keywords: ["PHP"],
      location_override: null,
      remote_only: false,
      min_score: 3,
      active: true,
    });
  });

  it("validates the form", async () => {
    const user = await setup();
    await user.click(screen.getByRole("button", { name: "Add search" }));
    await user.click(screen.getByRole("button", { name: "Save search" }));
    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Keyword is required")).toBeInTheDocument();
    expect(fakeSupabase.rows("search_profiles")).toHaveLength(0);
  });

  it("edits and deletes a search", async () => {
    fakeSupabase.seed("search_profiles", [{ id: "s1", user_id: TEST_USER.id, name: "React", keywords: ["react"] }]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = await setup();
    await user.click(await screen.findByRole("button", { name: "Edit React" }));
    const form = screen.getByRole("form", { name: "Edit React" });
    await user.type(within(form).getByLabelText("City (optional)"), "Mumbai");
    await user.click(within(form).getByLabelText("Remote jobs only"));
    await user.click(within(form).getByRole("button", { name: "Save search" }));
    expect(await screen.findByText(/remote only/)).toBeInTheDocument();
    expect(fakeSupabase.rows("search_profiles")[0]).toMatchObject({ location_override: "Mumbai", remote_only: true });

    await user.click(screen.getByRole("button", { name: "Delete React" }));
    await waitFor(() => expect(fakeSupabase.rows("search_profiles")).toHaveLength(0));
  });

  it("shows save errors", async () => {
    const user = await setup();
    await user.click(screen.getByRole("button", { name: "Add search" }));
    await user.type(screen.getByLabelText("Search name"), "X");
    await user.type(screen.getByLabelText("Keywords 1"), "react");
    fakeSupabase.failNext("search_profiles", "write refused");
    await user.click(screen.getByRole("button", { name: "Save search" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed: write refused");
  });

  describe("watched companies", () => {
    it("watches a company from its board URL", async () => {
      const user = await setup();
      const form = screen.getByRole("form", { name: "Watch a company" });
      await user.type(within(form).getByLabelText("Company"), "Globex");
      await user.type(within(form).getByLabelText("Board URL or name"), "https://jobs.lever.co/globex");
      await user.click(within(form).getByRole("button", { name: "Watch" }));

      expect(await screen.findByRole("link", { name: "Lever board" })).toHaveAttribute(
        "href",
        "https://jobs.lever.co/globex",
      );
      expect(fakeSupabase.rows("watched_companies")[0]).toMatchObject({
        user_id: TEST_USER.id,
        provider: "lever",
        board: "globex",
        name: "Globex",
      });
      expect(within(form).getByLabelText("Company")).toHaveValue("");
    });

    it("rejects something that isn't a board", async () => {
      const user = await setup();
      const form = screen.getByRole("form", { name: "Watch a company" });
      await user.type(within(form).getByLabelText("Company"), "Acme");
      await user.type(within(form).getByLabelText("Board URL or name"), "not a board");
      await user.click(within(form).getByRole("button", { name: "Watch" }));
      expect(await screen.findByText("Use the board's URL or its name, e.g. acme")).toBeInTheDocument();
    });

    it("says when the board is already watched", async () => {
      fakeSupabase.seed("watched_companies", [
        { id: "w1", user_id: TEST_USER.id, provider: "greenhouse", board: "acme", name: "Acme" },
      ]);
      const user = await setup();
      const form = screen.getByRole("form", { name: "Watch a company" });
      await user.type(within(form).getByLabelText("Company"), "Acme");
      await user.type(within(form).getByLabelText("Board URL or name"), "acme");
      await user.click(within(form).getByRole("button", { name: "Watch" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Couldn't add the company: You already watch this board",
      );
    });

    it("stops watching", async () => {
      fakeSupabase.seed("watched_companies", [
        { id: "w1", user_id: TEST_USER.id, provider: "greenhouse", board: "acme", name: "Acme" },
      ]);
      const user = await setup();
      await user.click(await screen.findByRole("button", { name: "Stop watching Acme" }));
      await waitFor(() => expect(fakeSupabase.rows("watched_companies")).toHaveLength(0));
    });
  });
});

