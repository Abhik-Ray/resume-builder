import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { useBlocker } from "react-router";
import type { z } from "zod";
import { Button } from "../../components/ui/button";
import {
  CheckboxField,
  FieldError,
  SelectField,
  TextAreaField,
  TextField,
} from "../../components/form/fields";
import { StringListField } from "../../components/form/StringListField";
import { resetResumeData, saveResumeData, useResumeData } from "../../db/resumeData";
import type { ResumeDataType } from "../../types/input";
import {
  resumeDataSchema,
  toFormValues,
  WORK_MODELS,
  type ResumeFormValues,
} from "./resumeDataSchema";

type ResumeForm = UseFormReturn<ResumeFormValues, unknown, z.output<typeof resumeDataSchema>>;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const ResumeDataSection = () => {
  const resume = useResumeData();
  if (!resume) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  return <ResumeDataForm data={resume.data} isCustom={resume.isCustom} />;
};

export default ResumeDataSection;

// Components that use the form opt out of the React Compiler ("use no memo"). It memoizes
// register() calls because the form object never changes, but react-hook-form forgets its fields
// on every reset and needs inputs to register again on the next render. With memoization,
// "Discard changes" and "Reset to defaults" blanked the inputs and some errors never showed.
const ResumeDataForm = ({ data, isCustom }: { data: ResumeDataType; isCustom: boolean }) => {
  "use no memo";
  const form = useForm({
    resolver: zodResolver(resumeDataSchema),
    // Re-syncs the form when the saved data changes (save, reset to defaults)
    values: toFormValues(data),
    mode: "onChange",
  });
  const {
    handleSubmit,
    reset,
    formState: { isDirty, isValid, isSubmitting },
  } = form;
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [isResetting, setIsResetting] = useState(false);

  // Warn before leaving the page with unsaved edits
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("You have unsaved changes. Leave anyway?")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  const onSubmit = handleSubmit(async (values) => {
    setStatus(null);
    try {
      await saveResumeData(values);
      setStatus({ type: "success", message: "Resume data saved" });
    } catch (error) {
      setStatus({ type: "error", message: `Save failed: ${getErrorMessage(error)}` });
    }
  });

  const onResetDefaults = async () => {
    if (!window.confirm("Replace your resume data with the built-in defaults?")) return;
    setStatus(null);
    setIsResetting(true);
    try {
      await resetResumeData();
      setStatus({ type: "success", message: "Restored the default resume data" });
    } catch (error) {
      setStatus({ type: "error", message: `Reset failed: ${getErrorMessage(error)}` });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background py-3">
        <div className="mr-auto">
          <h2 className="text-2xl font-bold tracking-tight">Resume data</h2>
          <p className="text-xs text-muted-foreground">
            {isCustom ? "Using your saved data" : "Using the built-in defaults"}
            {isDirty && " · unsaved changes"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="rounded-md"
          onClick={() => reset()}
          disabled={!isDirty || isSubmitting}
        >
          Discard changes
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="rounded-md"
          onClick={onResetDefaults}
          disabled={!isCustom || isResetting || isSubmitting}
        >
          Reset to defaults
        </Button>
        <Button
          type="submit"
          className="rounded-md"
          disabled={!isDirty || !isValid || isSubmitting}
        >
          {isSubmitting && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </div>
      {status && (
        <p
          role="status"
          className={
            status.type === "success"
              ? "rounded-md border border-green-600 bg-green-50 p-2 text-xs text-green-700 dark:border-green-500/60 dark:bg-green-950/40 dark:text-green-400"
              : "rounded-md border border-red-600 bg-red-50 p-2 text-xs text-red-600 dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-400"
          }
        >
          {status.message}
        </p>
      )}

      <ProfileSection form={form} />
      <CareerSection form={form} />
      <SkillsSection form={form} />
      <ExperienceSection form={form} />
      <PreferencesSection form={form} />
    </form>
  );
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <details open className="group rounded-lg border">
    <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
      <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      <ChevronDown className="size-5 transition-transform group-open:rotate-180" />
    </summary>
    <div className="flex flex-col gap-4 border-t px-4 py-4">{children}</div>
  </details>
);

const ProfileSection = ({ form }: { form: ResumeForm }) => {
  "use no memo"; // see the note above ResumeDataForm
  const {
    register,
    control,
    formState: { errors },
  } = form;
  return (
    <Section title="Profile">
      <TextField label="Name" {...register("profile.name")} error={errors.profile?.name?.message} />
      <StringListField
        control={control}
        name="profile.contacts"
        label="Contacts"
        placeholder="Email, phone, location or URL"
        addLabel="Add contact"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Institute"
          {...register("profile.education.institute")}
          error={errors.profile?.education?.institute?.message}
        />
        <TextField
          label="Degree"
          {...register("profile.education.degree")}
          error={errors.profile?.education?.degree?.message}
        />
        <TextField
          label="Field"
          {...register("profile.education.field")}
          error={errors.profile?.education?.field?.message}
        />
      </div>
    </Section>
  );
};

const CareerSection = ({ form }: { form: ResumeForm }) => {
  "use no memo"; // see the note above ResumeDataForm
  const {
    register,
    formState: { errors },
  } = form;
  return (
    <Section title="Career">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Current role"
          {...register("currentRole")}
          error={errors.currentRole?.message}
        />
        <TextField
          label="Years of experience"
          inputMode="decimal"
          {...register("yearsOfExperience")}
          error={errors.yearsOfExperience?.message}
        />
      </div>
      <CheckboxField label="Require remote roles" {...register("requireRemote")} />
      <TextAreaField
        label="Default summary"
        hint="Shown in the PDF until the AI writes a tailored one"
        {...register("summary")}
        error={errors.summary?.message}
      />
    </Section>
  );
};

const SkillsSection = ({ form }: { form: ResumeForm }) => (
  <Section title="Skills">
    <StringListField
      control={form.control}
      name="hardSkills"
      label="Hard skills (given to the AI)"
      addLabel="Add skill"
    />
    <StringListField
      control={form.control}
      name="featuredSkills"
      label="Featured skills (shown in the PDF before generation)"
      addLabel="Add skill"
    />
  </Section>
);

const ExperienceSection = ({ form }: { form: ResumeForm }) => {
  "use no memo"; // see the note above ResumeDataForm
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "experience" });
  const listError = form.formState.errors.experience;
  return (
    <Section title="Experience">
      {fields.map((field, index) => (
        <PositionFields key={field.id} form={form} index={index} onRemove={() => remove(index)} />
      ))}
      <FieldError message={listError?.message ?? listError?.root?.message} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit rounded-md"
        onClick={() =>
          append({
            companyName: "",
            position: "",
            range: "",
            bullets: [""],
            canTweak: false,
            projects: [],
          })
        }
      >
        <Plus /> Add position
      </Button>
    </Section>
  );
};

interface PositionFieldsProps {
  form: ResumeForm;
  index: number;
  onRemove: () => void;
}

const PositionFields = ({ form, index, onRemove }: PositionFieldsProps) => {
  "use no memo"; // see the note above ResumeDataForm
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const projects = useFieldArray({ control, name: `experience.${index}.projects` });
  const positionErrors = errors.experience?.[index];

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Position {index + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove position ${index + 1}`}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          label="Company"
          {...register(`experience.${index}.companyName`)}
          error={positionErrors?.companyName?.message}
        />
        <TextField
          label="Position"
          {...register(`experience.${index}.position`)}
          error={positionErrors?.position?.message}
        />
        <TextField
          label="Date range"
          placeholder="2022 - Present"
          {...register(`experience.${index}.range`)}
          error={positionErrors?.range?.message}
        />
      </div>
      <CheckboxField
        label="Let the AI rewrite these bullets for each job"
        {...register(`experience.${index}.canTweak`, {
          // Re-check every position so the "only one" error clears on the other box too
          deps: ["experience"],
        })}
        error={positionErrors?.canTweak?.message}
      />
      <StringListField
        control={control}
        name={`experience.${index}.bullets`}
        label="Bullets"
        addLabel="Add bullet"
        multiline
      />
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Projects (raw history the AI draws from)
        </span>
        {projects.fields.map((project, projectIndex) => (
          <div key={project.id} className="flex flex-col gap-2 rounded-md border bg-background p-3">
            <div className="flex items-end gap-2">
              <TextField
                className="flex-1"
                label="Project name"
                {...register(`experience.${index}.projects.${projectIndex}.projectName`)}
                error={positionErrors?.projects?.[projectIndex]?.projectName?.message}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove project ${projectIndex + 1}`}
                onClick={() => projects.remove(projectIndex)}
              >
                <Trash2 />
              </Button>
            </div>
            <StringListField
              control={control}
              name={`experience.${index}.projects.${projectIndex}.tasks`}
              label="Tasks"
              addLabel="Add task"
              multiline
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit rounded-md"
          onClick={() => projects.append({ projectName: "", tasks: [""] })}
        >
          <Plus /> Add project
        </Button>
      </div>
    </div>
  );
};

const PreferencesSection = ({ form }: { form: ResumeForm }) => {
  "use no memo"; // see the note above ResumeDataForm
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const prefErrors = errors.jobPreferences;
  return (
    <Section title="Job preferences">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Preferred work model"
          options={WORK_MODELS.map((m) => ({ value: m, label: m }))}
          {...register("jobPreferences.preferredWorkModel")}
          error={prefErrors?.preferredWorkModel?.message}
        />
        <TextField
          label="Target salary (optional)"
          {...register("jobPreferences.targetSalary")}
          error={prefErrors?.targetSalary?.message}
        />
      </div>
      <StringListField
        control={control}
        name="jobPreferences.desiredRoles"
        label="Desired roles"
        addLabel="Add role"
      />
      <StringListField
        control={control}
        name="jobPreferences.coreTechStack"
        label="Core tech stack"
        addLabel="Add technology"
      />
      <StringListField
        control={control}
        name="jobPreferences.dealBreakers"
        label="Deal breakers"
        addLabel="Add deal breaker"
      />
      <TextAreaField
        label="Career goals"
        {...register("jobPreferences.careerGoals")}
        error={prefErrors?.careerGoals?.message}
      />
    </Section>
  );
};
