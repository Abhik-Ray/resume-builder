import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RESUME_DATA } from "../../data/ResumeData";
import { fakeSupabase, profileRow, renderWithRouter, seedProfile } from "../../test/utils";
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
// Saved resume data, or null when on the defaults
const savedData = () => profileRow()?.resume_data as typeof DEFAULT_RESUME_DATA | null;

describe("ResumeDataSection", () => {
  // Home location filled in; resume data still the built-in defaults
  beforeEach(() => seedProfile({}, null));

  it("loads the default data into the form", async () => {
    await setup();
    expect(screen.getByText("Using the built-in defaults")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue(DEFAULT_RESUME_DATA.profile.name);
    expect(screen.getByLabelText("Current role")).toHaveValue(DEFAULT_RESUME_DATA.currentRole);
    expect(screen.getByLabelText("Contacts 1")).toHaveValue(DEFAULT_RESUME_DATA.profile.contacts[0]);
    expect(screen.getAllByText(/^Position \d+$/)).toHaveLength(DEFAULT_RESUME_DATA.experience.length);
  });

  it("loads saved data when there is some", async () => {
    seedProfile({}, { ...DEFAULT_RESUME_DATA, currentRole: "Staff Engineer" });
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
    expect(savedData()?.currentRole).toBe("Tech Lead");
    expect(savedData()?.profile.contacts.at(-1)).toBe("github.com/jane");
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
    seedProfile({}, { ...DEFAULT_RESUME_DATA, currentRole: "Staff Engineer" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Reset to defaults" }));

    expect(await screen.findByText("Restored the default resume data")).toBeInTheDocument();
    expect(savedData()).toBeNull();
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

  describe("home location and the details prompt", () => {
    it("shows the home location from the profile", async () => {
      seedProfile({ home_city: "Pune", home_region: "MH", search_radius_km: 25, include_remote: false });
      await setup();
      expect(screen.getByLabelText("City")).toHaveValue("Pune");
      expect(screen.getByLabelText("Region (optional)")).toHaveValue("MH");
      expect(screen.getByLabelText("Country code")).toHaveValue("IN");
      expect(screen.getByLabelText("Search radius (km)")).toHaveValue(25);
      expect(screen.getByLabelText("Include remote jobs")).not.toBeChecked();
    });

    it("asks for missing details with a banner", async () => {
      seedProfile({ home_city: null, home_country: null, details_completed_at: null }, null);
      await setup();
      const banner = screen.getByRole("note");
      expect(banner).toHaveTextContent("Fill in your details to get started.");
      expect(banner).toHaveTextContent("Home city");
      expect(banner).toHaveTextContent("Name");
    });

    it("saves the home location and clears the banner once complete", async () => {
      seedProfile({ home_city: null, home_country: null, details_completed_at: null }, null);
      const { user } = await setup();
      await user.type(screen.getByLabelText("City"), "Hyderabad");
      await user.type(screen.getByLabelText("Country code"), "in");
      await user.clear(screen.getByLabelText("Search radius (km)"));
      await user.type(screen.getByLabelText("Search radius (km)"), "80");
      await waitFor(() => expect(saveButton()).toBeEnabled());
      await user.click(saveButton());

      expect(await screen.findByText("Resume data saved")).toBeInTheDocument();
      expect(profileRow()).toMatchObject({
        home_city: "Hyderabad",
        home_country: "IN",
        search_radius_km: 80,
        resume_data: DEFAULT_RESUME_DATA,
        details_completed_at: expect.any(String),
      });
      await waitFor(() => expect(screen.queryByRole("note")).not.toBeInTheDocument());
    });

    it("validates the home location", async () => {
      const { user } = await setup();
      await user.clear(screen.getByLabelText("City"));
      await user.clear(screen.getByLabelText("Country code"));
      await user.type(screen.getByLabelText("Country code"), "1");
      await user.clear(screen.getByLabelText("Search radius (km)"));
      await user.type(screen.getByLabelText("Search radius (km)"), "900");

      expect(await screen.findByText("City is required")).toBeInTheDocument();
      expect(screen.getByText("Use the two-letter country code, e.g. IN")).toBeInTheDocument();
      expect(screen.getByText("At most 500 km")).toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
    });

    it("returns to the page that sent the user here after saving complete details", async () => {
      seedProfile({ home_city: null, details_completed_at: null }, null);
      const user = userEvent.setup();
      const { router } = renderWithRouter(<ResumeDataSection />, {
        path: "/settings/resume-data",
        routes: [{ path: "/resume", element: <p>Resume page</p> }],
      });
      await router.navigate("/settings/resume-data?from=/resume");
      await user.type(await screen.findByLabelText("City"), "Kochi");
      await waitFor(() => expect(saveButton()).toBeEnabled());
      await user.click(saveButton());

      expect(await screen.findByText("Resume page")).toBeInTheDocument();
    });

    it("shows load errors", async () => {
      fakeSupabase.failNext("profiles", "network down");
      renderWithRouter(<ResumeDataSection />, { path: "/settings/resume-data" });
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Couldn't load your details: network down",
      );
    });

    it("shows save errors", async () => {
      const { user } = await setup();
      await user.type(screen.getByLabelText("Name"), " Jr");
      await waitFor(() => expect(saveButton()).toBeEnabled());
      fakeSupabase.failNext("profiles", "write refused");
      await user.click(saveButton());
      expect(await screen.findByText("Save failed: write refused")).toBeInTheDocument();
      expect(saveButton()).toBeEnabled();
    });
  });
});

