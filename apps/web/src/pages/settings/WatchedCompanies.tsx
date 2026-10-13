import { zodResolver } from "@hookform/resolvers/zod";
import {
  BOARD_PROVIDER_LABELS,
  BOARD_PROVIDERS,
  watchedCompanySchema,
  type WatchedCompanyFormValues,
  type WatchedCompanyInput,
  type WatchedCompanyRow,
} from "@resume-builder/shared";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { SelectField, TextField } from "../../components/form/fields";
import { Button } from "../../components/ui/button";
import { useUnwatchCompany, useWatchCompany, useWatchedCompanies } from "../../db/watchedCompanies";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const boardUrl = (row: Pick<WatchedCompanyRow, "provider" | "board">) =>
  row.provider === "greenhouse"
    ? `https://boards.greenhouse.io/${row.board}`
    : `https://jobs.lever.co/${row.board}`;

// Optional: companies whose public Greenhouse or Lever board the job sync checks every morning
export const WatchedCompanies = () => {
  const companies = useWatchedCompanies();
  const watch = useWatchCompany();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WatchedCompanyFormValues, unknown, WatchedCompanyInput>({
    resolver: zodResolver(watchedCompanySchema),
    defaultValues: { name: "", provider: "greenhouse", board: "" },
  });
  const [error, setError] = useState<string | null>(null);

  const submit = handleSubmit(async (input) => {
    setError(null);
    try {
      await watch.mutateAsync(input);
      reset();
    } catch (cause) {
      setError(`Couldn't add the company: ${getErrorMessage(cause)}`);
    }
  });

  return (
    <section aria-labelledby="watched-heading" className="flex flex-col gap-3 border-t pt-4">
      <div>
        <h3 id="watched-heading" className="text-xl font-bold tracking-tight">
          Watched companies
        </h3>
        <p className="text-xs text-muted-foreground">
          Optional. Their open roles are matched against your searches above, near home or remote.
        </p>
      </div>
      {companies.isPending ? (
        <Loader2 className="animate-spin" aria-label="Loading" />
      ) : companies.isError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn't load watched companies: {getErrorMessage(companies.error)}
        </p>
      ) : (
        companies.data.length > 0 && (
          <ul className="flex flex-col gap-2">
            {companies.data.map((company) => (
              <WatchedCompanyItem key={company.id} company={company} />
            ))}
          </ul>
        )
      )}
      <form
        onSubmit={submit}
        noValidate
        aria-label="Watch a company"
        className="grid items-start gap-3 sm:grid-cols-[1fr_10rem_1fr_auto]"
      >
        <TextField label="Company" {...register("name")} error={errors.name?.message} />
        <SelectField
          label="Job board"
          options={BOARD_PROVIDERS.map((p) => ({ value: p, label: BOARD_PROVIDER_LABELS[p] }))}
          {...register("provider")}
        />
        <TextField
          label="Board URL or name"
          placeholder="boards.greenhouse.io/acme"
          {...register("board")}
          error={errors.board?.message}
        />
        <Button type="submit" variant="outline" className="rounded-md sm:mt-5" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : <Plus />} Watch
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
};

const WatchedCompanyItem = ({ company }: { company: WatchedCompanyRow }) => {
  const unwatch = useUnwatchCompany();
  const [error, setError] = useState<string | null>(null);

  const onRemove = async () => {
    setError(null);
    try {
      await unwatch.mutateAsync(company.id);
    } catch (cause) {
      setError(`Couldn't remove it: ${getErrorMessage(cause)}`);
    }
  };

  return (
    <li className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <span className="mr-auto">
        <span className="font-medium">{company.name}</span>{" "}
        <a href={boardUrl(company)} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline">
          {BOARD_PROVIDER_LABELS[company.provider as keyof typeof BOARD_PROVIDER_LABELS]} board
        </a>
        {error && (
          <span role="alert" className="block text-xs text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Stop watching ${company.name}`}
        onClick={onRemove}
        disabled={unwatch.isPending}
      >
        <Trash2 />
      </Button>
    </li>
  );
};
