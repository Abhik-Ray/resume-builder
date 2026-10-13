import { createEvent, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeSupabase, renderWithRouter, TEST_USER } from "../../test/utils";
import ApplicationsPage from "./ApplicationsPage";

const seed = () =>
  fakeSupabase.seed("applications", [
    { id: "a1", user_id: TEST_USER.id, company: "Acme", title: "Engineer", status: "applied" },
    { id: "a2", user_id: TEST_USER.id, company: "Globex", title: "Developer", status: "interview" },
  ]);

const openBoard = async () => {
  const user = userEvent.setup();
  renderWithRouter(<ApplicationsPage />, { path: "/applications" });
  await user.click(await screen.findByRole("button", { name: "Board" }));
  return user;
};

// jsdom has no DataTransfer; a small stand-in carries the dragged id
const dataTransfer = () => {
  const data = new Map<string, string>();
  return {
    get types() {
      return [...data.keys()];
    },
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
    effectAllowed: "all",
  };
};

const drag = (card: HTMLElement, column: HTMLElement) => {
  const transfer = dataTransfer();
  fireEvent.dragStart(card, { dataTransfer: transfer });
  const over = createEvent.dragOver(column, { dataTransfer: transfer });
  fireEvent(column, over);
  fireEvent.drop(column, { dataTransfer: transfer });
  return over;
};

describe("Applications board", () => {
  it("shows a column per status with its cards", async () => {
    seed();
    await openBoard();
    const applied = await screen.findByRole("region", { name: "Applied" });
    expect(within(applied).getByRole("article", { name: "Engineer at Acme" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Interview" })).getByText("Globex")).toBeInTheDocument();
    expect(screen.getAllByRole("region")).toHaveLength(9);
  });

  it("moves a card by dragging it to another column", async () => {
    seed();
    await openBoard();
    const card = await screen.findByRole("article", { name: "Engineer at Acme" });
    const over = drag(card, screen.getByRole("region", { name: "Offer" }));
    expect(over.defaultPrevented).toBe(true);

    await waitFor(() =>
      expect(within(screen.getByRole("region", { name: "Offer" })).getByText("Acme")).toBeInTheDocument(),
    );
    expect(fakeSupabase.rows("applications").find((a) => a.id === "a1")?.status).toBe("offer");
    expect(fakeSupabase.rows("application_events")).toContainEqual(
      expect.objectContaining({ application_id: "a1", from_status: "applied", to_status: "offer" }),
    );
  });

  it("moves a card with its dropdown", async () => {
    seed();
    const user = await openBoard();
    await user.selectOptions(await screen.findByLabelText("Status of Developer at Globex"), "rejected");
    await waitFor(() =>
      expect(within(screen.getByRole("region", { name: "Rejected" })).getByText("Globex")).toBeInTheDocument(),
    );
  });

  it("shows move errors", async () => {
    seed();
    await openBoard();
    const card = await screen.findByRole("article", { name: "Engineer at Acme" });
    fakeSupabase.failNext("applications", "write refused");
    drag(card, screen.getByRole("region", { name: "Offer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Status change failed: write refused");
  });

  it("remembers the chosen view", async () => {
    seed();
    await openBoard();
    expect(localStorage.getItem("applications.view")).toBe("board");
    expect(screen.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true");
  });
});
