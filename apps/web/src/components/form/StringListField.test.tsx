import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { StringListField } from "./StringListField";

const schema = z.object({
  tags: z.array(z.string().trim().min(1, "Tag is required")).min(1, "Add at least one tag"),
});

const TestForm = ({
  initial,
  onSubmit = () => {},
  multiline,
}: {
  initial: string[];
  onSubmit?: (values: z.output<typeof schema>) => void;
  multiline?: boolean;
}) => {
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { tags: initial },
    mode: "onChange",
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <StringListField
        control={control}
        name="tags"
        label="Tags"
        addLabel="Add tag"
        placeholder="A tag"
        multiline={multiline}
      />
      <button type="submit">Submit</button>
    </form>
  );
};

const inputs = () => screen.queryAllByRole("textbox");

describe("StringListField", () => {
  it("renders one input per item inside a labelled group", () => {
    render(<TestForm initial={["a", "b"]} />);
    expect(screen.getByRole("group", { name: "Tags" })).toBeInTheDocument();
    expect(inputs().map((i) => (i as HTMLInputElement).value)).toEqual(["a", "b"]);
    expect(screen.getByLabelText("Tags 2")).toHaveValue("b");
    expect(inputs()[0]).toHaveAttribute("placeholder", "A tag");
  });

  it("adds, edits and removes items", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TestForm initial={["a"]} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Add tag" }));
    await user.type(screen.getByLabelText("Tags 2"), "new");
    await user.clear(screen.getByLabelText("Tags 1"));
    await user.type(screen.getByLabelText("Tags 1"), "first");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenLastCalledWith({ tags: ["first", "new"] }, expect.anything());

    await user.click(screen.getByRole("button", { name: "Remove Tags 1" }));
    expect(inputs().map((i) => (i as HTMLInputElement).value)).toEqual(["new"]);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenLastCalledWith({ tags: ["new"] }, expect.anything());
  });

  it("shows errors next to the failing item", async () => {
    const user = userEvent.setup();
    render(<TestForm initial={["a", "b"]} />);
    await user.clear(screen.getByLabelText("Tags 2"));

    expect(await screen.findByText("Tag is required")).toBeInTheDocument();
    expect(screen.getByLabelText("Tags 2")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Tags 1")).toHaveAttribute("aria-invalid", "false");
  });

  it("shows errors about the whole list", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TestForm initial={["a"]} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Remove Tags 1" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Add at least one tag")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders textareas when multiline", () => {
    render(<TestForm initial={["a"]} multiline />);
    expect(screen.getByLabelText("Tags 1").tagName).toBe("TEXTAREA");
  });
});
