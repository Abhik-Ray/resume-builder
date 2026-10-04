import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheckboxField, FieldError, SelectField, TextAreaField, TextField } from "./fields";

describe("FieldError", () => {
  it("renders the message", () => {
    render(<FieldError message="Required" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("renders nothing without a message", () => {
    const { container } = render(<FieldError />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("TextField", () => {
  it("links the label to the input and passes props through", () => {
    render(<TextField label="Name" placeholder="Jane" defaultValue="x" />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("placeholder", "Jane");
    expect(input).toHaveValue("x");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("shows the error and marks the input invalid", () => {
    render(<TextField label="Name" hint="Your full name" error="Name is required" />);
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    // The hint gives way to the error
    expect(screen.queryByText("Your full name")).not.toBeInTheDocument();
  });

  it("shows the hint when there is no error", () => {
    render(<TextField label="Name" hint="Your full name" />);
    expect(screen.getByText("Your full name")).toBeInTheDocument();
  });

  it("applies className to the wrapper and inputClassName to the input", () => {
    render(<TextField label="Name" className="wrapper-class" inputClassName="input-class" />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveClass("input-class");
    expect(input).not.toHaveClass("wrapper-class");
    expect(input.parentElement).toHaveClass("wrapper-class");
  });

  it("gives each field a unique id", () => {
    render(
      <>
        <TextField label="First" />
        <TextField label="Second" />
      </>,
    );
    expect(screen.getByLabelText("First").id).not.toBe(screen.getByLabelText("Second").id);
  });
});

describe("TextAreaField", () => {
  it("renders a labelled textarea with an error", () => {
    render(<TextAreaField label="Summary" error="Too long" />);
    const textarea = screen.getByLabelText("Summary");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Too long")).toBeInTheDocument();
  });
});

describe("SelectField", () => {
  it("renders the options", () => {
    render(
      <SelectField
        label="Work model"
        defaultValue="Hybrid"
        options={[
          { value: "Remote", label: "Remote" },
          { value: "Hybrid", label: "Hybrid" },
        ]}
      />,
    );
    const select = screen.getByLabelText("Work model");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Remote", "Hybrid"]);
    expect(select).toHaveValue("Hybrid");
  });
});

describe("CheckboxField", () => {
  it("renders a labelled checkbox with an error", () => {
    render(<CheckboxField label="Remote only" defaultChecked error="Pick one" />);
    expect(screen.getByRole("checkbox", { name: "Remote only" })).toBeChecked();
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });
});
