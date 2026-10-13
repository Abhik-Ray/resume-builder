import { zodResolver } from "@hookform/resolvers/zod";
import {
  applicationInputSchema,
  APPLICATION_STATUSES,
  STATUS_LABELS,
  type ApplicationFormValues,
  type ApplicationInput,
} from "@resume-builder/shared";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { SelectField, TextField } from "../../components/form/fields";
import { Button } from "../../components/ui/button";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

interface ApplicationFormProps {
  submitLabel: string;
  defaultValues?: Partial<ApplicationFormValues>;
  // Throws to show an error; resolves once saved
  onSubmit: (values: ApplicationInput) => Promise<unknown>;
}

// Company, title, link and status: used on the Applications page and in the Resume flow
export const ApplicationForm = ({ submitLabel, defaultValues, onSubmit }: ApplicationFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationFormValues, unknown, ApplicationInput>({
    resolver: zodResolver(applicationInputSchema),
    defaultValues: { company: "", title: "", url: "", status: "applied", ...defaultValues },
  });
  const [error, setError] = useState<string | null>(null);

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await onSubmit(values);
      reset();
    } catch (cause) {
      setError(`Saving the application failed: ${getErrorMessage(cause)}`);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Company" {...register("company")} error={errors.company?.message} />
        <TextField label="Job title" {...register("title")} error={errors.title?.message} />
        <TextField
          label="Job link (optional)"
          type="url"
          placeholder="https://"
          {...register("url")}
          error={errors.url?.message}
        />
        <SelectField
          label="Status"
          options={APPLICATION_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          {...register("status")}
          error={errors.status?.message}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" className="rounded-md" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
