import { zodResolver } from "@hookform/resolvers/zod";
import {
  searchProfileSchema,
  toSearchProfileFormValues,
  type SearchProfileFormValues,
  type SearchProfileInput,
  type SearchProfileRow,
} from "@resume-builder/shared";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { CheckboxField, TextField } from "../../components/form/fields";
import { StringListField } from "../../components/form/StringListField";
import { Button } from "../../components/ui/button";
import { useProfile } from "../../db/profile";
import {
  useDeleteSearchProfile,
  useSaveSearchProfile,
  useSearchProfiles,
} from "../../db/searchProfiles";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

// Saved searches the daily job sync runs, near the home location by default
const JobSearchesSection = () => {
  const searches = useSearchProfiles();
  const profile = useProfile();
  // null: list; "new": adding; an id: editing that search
  const [editing, setEditing] = useState<string | null>(null);
  const home = profile.data?.home_city
    ? `${profile.data.home_city}, ${profile.data.home_country ?? ""}`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <div className="mr-auto">
          <h2 className="text-2xl font-bold tracking-tight">Job searches</h2>
          <p className="text-xs text-muted-foreground">
            Searched every morning near{" "}
            {home ?? (
              <Link to="/settings/resume-data" className="underline">
                your home location
              </Link>
            )}
            {profile.data?.include_remote && ", plus remote jobs"}. New matches appear on the Jobs page.
          </p>
        </div>
        {editing === null && (
          <Button className="rounded-md" onClick={() => setEditing("new")}>
            <Plus /> Add search
          </Button>
        )}
      </div>

      {editing === "new" && (
        <SearchForm onDone={() => setEditing(null)} />
      )}

      {searches.isPending ? (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin" aria-label="Loading" />
        </div>
      ) : searches.isError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn't load your searches: {getErrorMessage(searches.error)}
        </p>
      ) : searches.data.length === 0 && editing !== "new" ? (
        <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No searches yet. Add one with the keywords you look for, such as "React" and "TypeScript".
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {searches.data.map((search) =>
            editing === search.id ? (
              <li key={search.id}>
                <SearchForm search={search} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <SearchItem key={search.id} search={search} onEdit={() => setEditing(search.id)} />
            ),
          )}
        </ul>
      )}
    </div>
  );
};

export default JobSearchesSection;

const SearchItem = ({ search, onEdit }: { search: SearchProfileRow; onEdit: () => void }) => {
  const remove = useDeleteSearchProfile();
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    if (!window.confirm(`Delete the search "${search.name}"? Its matches stay on the Jobs page.`)) return;
    setError(null);
    try {
      await remove.mutateAsync(search.id);
    } catch (cause) {
      setError(`Delete failed: ${getErrorMessage(cause)}`);
    }
  };

  return (
    <li className="flex flex-wrap items-start gap-2 rounded-lg border p-4">
      <div className="mr-auto flex flex-col gap-1">
        <span className="font-semibold">
          {search.name}
          {!search.active && <span className="ml-2 text-xs font-normal text-muted-foreground">Paused</span>}
        </span>
        <span className="text-xs text-muted-foreground">
          {search.keywords.join(", ")}
          {search.exclude_keywords.length > 0 && ` · not ${search.exclude_keywords.join(", ")}`}
          {" · "}
          {search.remote_only ? "remote only" : (search.location_override ?? "home city")}
          {` · min score ${search.min_score}`}
        </span>
        {error && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${search.name}`} onClick={onEdit}>
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${search.name}`}
        onClick={onDelete}
        disabled={remove.isPending}
      >
        <Trash2 />
      </Button>
    </li>
  );
};

const SearchForm = ({ search, onDone }: { search?: SearchProfileRow; onDone: () => void }) => {
  const save = useSaveSearchProfile();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SearchProfileFormValues, unknown, SearchProfileInput>({
    resolver: zodResolver(searchProfileSchema),
    defaultValues: toSearchProfileFormValues(search),
  });
  const [error, setError] = useState<string | null>(null);

  const submit = handleSubmit(async (input) => {
    setError(null);
    try {
      await save.mutateAsync({ id: search?.id, input });
      onDone();
    } catch (cause) {
      setError(`Save failed: ${getErrorMessage(cause)}`);
    }
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={search ? `Edit ${search.name}` : "New search"}
      className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4"
    >
      <TextField label="Search name" {...register("name")} error={errors.name?.message} />
      <StringListField control={control} name="keywords" label="Keywords" addLabel="Add keyword" />
      <StringListField
        control={control}
        name="excludeKeywords"
        label="Exclude jobs mentioning"
        addLabel="Add exclusion"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="City (optional)"
          placeholder="Leave empty for your home city"
          {...register("locationOverride")}
          error={errors.locationOverride?.message}
        />
        <TextField
          label="Minimum score"
          type="number"
          min={1}
          max={100}
          hint="3 points per keyword in the title, 1 in the description"
          {...register("minScore", { valueAsNumber: true })}
          error={errors.minScore?.message}
        />
      </div>
      <CheckboxField label="Remote jobs only" {...register("remoteOnly")} />
      <CheckboxField label="Active (run every morning)" {...register("active")} />
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="rounded-md" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="rounded-md" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Save search
        </Button>
      </div>
    </form>
  );
};
