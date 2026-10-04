import { Plus, X } from "lucide-react";
import {
  get,
  useController,
  type Control,
  type FieldError as RHFFieldError,
  type FieldPathByValue,
  type FieldValues,
} from "react-hook-form";
import { Button } from "../ui/button";
import { FieldError } from "./fields";
import { inputClass, labelClass } from "./styles";
import { cn } from "../../lib/utils";

interface StringListFieldProps<T extends FieldValues, TOut> {
  control: Control<T, unknown, TOut>;
  name: FieldPathByValue<T, string[] | undefined>;
  label: string;
  placeholder?: string;
  addLabel?: string;
  // Render items as textareas for long entries such as bullet points
  multiline?: boolean;
}

// useFieldArray only handles arrays of objects, so string arrays are edited as one controlled value
export const StringListField = <T extends FieldValues, TOut>({
  control,
  name,
  label,
  placeholder,
  addLabel = "Add",
  multiline = false,
}: StringListFieldProps<T, TOut>) => {
  const { field, formState } = useController({ control, name });
  const items = (field.value ?? []) as string[];
  // Item errors live at [index], errors about the whole list at .message / .root
  const errors = get(formState.errors, name) as
    | (RHFFieldError & { root?: RHFFieldError } & Record<number, RHFFieldError | undefined>)
    | undefined;
  const listError = errors?.message ?? errors?.root?.message;

  const setItems = (next: string[]) => field.onChange(next);
  const updateItem = (index: number, value: string) =>
    setItems(items.map((item, i) => (i === index ? value : item)));

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={cn(labelClass, "mb-1")}>{label}</legend>
      {items.map((item, index) => {
        const itemError = errors?.[index]?.message;
        const inputProps = {
          value: item,
          placeholder,
          "aria-invalid": !!itemError,
          "aria-label": `${label} ${index + 1}`,
          onBlur: field.onBlur,
        };
        return (
          <div key={index} className="flex flex-col gap-0.5">
            <div className="flex items-start gap-1.5">
              {multiline ? (
                <textarea
                  {...inputProps}
                  rows={2}
                  className={cn(inputClass, "resize-y")}
                  onChange={(e) => updateItem(index, e.target.value)}
                />
              ) : (
                <input
                  {...inputProps}
                  className={inputClass}
                  onChange={(e) => updateItem(index, e.target.value)}
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${label} ${index + 1}`}
                onClick={() => setItems(items.filter((_, i) => i !== index))}
              >
                <X />
              </Button>
            </div>
            <FieldError message={itemError} />
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit rounded-md"
        onClick={() => setItems([...items, ""])}
      >
        <Plus /> {addLabel}
      </Button>
      <FieldError message={listError} />
    </fieldset>
  );
};
