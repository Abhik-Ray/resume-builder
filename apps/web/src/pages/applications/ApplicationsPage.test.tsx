import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeSupabase, renderWithRouter, TEST_USER } from "../../test/utils";
import ApplicationsPage from "./ApplicationsPage";

vi.mock("../../ResumePreview", () => ({
  default: (props: { summaryData: string }) => <div data-testid="preview">{props.summaryData}</div>,
}));

const seed = () =>
  fakeSupabase.seed("applications", [
    {
      id: "a1",
      user_id: TEST_USER.id,
      company: "Acme",
      title: "Engineer",
      url: "https://acme.example/jobs/1",
      status: "applied",
      applied_at: "2026-10-01T10:00:00.000Z",
      created_at: "2026-10-01T10:00:00.000Z",
      resume_snapshot: {
        resume: {},
        summary: "Tailored summary",
        skills: ["React"],
        experienceBullets: ["Did things"],
      },
    },
    {
      id: "a2",
      user_id: TEST_USER.id,
      company: "Globex",
      title: "Developer",
      status: "saved",
      created_at: "2026-10-02T10:00:00.000Z",
    },
  ]);

const setup = async () => {
  const user = userEvent.setup();
  renderWithRouter(<ApplicationsPage />, { path: "/applications" });
  await screen.findByRole("heading", { name: "Applications" });
  return user;
};

describe("ApplicationsPage", () => {
  it("lists applications, newest first", async () => {
    seed();
    await setup();
    const rows = await screen.findAllByRole("row");
    expect(rows.slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual([
      "Globex",
      "Acme",
    ]);
    expect(screen.getByRole("link", { name: /Engineer/ })).toHaveAttribute(
      "href",
      "https://acme.example/jobs/1",
    );
  });

  it("says when there are none yet", async () => {
    await setup();
    expect(await screen.findByText(/No applications yet/)).toBeInTheDocument();
  });

  it("adds an application by hand", async () => {
    const user = await setup();
    await user.click(screen.getByRole("button", { name: "Add application" }));
    await user.type(screen.getByLabelText("Company"), "Initech");
    await user.type(screen.getByLabelText("Job title"), "Platform Engineer");
    await user.click(screen.getAllByRole("button", { name: "Add application" }).at(-1)!);

    expect(await screen.findByRole("cell", { name: "Initech" })).toBeInTheDocument();
    expect(fakeSupabase.rows("applications")[0]).toMatchObject({
      company: "Initech",
      title: "Platform Engineer",
      status: "applied",
      url: null,
      user_id: TEST_USER.id,
    });
  });

  it("validates the form", async () => {
    const user = await setup();
    await user.click(screen.getByRole("button", { name: "Add application" }));
    await user.type(screen.getByLabelText("Job link (optional)"), "not a url");
    await user.click(screen.getAllByRole("button", { name: "Add application" }).at(-1)!);
    expect(await screen.findByText("Company is required")).toBeInTheDocument();
    expect(screen.getByText("Enter a full URL")).toBeInTheDocument();
    expect(fakeSupabase.rows("applications")).toHaveLength(0);
  });

  it("changes the status and records the history", async () => {
    seed();
    const user = await setup();
    await user.selectOptions(
      await screen.findByLabelText("Status of Developer at Globex"),
      "interview",
    );
    await waitFor(() =>
      expect(fakeSupabase.rows("applications").find((a) => a.id === "a2")?.status).toBe("interview"),
    );
    expect(fakeSupabase.rows("application_events")).toContainEqual(
      expect.objectContaining({ application_id: "a2", from_status: "saved", to_status: "interview" }),
    );
  });

  it("shows status change errors", async () => {
    seed();
    const user = await setup();
    const select = await screen.findByLabelText("Status of Developer at Globex");
    fakeSupabase.failNext("applications", "write refused");
    await user.selectOptions(select, "offer");
    expect(await screen.findByRole("alert")).toHaveTextContent("Status change failed: write refused");
  });

  it("deletes after confirmation", async () => {
    seed();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = await setup();
    await user.click(await screen.findByRole("button", { name: "Delete Developer at Globex" }));
    await waitFor(() => expect(screen.queryByText("Globex")).not.toBeInTheDocument());
    expect(fakeSupabase.rows("applications").map((a) => a.id)).toEqual(["a1"]);
  });

  it("opens the resume sent with an application", async () => {
    seed();
    const user = await setup();
    await user.click(await screen.findByRole("button", { name: "Resume sent for Engineer at Acme" }));
    expect(await screen.findByTestId("preview")).toHaveTextContent("Tailored summary");
  });

  it("shows load errors", async () => {
    fakeSupabase.failNext("applications", "network down");
    await setup();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load your applications: network down",
    );
  });
});
