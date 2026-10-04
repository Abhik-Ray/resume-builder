import { CircleCheck, CircleX, Eye, EyeOff, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "../../components/ui/button";
import { SelectField, TextField } from "../../components/form/fields";
import {
  addApiKey,
  deleteApiKey,
  maskKey,
  setDefaultApiKey,
  updateApiKey,
  useApiKeys,
} from "../../db/apiKeys";
import type { ApiKeyRecord } from "../../db/db";
import { verifyProviderKey } from "../../utils/AIHealthCheck";
import { getProvider, PROVIDERS, type ProviderId } from "../../utils/providers";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

interface ApiKeyFormValues {
  label: string;
  provider: ProviderId;
  key: string;
}

// Keeps browsers and password managers from treating label/key as username/password
const NO_AUTOFILL = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

// e.g. "gemini-3f9a1"
const makeDefaultLabel = (provider: ProviderId) =>
  `${provider}-${crypto.randomUUID().slice(0, 5)}`;

const ApiKeysSection = () => {
  const keys = useApiKeys();
  // null: form closed, "new": adding, number: editing that key
  const [editing, setEditing] = useState<"new" | number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!keys) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const runAction = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const onDelete = (key: ApiKeyRecord) => {
    if (!window.confirm(`Delete the key “${key.label}”?`)) return;
    if (editing === key.id) setEditing(null);
    runAction(() => deleteApiKey(key.id));
  };

  const editingKey = typeof editing === "number" ? keys.find((k) => k.id === editing) : undefined;
  // The key being edited is shown only in its form, not also in the list
  const listedKeys = keys.filter((k) => k.id !== editing);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="text-base font-semibold">API keys</h2>
          <p className="text-xs text-muted-foreground">
            Keys are stored only in this browser (IndexedDB) and sent only to their provider.
          </p>
        </div>
        {editing === null && (
          <Button className="rounded-md" onClick={() => setEditing("new")}>
            <Plus /> Add key
          </Button>
        )}
      </div>

      {actionError && (
        <p className="rounded-md border border-red-600 bg-red-50 p-2 text-xs text-red-600">
          {actionError}
        </p>
      )}

      {editing !== null && (
        <ApiKeyForm
          // Remount so the form picks up the key being edited
          key={editing}
          initial={editingKey}
          otherLabels={keys
            .filter((k) => k.id !== editing)
            .map((k) => k.label.toLowerCase())}
          onDone={() => setEditing(null)}
        />
      )}

      {listedKeys.length === 0 ? (
        editing === null && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No keys yet. Add a Gemini key to start reviewing jobs.
          </p>
        )
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {listedKeys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="mr-auto flex min-w-0 flex-col">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {key.label}
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {getProvider(key.provider).label}
                  </span>
                  {key.isDefault && (
                    <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] uppercase text-primary-foreground">
                      Default
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{maskKey(key.key)}</span>
              </div>
              {!key.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-md"
                  onClick={() => runAction(() => setDefaultApiKey(key.id))}
                >
                  <Star /> Set default
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${key.label}`}
                onClick={() => setEditing(key.id)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${key.label}`}
                onClick={() => onDelete(key)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ApiKeysSection;

interface ApiKeyFormProps {
  initial?: ApiKeyRecord;
  otherLabels: string[];
  onDone: () => void;
}

const ApiKeyForm = ({ initial, otherLabels, onDone }: ApiKeyFormProps) => {
  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ApiKeyFormValues>({
    defaultValues: {
      label: initial?.label ?? makeDefaultLabel("gemini"),
      provider: initial?.provider ?? "gemini",
      key: initial?.key ?? "",
    },
    mode: "onTouched",
  });
  const [showKey, setShowKey] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    message: string;
    reason?: string;
  } | null>(null);

  // Cleared whenever the key or provider changes, so a pass always matches the current input
  const clearVerification = () => setVerifyResult(null);

  const runHealthCheck = async (provider: ProviderId, key: string) => {
    setVerifyResult(null);
    setIsVerifying(true);
    try {
      const result = await verifyProviderKey(provider, key);
      const providerLabel = getProvider(provider).label;
      const outcome = result.valid
        ? { valid: true, message: `${providerLabel} accepted this key` }
        : {
            valid: false,
            message: `${providerLabel} rejected this key or couldn't be reached`,
            reason: result.reason,
          };
      setVerifyResult(outcome);
      return outcome.valid;
    } catch (error) {
      setVerifyResult({
        valid: false,
        message: "Couldn't check the key",
        reason: getErrorMessage(error),
      });
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  const onVerify = async () => {
    if (!(await trigger("key"))) return;
    const { provider, key } = getValues();
    await runHealthCheck(provider, key.trim());
  };

  const onSubmit = handleSubmit(async ({ label, provider, key }) => {
    setSaveError(null);
    const values = { label: label.trim(), provider, key: key.trim() };
    const unchangedKey = initial?.key === values.key && initial.provider === provider;
    // Check the key before saving; on failure stay on the form so it can be fixed
    if (!unchangedKey && !verifyResult?.valid && !(await runHealthCheck(provider, values.key))) {
      return;
    }
    try {
      if (initial) await updateApiKey(initial.id, values);
      else await addApiKey(values);
      onDone();
    } catch (error) {
      setSaveError(`Save failed: ${getErrorMessage(error)}`);
    }
  });

  const isBusy = isVerifying || isSubmitting;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      autoComplete="off"
      data-form-type="other"
      className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4"
    >
      <h3 className="text-sm font-semibold">{initial ? "Edit key" : "Add key"}</h3>
      <fieldset disabled={isBusy} className="flex flex-col gap-4 disabled:opacity-70">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Label"
            {...NO_AUTOFILL}
            {...register("label", {
              validate: (value) => {
                const label = value.trim();
                if (!label) return "Label is required";
                if (label.length > 50) return "Label must be at most 50 characters";
                if (otherLabels.includes(label.toLowerCase())) {
                  return "A key with this label already exists";
                }
                return true;
              },
            })}
            error={errors.label?.message}
          />
          <SelectField
            label="Provider"
            options={PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
            {...register("provider", { onChange: clearVerification })}
            error={errors.provider?.message}
          />
        </div>
        <div className="flex items-start gap-2">
          <TextField
            className="flex-1"
            label="API key"
            // Not type="password": that makes browsers treat the form as a login.
            // The key is masked with CSS instead.
            type="text"
            inputClassName={showKey ? undefined : "[-webkit-text-security:disc]"}
            {...NO_AUTOFILL}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            {...register("key", {
              validate: (value) => !!value.trim() || "Key is required",
              onChange: clearVerification,
            })}
            error={errors.key?.message}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-5"
            aria-label={showKey ? "Hide key" : "Show key"}
            onClick={() => setShowKey((v) => !v)}
          >
            {showKey ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </fieldset>

      <div aria-live="polite">
        {isVerifying && (
          <p className="flex items-center gap-2 rounded-md border bg-background p-2 text-xs animate-in fade-in">
            <Loader2 className="size-4 animate-spin text-chart-2" />
            <span className="animate-pulse">
              Checking the key with {getProvider(getValues("provider")).label}…
            </span>
          </p>
        )}
        {!isVerifying && verifyResult && (
          <div
            className={
              verifyResult.valid
                ? "flex items-start gap-2 rounded-md border border-green-600 bg-green-50 p-2 text-xs text-green-700 animate-in fade-in"
                : "flex items-start gap-2 rounded-md border border-red-600 bg-red-50 p-2 text-xs text-red-600 animate-in fade-in"
            }
          >
            {verifyResult.valid ? (
              <CircleCheck className="size-4 shrink-0" />
            ) : (
              <CircleX className="size-4 shrink-0" />
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{verifyResult.message}</span>
              {verifyResult.reason && (
                <span className="line-clamp-3 break-words opacity-80">{verifyResult.reason}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" className="rounded-md" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-md"
          onClick={onVerify}
          disabled={isBusy}
        >
          Verify
        </Button>
        <Button type="submit" className="rounded-md" disabled={isBusy}>
          {isBusy && <Loader2 className="animate-spin" />}
          {isVerifying ? "Verifying…" : initial ? "Save changes" : "Add key"}
        </Button>
      </div>
    </form>
  );
};
