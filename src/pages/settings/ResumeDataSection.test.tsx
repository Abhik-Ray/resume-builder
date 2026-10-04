import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RESUME_DATA } from "../../data/ResumeData";
import { db } from "../../db/db";
import { saveResumeData } from "../../db/resumeData";
import { renderWithRouter, resetDb } from "../../test/utils";
import ResumeDataSection from "./ResumeDataSection";

const setup = async () => {
  const user = userEvent.setup();
  const view = renderWithRouter(<ResumeDataSection />, {
    path: "/settings/resume-data",
  });
  await screen.findByRole("heading", { name: "Resume data" });
  return { user, ...view };
};

const saveButton = () => screen.getByRole("button", { name: "Save" });
const savedRecord = () => db.resumeData.get("current");

describe("ResumeDataSection", () => {
  beforeEach(resetDb);

  it("loads the default data into the form", async () => {
    await setup();
    expect(screen.getByText("Using the built-in defaults")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue(DEFAULT_RESUME_DATA.profile.name);
    expect(screen.getByLabelText("Current role")).toHaveValue(DEFAULT_RESUME_DATA.currentRole);
    expect(screen.getByLabelText("Contacts 1")).toHaveValue(DEFAULT_RESUME_DATA.profile.contacts[0]);
    expect(screen.getAllByText(/^Position \d+$/)).toHaveLength(DEFAULT_RESUME_DATA.experience.length);
  });

  it("loads saved data when there is some", async () => {
    await saveResumeData({ ...DEFAULT_RESUME_DATA, currentRole: "Staff Engineer" });
    await setup();
    expect(screen.getByText("Using your saved data")).toBeInTheDocument();
    expect(screen.getByLabelText("Current role")).toHaveValue("Staff Engineer");
  });

  it("shows each part of the data under a large section heading", async () => {
    await setup();
    for (const title of ["Profile", "Career", "Skills", "Experience", "Job preferences"]) {
      expect(screen.getByRole("heading", { level: 3, name: title })).toHaveClass("text-xl");
    }
  });

  it("enables Save only once something changed", async () => {
    const { user } = await setup();
    expect(saveButton()).toBeDisabled();
    await user.type(screen.getByLabelText("Name"), " Jr");
    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(screen.getByText(/unsaved changes/)).toBeInTheDocument();
  });

  it("saves edits to the database", async () => {
    const { user } = await setup();
    await user.clear(screen.getByLabelText("Current role"));
    await user.type(screen.getByLabelText("Current role"), "Tech Lead");
    await user.click(screen.getByRole("button", { name: "Add contact" }));
    await user.type(
      screen.getByLabelText(`Contacts ${DEFAULT_RESUME_DATA.profile.contacts.length + 1}`),
      "github.com/jane",
    );
    await waitFor(() => expect(saveButton()).toBeEnabled());
    await user.click(saveButton());

    expect(await screen.findByText("Resume data saved")).toBeInTheDocument();
    const record = await savedRecord();
    expect(record?.data.currentRole).toBe("Tech Lead");
    expect(record?.data.profile.contacts.at(-1)).toBe("github.com/jane");
    await waitFor(() => expect(screen.getByText("Using your saved data")).toBeInTheDocument());
    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it("shows validation errors and blocks saving", async () => {
    const { user } = await setup();
    await user.clear(screen.getByLabelText("Name"));
    await user.clear(screen.getByLabelText("Years of experience"));
    await user.type(screen.getByLabelText("Years of experience"), "lots");

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Enter a number such as 3 or 3.5")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(saveButton()).toBeDisabled();
  });

  it("allows only one position to be rewritten by the AI", async () => {
    const { user } = await setup();
    const boxes = screen.getAllByRole("checkbox", {
      name: "Let the AI rewrite these bullets for each job",
    });
    const unticked = boxes.find((b) => !(b as HTMLInputElement).checked);
    await user.click(unticked!);

    expect(
      await screen.findByText("Only one position can be rewritten by the AI"),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    await user.click(unticked!);
    await waitFor(() =>
      expect(
        screen.queryByText("Only one position can be rewritten by the AI"),
      ).not.toBeInTheDocument(),
    );
  });

  it("adds and removes positions and projects", async () => {
    const { user } = await setup();
    const count = DEFAULT_RESUME_DATA.experience.length;
    await user.click(screen.getByRole("button", { name: "Add position" }));
    expect(screen.getAllByText(/^Position \d+$/)).toHaveLength(count + 1);

    const newPosition = screen.getByText(`Position ${count + 1}`).parentElement!.parentElement!;
    await user.click(within(newPosition).getByRole("button", { name: "Add project" }));
    expect(within(newPosition).getByLabelText("Project name")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: `Remove position ${count + 1}` }));
    expect(screen.getAllByText(/^Position \d+$/)).toHaveLength(count);
  });

  it("discards unsaved changes", async () => {
    const { user } = await setup();
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Someone Else");
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByLabelText("Name")).toHaveValue(DEFAULT_RESUME_DATA.profile.name);
  });

  it("resets saved data to the defaults after confirmation", async () => {
    await saveResumeData({ ...DEFAULT_RESUME_DATA, currentRole: "Staff Engineer" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Reset to defaults" }));

    expect(await screen.findByText("Restored the default resume data")).toBeInTheDocument();
    expect(await savedRecord()).toBeUndefined();
    await waitFor(() =>
      expect(screen.getByLabelText("Current role")).toHaveValue(DEFAULT_RESUME_DATA.currentRole),
    );
  });

  it("disables Reset to defaults when already on the defaults", async () => {
    await setup();
    expect(screen.getByRole("button", { name: "Reset to defaults" })).toBeDisabled();
  });

  it("asks before leaving with unsaved changes", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { user, router } = await setup();
    await user.type(screen.getByLabelText("Name"), "!");

    // The prompt comes from an effect once the router reports the navigation as blocked
    await act(() => router.navigate("/elsewhere"));
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith("You have unsaved changes. Leave anyway?"),
    );
    expect(router.state.location.pathname).toBe("/settings/resume-data");

    confirm.mockReturnValue(true);
    await act(() => router.navigate("/elsewhere"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
  });

  it("leaves without asking when nothing changed", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const { router } = await setup();
    await act(() => router.navigate("/elsewhere"));
    expect(confirm).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/elsewhere");
  });
});
