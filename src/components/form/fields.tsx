import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { inputClass, labelClass } from "./styles";

export const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-xs text-destructive">{message}</p> : null;

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

const FieldShell = ({ id, label, error, hint, children, className }: FieldShellProps) => (
  <div className={cn("flex flex-col gap-1", className)}>
    <label htmlFor={id} className={labelClass}>
      {label}
    </label>
    {children}
    {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    <FieldError message={error} />
  </div>
);

type TextFieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  // className styles the wrapper; this styles the <input> itself
  inputClassName?: string;
};

// Spread react-hook-form's register() result into this
export const TextField = ({
  label,
  error,
  hint,
  className,
  inputClassName,
  ...props
}: TextFieldProps) => {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} className={className}>
      <input
        id={id}
        aria-invalid={!!error}
        className={cn(inputClass, inputClassName)}
        {...props}
      />
    </FieldShell>
  );
};

type TextAreaFieldProps = ComponentProps<"textarea"> & {
  label: string;
  error?: string;
  hint?: ReactNode;
};

export const TextAreaField = ({ label, error, hint, className, ...props }: TextAreaFieldProps) => {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} className={className}>
      <textarea
        id={id}
        rows={4}
        aria-invalid={!!error}
        className={cn(inputClass, "resize-y")}
        {...props}
      />
    </FieldShell>
  );
};

type SelectFieldProps = ComponentProps<"select"> & {
  label: string;
  error?: string;
  options: readonly { value: string; label: string }[];
};

export const SelectField = ({ label, error, options, className, ...props }: SelectFieldProps) => {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} className={className}>
      <select id={id} aria-invalid={!!error} className={inputClass} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
};

type CheckboxFieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
};

export const CheckboxField = ({ label, error, className, ...props }: CheckboxFieldProps) => {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="flex items-center gap-2 text-sm">
        <input id={id} type="checkbox" aria-invalid={!!error} className="size-4" {...props} />
        {label}
      </label>
      <FieldError message={error} />
    </div>
  );
};
