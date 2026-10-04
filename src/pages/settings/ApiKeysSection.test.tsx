import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addApiKey } from "../../db/apiKeys";
import { db } from "../../db/db";
import { GEMINI_KEY, resetDb } from "../../test/utils";
import ApiKeysSection from "./ApiKeysSection";

vi.mock("../../utils/AIHealthCheck", () => ({ verifyProviderKey: vi.fn() }));
import { verifyProviderKey } from "../../utils/AIHealthCheck";

const verify = vi.mocked(verifyProviderKey);
const PASS = { status: "healthy", valid: true } as const;
const FAIL = { status: "unhealthy", valid: false, reason: "API key not valid" } as const;

const setup = async () => {
  const user = userEvent.setup();
  render(<ApiKeysSection />);
  await screen.findByRole("heading", { name: "API keys" });
  return user;
};

const openAddForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Add key" }));
  return screen.getByRole("heading", { name: "Add key" }).closest("form") as HTMLFormElement;
};

const keyRows = () => screen.queryAllByRole("listitem");

describe("ApiKeysSection", () => {
  beforeEach(async () => {
    await resetDb();
    verify.mockReset();
  });

  it("shows an empty state when no keys are saved", async () => {
    await setup();
    expect(screen.getByText(/No keys yet/)).toBeInTheDocument();
  });

  it("lists saved keys masked, with provider and default badges", async () => {
    await addApiKey({ label: "Personal", provider: "gemini", key: GEMINI_KEY });
    await addApiKey({ label: "Work", provider: "gemini", key: "AIzaWorkKey123456" });
    await setup();

    await waitFor(() => expect(keyRows()).toHaveLength(2));
    const [personal, work] = keyRows();
    expect(personal).toHaveTextContent("Personal");
    expect(personal).toHaveTextContent("Gemini");
    expect(personal).toHaveTextContent("Default");
    expect(personal).toHaveTextContent("AIza••••nopq");
    expect(personal).not.toHaveTextContent(GEMINI_KEY);
    expect(work).not.toHaveTextContent("Default");
  });

  describe("adding a key", () => {
    it("prefills the label with the provider and five random characters", async () => {
      const user = await setup();
      await openAddForm(user);
      expect((screen.getByLabelText("Label") as HTMLInputElement).value).toMatch(
        /^gemini-[0-9a-f]{5}$/,
      );
      expect(screen.getByLabelText("Provider")).toHaveValue("gemini");
    });

    it("verifies the key with the provider, then saves it as the default", async () => {
      verify.mockResolvedValue(PASS);
      const user = await setup();
      await openAddForm(user);
      await user.clear(screen.getByLabelText("Label"));
      await user.type(screen.getByLabelText("Label"), "Personal");
      await user.type(screen.getByLabelText("API key"), `  ${GEMINI_KEY}  `);
      await user.click(screen.getByRole("button", { name: "Add key" }));

      expect(verify).toHaveBeenCalledWith("gemini", GEMINI_KEY);
      await waitFor(() => expect(keyRows()).toHaveLength(1));
      expect(keyRows()[0]).toHaveTextContent("Personal");
      expect(screen.queryByRole("heading", { name: "Add key" })).not.toBeInTheDocument();
      expect(await db.apiKeys.toArray()).toEqual([
        expect.objectContaining({ label: "Personal", key: GEMINI_KEY, isDefault: true }),
      ]);
    });

    it("shows an animated status and locks the form while verifying", async () => {
      let finish: (value: typeof PASS) => void = () => {};
      verify.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      const user = await setup();
      await openAddForm(user);
      await user.type(screen.getByLabelText("API key"), GEMINI_KEY);
      await user.click(screen.getByRole("button", { name: "Add key" }));

      const status = await screen.findByText("Checking the key with Gemini…");
      expect(status).toHaveClass("animate-pulse");
      expect(screen.getByRole("button", { name: "Verifying…" })).toBeDisabled();
      expect(screen.getByLabelText("API key")).toBeDisabled();

      finish(PASS);
      await waitFor(() => expect(keyRows()).toHaveLength(1));
    });

    it("stays on the form with the reason when verification fails", async () => {
      verify.mockResolvedValue(FAIL);
      const user = await setup();
      const form = await openAddForm(user);
      await user.type(screen.getByLabelText("API key"), "bad-key");
      await user.click(screen.getByRole("button", { name: "Add key" }));

      expect(
        await within(form).findByText("Gemini rejected this key or couldn't be reached"),
      ).toBeInTheDocument();
      expect(within(form).getByText("API key not valid")).toBeInTheDocument();
      expect(screen.getByLabelText("API key")).toHaveValue("bad-key");
      expect(await db.apiKeys.count()).toBe(0);
    });

    it("reports an error thrown by the check", async () => {
      verify.mockRejectedValue(new Error("network down"));
      const user = await setup();
      await openAddForm(user);
      await user.type(screen.getByLabelText("API key"), "k");
      await user.click(screen.getByRole("button", { name: "Add key" }));

      expect(await screen.findByText("Couldn't check the key")).toBeInTheDocument();
      expect(screen.getByText("network down")).toBeInTheDocument();
      expect(await db.apiKeys.count()).toBe(0);
    });

    it("doesn't check again after a successful Verify", async () => {
      verify.mockResolvedValue(PASS);
      const user = await setup();
      await openAddForm(user);
      await user.type(screen.getByLabelText("API key"), GEMINI_KEY);
      await user.click(screen.getByRole("button", { name: "Verify" }));
      expect(await screen.findByText("Gemini accepted this key")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Add key" }));
      await waitFor(() => expect(keyRows()).toHaveLength(1));
      expect(verify).toHaveBeenCalledTimes(1);
    });

    it("checks again when the key changes after Verify", async () => {
      verify.mockResolvedValue(PASS);
      const user = await setup();
      await openAddForm(user);
      await user.type(screen.getByLabelText("API key"), GEMINI_KEY);
      await user.click(screen.getByRole("button", { name: "Verify" }));
      await screen.findByText("Gemini accepted this key");

      await user.type(screen.getByLabelText("API key"), "x");
      expect(screen.queryByText("Gemini accepted this key")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Add key" }));
      await waitFor(() => expect(verify).toHaveBeenCalledTimes(2));
      expect(verify).toHaveBeenLastCalledWith("gemini", `${GEMINI_KEY}x`);
    });

    it("requires a label and a key without calling the provider", async () => {
      const user = await setup();
      await openAddForm(user);
      await user.clear(screen.getByLabelText("Label"));
      await user.click(screen.getByRole("button", { name: "Add key" }));

      expect(await screen.findByText("Label is required")).toBeInTheDocument();
      expect(screen.getByText("Key is required")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Verify" }));
      expect(verify).not.toHaveBeenCalled();
    });

    it("rejects a label another key already uses", async () => {
      await addApiKey({ label: "Personal", provider: "gemini", key: GEMINI_KEY });
      const user = await setup();
      await openAddForm(user);
      await user.clear(screen.getByLabelText("Label"));
      await user.type(screen.getByLabelText("Label"), "personal");
      await user.type(screen.getByLabelText("API key"), "k");
      await user.click(screen.getByRole("button", { name: "Add key" }));

      expect(await screen.findByText("A key with this label already exists")).toBeInTheDocument();
      expect(verify).not.toHaveBeenCalled();
    });

    it("closes the form on Cancel", async () => {
      const user = await setup();
      await openAddForm(user);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("heading", { name: "Add key" })).not.toBeInTheDocument();
    });
  });

  describe("autofill", () => {
    it("doesn't look like a login form to browsers and password managers", async () => {
      const user = await setup();
      const form = await openAddForm(user);
      expect(form.querySelector('input[type="password"]')).toBeNull();
      expect(form).toHaveAttribute("autocomplete", "off");

      for (const name of ["Label", "API key"]) {
        const input = screen.getByLabelText(name);
        expect(input).toHaveAttribute("autocomplete", "off");
        expect(input).toHaveAttribute("data-1p-ignore");
        expect(input).toHaveAttribute("data-lpignore", "true");
        expect(input).toHaveAttribute("data-bwignore");
      }
    });

    it("masks the key with CSS until shown", async () => {
      const user = await setup();
      await openAddForm(user);
      const input = screen.getByLabelText("API key");
      expect(input).toHaveClass("[-webkit-text-security:disc]");

      await user.click(screen.getByRole("button", { name: "Show key" }));
      expect(input).not.toHaveClass("[-webkit-text-security:disc]");
      await user.click(screen.getByRole("button", { name: "Hide key" }));
      expect(input).toHaveClass("[-webkit-text-security:disc]");
    });
  });

  describe("managing keys", () => {
    beforeEach(async () => {
      await addApiKey({ label: "Personal", provider: "gemini", key: GEMINI_KEY });
      await addApiKey({ label: "Work", provider: "gemini", key: "AIzaWorkKey123456" });
    });

    it("hides the key's row while it is being edited", async () => {
      const user = await setup();
      await waitFor(() => expect(keyRows()).toHaveLength(2));
      await user.click(screen.getByRole("button", { name: "Edit Personal" }));

      expect(screen.getByRole("heading", { name: "Edit key" })).toBeInTheDocument();
      expect(keyRows()).toHaveLength(1);
      expect(keyRows()[0]).toHaveTextContent("Work");

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(keyRows()).toHaveLength(2);
    });

    it("saves a label-only edit without checking the key", async () => {
      const user = await setup();
      await user.click(await screen.findByRole("button", { name: "Edit Personal" }));
      expect(screen.getByLabelText("Label")).toHaveValue("Personal");
      expect(screen.getByLabelText("API key")).toHaveValue(GEMINI_KEY);

      await user.clear(screen.getByLabelText("Label"));
      await user.type(screen.getByLabelText("Label"), "Home");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(screen.getByText("Home")).toBeInTheDocument());
      expect(verify).not.toHaveBeenCalled();
    });

    it("checks a changed key before saving the edit", async () => {
      verify.mockResolvedValue(FAIL);
      const user = await setup();
      await user.click(await screen.findByRole("button", { name: "Edit Personal" }));
      await user.clear(screen.getByLabelText("API key"));
      await user.type(screen.getByLabelText("API key"), "new-key");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("API key not valid")).toBeInTheDocument();
      expect((await db.apiKeys.toArray())[0].key).toBe(GEMINI_KEY);
    });

    it("sets another key as the default", async () => {
      const user = await setup();
      await user.click(await screen.findByRole("button", { name: "Set default" }));
      await waitFor(() => expect(keyRows()[1]).toHaveTextContent("Default"));
      expect(keyRows()[0]).not.toHaveTextContent("Default");
    });

    it("deletes a key after confirmation", async () => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
      const user = await setup();
      await user.click(await screen.findByRole("button", { name: "Delete Work" }));

      expect(confirm).toHaveBeenCalledWith("Delete the key “Work”?");
      await waitFor(() => expect(keyRows()).toHaveLength(1));
    });

    it("keeps the key when deletion is cancelled", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const user = await setup();
      await user.click(await screen.findByRole("button", { name: "Delete Work" }));
      expect(await db.apiKeys.count()).toBe(2);
    });
  });
});
