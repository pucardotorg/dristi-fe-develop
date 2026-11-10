"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

import { useId } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { AddressFields } from "@/components/filing/address-fields";
import { FileField } from "@/components/cases/filing-form-shared";
import { RichTextField } from "@/components/cases/rich-text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  RESCHEDULE_REASONS,
  blankAddress,
  emptyAddressWithPolice,
  emptyLitigantDetails,
  emptyNamedDocument,
  emptyTypedDocument,
  emptyWitness,
  resizeSureties,
  type ApplicationDraft,
  type ApplicationErrors,
  type LitigantDetailsDraft,
  type YesNo,
} from "@/lib/cases/application-draft";
import {
  accusedAddresses,
  caseLitigants,
  type CaseLitigant,
  type PersonOption,
} from "@/lib/cases/application-options";
import {
  applicationsFile,
  submissionTypeLabel,
} from "@/lib/cases/applications";
import { formatCaseDate, type CaseRecord } from "@/lib/cases/types";
import {
  ACCUSED_ENTITY_TYPES,
  ENTITY_TYPES,
  GENDER_OPTIONS,
  policeStationsFor,
  type Option,
} from "@/lib/filing/options";
import type { Address } from "@/lib/filing/types";
import { useCourt, useCourtText } from "@/components/court/court-provider";

export type FieldActions = {
  /** Sets a draft field and clears the errors filed under it. */
  update: <Key extends keyof ApplicationDraft>(
    key: Key,
    value: ApplicationDraft[Key],
  ) => void;
  /** Sets or clears one error by its key (see `ApplicationErrors`). */
  setError: (key: string, error: string | undefined) => void;
};

type FieldsProps = {
  draft: ApplicationDraft;
  errors: ApplicationErrors;
  record: CaseRecord;
  actions: FieldActions;
  /** PRD "Every application" → Raised by. */
  raisedByOptions: PersonOption[];
  /** PRD "Every application" → Litigant, for the person in Raised by. */
  litigantOptions: PersonOption[];
};

/**
 * The fields for the selected application type, from the Application
 * Lifecycle PRD's "Fields by application type".
 *
 * Every type opens with Raised by and Litigant and closes with Application
 * details and Supporting documents — the four fields on every application. The
 * type's own fields sit between them. One column, no section headings: the
 * bail dialog set that for every filing dialog (owner, Sept 21).
 */
export function ApplicationTypeFields(props: FieldsProps) {
  const own = typeFields(props);
  if (own === undefined) return null;
  return (
    <div className="flex flex-col gap-6">
      <EveryApplicationTop {...props} />
      {own}
      <EveryApplicationBottom {...props} />
    </div>
  );
}

function typeFields(props: FieldsProps): React.ReactNode | undefined {
  switch (props.draft.type) {
    case "bail":
      return <BailFields {...props} />;
    case "edit-litigant-details":
      return <EditLitigantFields {...props} />;
    case "settlement":
      return null;
    case "transfer":
      return <TransferFields {...props} />;
    case "withdrawal":
      return null;
    case "condonation-of-delay":
      return null;
    case "application-others":
      return <GenericFields {...props} />;
    case "advancement-reschedule":
    case "postpone":
      return <RescheduleFields {...props} />;
    case "poa-change":
      return <PoaChangeFields {...props} />;
    case "production-of-documents":
      return <ProductionFields {...props} />;
    case "addition-of-witness":
      return <WitnessFields {...props} />;
    case "warrant-by-hand":
      return <WarrantByHandFields {...props} />;
    case "absent-application":
      return null;
    case "reopen-evidence":
      return null;
    case "objection":
      return <ObjectionFields {...props} />;
    default:
      return undefined;
  }
}

/* ---------------------------------------------------------------- shared -- */

/** "(optional)" the way the bail dialog sets it: regular weight, muted. */
function OptionalTag() {
  return <span className="font-normal text-muted-foreground">{<__LocalizedText id="applicationTypeFields_optional" />}</span>;
}

function FieldName({ label, optional }: { label: string; optional?: boolean }) {
  const __t = __useTranslations();
  return (
    <>
      {__t(label)}
      {optional ? (
        <>
          {" "}
          <OptionalTag />
        </>
      ) : null}
    </>
  );
}

/**
 * A value read off the case that the filer cannot change. Greyed, not the
 * yellow prefilled tint: yellow says "we filled this in, check it and change
 * it if it is wrong", and nothing here can be changed (owner, Sept 21).
 * readOnly rather than disabled so it stays keyboard reachable, selectable and
 * read by assistive tech; the fill and ink are the disabled control's.
 */
function PrefilledField({
  label,
  value: stored,
}: {
  label: string;
  value: string;
}) {
  const __t = __useTranslations();
  // Read-only, so it can show the record in the selected court's terms (`CourtSwitch`).
  const value = useCourtText()(stored);
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{__t(label)}</FieldLabel>
      <Input
        id={id}
        readOnly
        aria-readonly
        value={value}
        // The DS read-only fill is `muted`, too near the dialog's white to
        // read as locked; this is one step under it (owner, Sept 21).
        className="read-only:bg-accent read-only:text-muted-foreground focus-visible:ring-0"
      />
    </Field>
  );
}

export function TextField({
  label,
  value,
  error,
  optional,
  inputMode,
  type,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  optional?: boolean;
  inputMode?: "numeric" | "tel" | "email" | "decimal";
  type?: "email" | "tel";
  onChange: (value: string) => void;
}) {
  const __t = __useTranslations();
  const id = useId();
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>
        <FieldName label={__t(label)} optional={optional} />
      </FieldLabel>
      <Input
        id={id}
        value={value}
        type={type}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError>{__t(error)}</FieldError>
    </Field>
  );
}

function TextAreaField({
  label,
  value,
  error,
  optional,
  rows = 4,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  optional?: boolean;
  rows?: number;
  onChange: (value: string) => void;
}) {
  const __t = __useTranslations();
  const id = useId();
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>
        <FieldName label={__t(label)} optional={optional} />
      </FieldLabel>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError>{__t(error)}</FieldError>
    </Field>
  );
}

/** A single pick from a list, on the DS Select, labelled like every field. */
export function SelectField({
  label,
  value,
  options,
  placeholder,
  error,
  optional,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly Option[];
  placeholder: string;
  error?: string;
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  const __t = __useTranslations();
  const id = useId();
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>
        <FieldName label={__t(label)} optional={optional} />
      </FieldLabel>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(error)}>
          <SelectValue placeholder={__t(placeholder)} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {__t(option.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError>{__t(error)}</FieldError>
    </Field>
  );
}

function asOptions(values: readonly string[]): Option[] {
  return values.map((value) => ({ value, label: value }));
}

function peopleOptions(people: readonly PersonOption[]): Option[] {
  return people.map((person) => ({ value: person.id, label: person.name }));
}

/** Mutually exclusive answers, all visible, on the DS radio. */
function RadioField<Value extends string>({
  label,
  value,
  options,
  error,
  optional,
  onChange,
}: {
  label: string;
  value: Value | "";
  options: readonly { value: Value; label: string }[];
  error?: string;
  optional?: boolean;
  onChange: (value: Value) => void;
}) {
  const __t = __useTranslations();
  const id = useId();
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel id={`${id}-label`}>
        <FieldName label={__t(label)} optional={optional} />
      </FieldLabel>
      <RadioGroup
        aria-labelledby={`${id}-label`}
        value={value}
        onValueChange={(next) => onChange(next as Value)}
        className="flex flex-wrap gap-x-6 gap-y-1"
      >
        {options.map((option) => (
          <div key={option.value} className="flex min-h-10 items-center gap-2">
            <RadioGroupItem
              value={option.value}
              id={`${id}-${option.value}`}
              aria-invalid={Boolean(error)}
            />
            <Label htmlFor={`${id}-${option.value}`}>{__t(option.label)}</Label>
          </div>
        ))}
      </RadioGroup>
      <FieldError>{__t(error)}</FieldError>
    </Field>
  );
}

const YES_NO: { value: YesNo; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

/**
 * DatePicker takes no id or aria props, so it cannot be wired to a FieldLabel
 * the way an Input is. The group carries the label instead.
 */
function DateField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  error?: string;
  onChange: (value: Date | undefined) => void;
}) {
  const __t = __useTranslations();
  const labelId = useId();
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel id={labelId}>{__t(label)}</FieldLabel>
      <div role="group" aria-labelledby={labelId}>
        <DatePicker
          value={value}
          onValueChange={onChange}
          placeholder={__t("applicationTypeFields_pickADate")}
          className="w-full sm:w-60"
        />
      </div>
      <FieldError>{__t(error)}</FieldError>
    </Field>
  );
}

/**
 * The e-filing address composite (PRD: "uses the e-filing address
 * composite"), under one label, with one message for whatever is missing.
 */
function AddressField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: Address;
  error?: string;
  onChange: (value: Address) => void;
}) {
  const __t = __useTranslations();
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className="flex flex-col gap-3"
      data-invalid={Boolean(error) || undefined}
    >
      <p id={`${id}-label`} className="text-body-compact font-medium">
        {__t(label)}
      </p>
      <AddressFields value={value} onChange={onChange} idPrefix={id} />
      {error ? (
        <Field data-invalid>
          <FieldError>{__t(error)}</FieldError>
        </Field>
      ) : null}
    </div>
  );
}

/**
 * One entry in a repeating list — a surety, a witness, a document. A sunken
 * well per entry, as the bail dialog groups one person's fields: depth is
 * fill, never a bordered card inside the dialog.
 */
function RowWell({
  legend,
  removeLabel,
  onRemove,
  children,
}: {
  legend: string;
  /** Left out where the entry cannot be removed on its own. */
  removeLabel?: string;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  const __t = __useTranslations();
  return (
    <fieldset className="flex min-w-0 flex-col gap-6 rounded-lg bg-surface-sunken p-4">
      <div className="flex min-h-10 items-center justify-between gap-2">
        <legend className="float-left text-body font-semibold">{legend}</legend>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive-ink hover:text-destructive-ink"
            aria-label={__t(removeLabel)}
            onClick={onRemove}
          >
            <Trash2Icon aria-hidden />
          </Button>
        ) : null}
      </div>
      {children}
    </fieldset>
  );
}

/**
 * A heading over a list the filer adds to, with the add button beside it
 * while the list is empty and after the last entry once it is not
 * (owner, Oct 8).
 */
function RepeatingSection({
  heading,
  optional,
  addLabel,
  emptyLabel,
  count,
  error,
  onAdd,
  children,
}: {
  heading: string;
  optional?: boolean;
  addLabel: string;
  emptyLabel: string;
  count: number;
  error?: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const __t = __useTranslations();
  const headingId = useId();
  const addButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={count ? "self-end" : undefined}
      onClick={onAdd}
    >
      <PlusIcon data-icon="inline-start" aria-hidden />
      {__t(addLabel)}
    </Button>
  );
  return (
    <section className="flex flex-col gap-4" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id={headingId} className="text-body-compact font-medium">
            <FieldName label={__t(heading)} optional={optional} />
          </h3>
        </div>
        {count ? null : addButton}
      </div>
      {error ? (
        <Field data-invalid>
          <FieldError>{__t(error)}</FieldError>
        </Field>
      ) : null}
      {count ? (
        <div className="flex flex-col gap-6">{children}</div>
      ) : (
        <p className="text-body-compact text-muted-foreground">{__t(emptyLabel)}</p>
      )}
      {count ? addButton : null}
    </section>
  );
}

/* ---------------------------------------------------- every application -- */

/**
 * Raised by and Litigant (PRD "Every application"). Raised by is who signs
 * (ALC-28); Litigant refreshes when Raised by changes and is preselected
 * when there is only one.
 */
function EveryApplicationTop({
  draft,
  errors,
  actions,
  raisedByOptions,
  litigantOptions,
}: FieldsProps) {
  const __t = __useTranslations();
  return (
    <>
      <SelectField
        label={__t("applicationTypeFields_raisedBy")}
        value={draft.raisedById}
        options={peopleOptions(raisedByOptions)}
        placeholder={__t("applicationTypeFields_chooseWhoIsRaisingIt")}
        error={errors.fields.raisedById}
        onChange={(value) => actions.update("raisedById", value)}
      />
      <SelectField
        label={__t("applicationTypeFields_litigant")}
        value={draft.litigantId}
        options={peopleOptions(litigantOptions)}
        placeholder={
          draft.raisedById ? __t("applicationTypeFields_chooseTheLitigant") : __t("applicationTypeFields_chooseRaisedByFirst")
        }
        error={errors.fields.litigantId}
        onChange={(value) => actions.update("litigantId", value)}
      />
    </>
  );
}

/**
 * Application details and Supporting documents (PRD "Every application").
 * Application details is the one place the filer writes the application: it
 * replaced each type's reason box and the Other details box under it (owner,
 * 2026-10-28), so the form never asks for the same words twice. Required for every
 * type.
 */
function EveryApplicationBottom({ draft, errors, actions }: FieldsProps) {
  const __t = __useTranslations();
  const rows = draft.supportingDocuments;
  return (
    <>
      <ApplicationDetailsField draft={draft} errors={errors} actions={actions} />
      <RepeatingSection
        heading={__t("applicationTypeFields_supportingDocuments")}
        optional
        addLabel="Add a document"
        emptyLabel={__t("applicationTypeFields_noSupportingDocumentsAdded")}
        count={rows.length}
        onAdd={() =>
          actions.update("supportingDocuments", [...rows, emptyNamedDocument()])
        }
      >
        {rows.map((row, index) => (
          <RowWell
            key={row.id}
            legend={`Document ${index + 1}`}
            removeLabel={`Remove document ${index + 1}`}
            onRemove={() =>
              actions.update(
                "supportingDocuments",
                rows.filter((item) => item.id !== row.id),
              )
            }
          >
            <TextField
              label={__t("applicationTypeFields_documentName")}
              value={row.name}
              error={errors.fields[`${row.id}.name`]}
              onChange={(name) => {
                actions.update(
                  "supportingDocuments",
                  rows.map((item) => (item.id === row.id ? { ...item, name } : item)),
                );
                actions.setError(`${row.id}.name`, undefined);
              }}
            />
            <FileField
              required
              label={__t("applicationTypeFields_file")}
              files={row.files}
              error={errors.fields[`${row.id}.files`]}
              onFilesChange={(files) =>
                actions.update(
                  "supportingDocuments",
                  rows.map((item) => (item.id === row.id ? { ...item, files } : item)),
                )
              }
              onErrorChange={(error) => actions.setError(`${row.id}.files`, error)}
            />
          </RowWell>
        ))}
      </RepeatingSection>
    </>
  );
}

/**
 * The application in the filer's own words: the full-size editor, not a
 * dialog-sized box, because for most types this is the application.
 */
function ApplicationDetailsField({
  draft,
  errors,
  actions,
}: Pick<FieldsProps, "draft" | "errors" | "actions">) {
  const __t = __useTranslations();
  const labelId = useId();
  return (
    <Field data-invalid={Boolean(errors.fields.applicationDetails)}>
      <FieldLabel id={labelId}>
        <FieldName label={__t("applicationTypeFields_applicationDetails")} />
      </FieldLabel>
      <RichTextField
        labelId={labelId}
        value={draft.applicationDetails}
        onChange={(value) => actions.update("applicationDetails", value)}
      />
      <FieldError>{errors.fields.applicationDetails}</FieldError>
    </Field>
  );
}

/* ---------------------------------------------------------------- bail -- */

const BAIL_TYPES = [
  { value: "cash" as const, label: "Cash" },
  { value: "surety" as const, label: "Surety" },
];

function BailFields({ draft, errors, actions }: FieldsProps) {
  const __t = __useTranslations();
  const surety = draft.bailType === "surety";
  const sureties = draft.sureties;

  function updateSurety(id: string, patch: Partial<(typeof sureties)[number]>) {
    actions.update(
      "sureties",
      sureties.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    for (const key of Object.keys(patch)) actions.setError(`${id}.${key}`, undefined);
  }

  return (
    <>
      <SelectField
        label={__t("applicationTypeFields_typeOfBail")}
        value={draft.bailType}
        options={BAIL_TYPES}
        placeholder={__t("applicationTypeFields_chooseCashOrSurety")}
        error={errors.fields.bailType}
        onChange={(value) => actions.update("bailType", value as "cash" | "surety")}
      />
      {draft.bailType ? (
        <TextField
          label={__t("applicationTypeFields_bailAmountRs")}
          value={draft.bailAmount}
          inputMode="decimal"
          error={errors.fields.bailAmount}
          onChange={(value) =>
            actions.update("bailAmount", value.replace(/[^\d.,]/g, ""))
          }
        />
      ) : null}
      {surety ? (
        <>
          <TextField
            label={__t("applicationTypeFields_numberOfSureties")}
            value={draft.suretyCount}
            inputMode="numeric"
            error={errors.fields.suretyCount}
            onChange={(value) => {
              const count = value.replace(/\D/g, "").slice(0, 2);
              actions.update("suretyCount", count);
              actions.update("sureties", resizeSureties(sureties, count));
            }}
          />
          {sureties.map((item, index) => (
            <RowWell key={item.id} legend={`Surety ${index + 1}`}>
              <div className="grid gap-6 md:grid-cols-2">
                <TextField
                  label={__t("applicationTypeFields_suretyName")}
                  value={item.fullName}
                  error={errors.fields[`${item.id}.fullName`]}
                  onChange={(fullName) => updateSurety(item.id, { fullName })}
                />
                <TextField
                  label={__t("applicationTypeFields_fatherSMotherSName")}
                  value={item.parentName}
                  error={errors.fields[`${item.id}.parentName`]}
                  onChange={(parentName) => updateSurety(item.id, { parentName })}
                />
                <TextField
                  label={__t("applicationTypeFields_suretyPhoneNumber")}
                  value={item.phone}
                  inputMode="tel"
                  type="tel"
                  error={errors.fields[`${item.id}.phone`]}
                  onChange={(phone) => updateSurety(item.id, { phone })}
                />
                <TextField
                  label={__t("applicationTypeFields_suretyEmailId")}
                  optional
                  value={item.email}
                  type="email"
                  error={errors.fields[`${item.id}.email`]}
                  onChange={(email) => updateSurety(item.id, { email })}
                />
              </div>
              <AddressField
                label={__t("applicationTypeFields_suretyAddress")}
                value={item.address}
                error={errors.fields[`${item.id}.address`]}
                onChange={(address) => updateSurety(item.id, { address })}
              />
              <FileField
                required
                label={__t("applicationTypeFields_suretyIdProof")}
                files={item.identityProof}
                error={errors.fields[`${item.id}.identityProof`]}
                onFilesChange={(identityProof) => updateSurety(item.id, { identityProof })}
                onErrorChange={(error) =>
                  actions.setError(`${item.id}.identityProof`, error)
                }
              />
              <FileField
                required
                label={__t("applicationTypeFields_proofOfSolvency")}
                files={item.solvencyProof}
                error={errors.fields[`${item.id}.solvencyProof`]}
                onFilesChange={(solvencyProof) => updateSurety(item.id, { solvencyProof })}
                onErrorChange={(error) =>
                  actions.setError(`${item.id}.solvencyProof`, error)
                }
              />
            </RowWell>
          ))}
        </>
      ) : null}
    </>
  );
}

/* ------------------------------------------------ edit litigant details -- */

const LITIGANT_TYPES = [
  { value: "individual" as const, label: "Individual" },
  { value: "institution" as const, label: "Institution" },
];

/** The litigant's details as the case file holds them, for prefilling. */
export function litigantDetailsFrom(
  litigant: CaseLitigant,
  institution: boolean,
): LitigantDetailsDraft {
  const details = emptyLitigantDetails();
  if (!institution) {
    details.fullName = litigant.name;
    details.designation = litigant.designation ?? "";
    return details;
  }
  details.institutionName = litigant.name;
  const types = litigant.side === "accused" ? ACCUSED_ENTITY_TYPES : ENTITY_TYPES;
  details.institutionType =
    types.find(
      (option) =>
        option.label.toLowerCase() === litigant.entityType?.toLowerCase(),
    )?.value ?? "";
  return details;
}

function EditLitigantFields(props: FieldsProps) {
  const __t = __useTranslations();
  const { draft, errors, record, actions } = props;
  const litigants = caseLitigants(record);
  const selected = litigants.find((item) => item.id === draft.editLitigantId);

  return (
    <>
      {/* Whose details each filer may edit is a control on the workflow
          (PRD) that is not built here; every litigant on the case is
          offered until it is. */}
      <SelectField
        label={__t("applicationTypeFields_litigantToEdit")}
        value={draft.editLitigantId}
        options={litigants.map((item) => ({
          value: item.id,
          label: `${item.name} — ${item.side === "accused" ? __t("applicationTypeFields_accused") : __t("applicationTypeFields_complainant")}`,
        }))}
        placeholder={__t("applicationTypeFields_chooseALitigant")}
        error={errors.fields.editLitigantId}
        onChange={(value) => {
          const litigant = litigants.find((item) => item.id === value);
          actions.update("editLitigantId", value);
          if (!litigant) return;
          const type = litigant.institution ? "institution" : "individual";
          actions.update("litigantType", type);
          actions.update("litigant", litigantDetailsFrom(litigant, litigant.institution));
        }}
      />
      {selected ? (
        <>
          <RadioField
            label={__t("applicationTypeFields_litigantType")}
            value={draft.litigantType}
            options={LITIGANT_TYPES}
            error={errors.fields.litigantType}
            onChange={(value) => {
              actions.update("litigantType", value);
              // The other type's fields start empty (PRD).
              actions.update(
                "litigant",
                value === (selected.institution ? "institution" : "individual")
                  ? litigantDetailsFrom(selected, selected.institution)
                  : emptyLitigantDetails(),
              );
            }}
          />
          {selected.side === "complainant" ? (
            draft.litigantType === "institution" ? (
              <ComplainantInstitution {...props} />
            ) : draft.litigantType === "individual" ? (
              <ComplainantIndividual {...props} />
            ) : null
          ) : draft.litigantType ? (
            <AccusedDetails {...props} institution={draft.litigantType === "institution"} />
          ) : null}
        </>
      ) : null}
    </>
  );
}

/** One field of the litigant record, wired to `litigant.<key>`. */
function useLitigant({ draft, errors, actions }: FieldsProps) {
  const l = draft.litigant;
  function set<Key extends keyof LitigantDetailsDraft>(
    key: Key,
    value: LitigantDetailsDraft[Key],
  ) {
    actions.update("litigant", { ...l, [key]: value });
    actions.setError(`litigant.${key}`, undefined);
  }
  const error = (key: keyof LitigantDetailsDraft) => errors.fields[`litigant.${key}`];
  return { l, set, error };
}

function ComplainantIndividual(props: FieldsProps) {
  const __t = __useTranslations();
  const { l, set, error } = useLitigant(props);
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          label={__t("applicationTypeFields_phoneNumber")}
          value={l.phone}
          inputMode="tel"
          type="tel"
          error={error("phone")}
          onChange={(value) => set("phone", value)}
        />
        <TextField
          label={__t("applicationTypeFields_fullName")}
          value={l.fullName}
          error={error("fullName")}
          onChange={(value) => set("fullName", value)}
        />
        <TextField
          label={__t("applicationTypeFields_age")}
          value={l.age}
          inputMode="numeric"
          error={error("age")}
          onChange={(value) => set("age", value.replace(/\D/g, ""))}
        />
        <SelectField
          label={__t("applicationTypeFields_gender")}
          optional
          value={l.gender}
          options={GENDER_OPTIONS}
          placeholder={__t("applicationTypeFields_choose")}
          onChange={(value) => set("gender", value)}
        />
        <TextField
          label={__t("applicationTypeFields_emailId")}
          optional
          value={l.email}
          type="email"
          error={error("email")}
          onChange={(value) => set("email", value)}
        />
      </div>
      <RadioField
        label={__t("applicationTypeFields_differentlyAbled")}
        optional
        value={l.differentlyAbled}
        options={YES_NO}
        onChange={(value) => set("differentlyAbled", value)}
      />
      <AddressField
        label={__t("applicationTypeFields_permanentAddress")}
        value={l.permanentAddress}
        error={error("permanentAddress")}
        onChange={(value) => set("permanentAddress", value)}
      />
      <RadioField
        label={__t("applicationTypeFields_isTheCurrentAddressTheSameAs")}
        value={l.currentSameAsPermanent}
        options={YES_NO}
        onChange={(value) => set("currentSameAsPermanent", value)}
      />
      {l.currentSameAsPermanent === "no" ? (
        <AddressField
          label={__t("applicationTypeFields_currentAddress")}
          value={l.currentAddress}
          error={error("currentAddress")}
          onChange={(value) => set("currentAddress", value)}
        />
      ) : null}
    </>
  );
}

function ComplainantInstitution(props: FieldsProps) {
  const __t = __useTranslations();
  const { l, set, error } = useLitigant(props);
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <SelectField
          label={__t("applicationTypeFields_typeOfInstitution")}
          value={l.institutionType}
          options={ENTITY_TYPES}
          placeholder={__t("applicationTypeFields_choose")}
          error={error("institutionType")}
          onChange={(value) => set("institutionType", value)}
        />
        <TextField
          label={__t("applicationTypeFields_institutionName")}
          value={l.institutionName}
          error={error("institutionName")}
          onChange={(value) => set("institutionName", value)}
        />
        <TextField
          label={__t("applicationTypeFields_cinOrPan")}
          optional
          value={l.cinPan}
          onChange={(value) => set("cinPan", value.toUpperCase())}
        />
        <TextField
          label={__t("applicationTypeFields_phoneNumber")}
          optional
          value={l.phone}
          inputMode="tel"
          type="tel"
          error={error("phone")}
          onChange={(value) => set("phone", value)}
        />
        <TextField
          label={__t("applicationTypeFields_emailId")}
          optional
          value={l.email}
          type="email"
          error={error("email")}
          onChange={(value) => set("email", value)}
        />
      </div>
      <AddressField
        label={__t("applicationTypeFields_institutionAddress")}
        value={l.institutionAddress}
        error={error("institutionAddress")}
        onChange={(value) => set("institutionAddress", value)}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          label={__t("applicationTypeFields_authorisedRepresentativePhoneNumber")}
          value={l.repPhone}
          inputMode="tel"
          type="tel"
          error={error("repPhone")}
          onChange={(value) => set("repPhone", value)}
        />
        <TextField
          label={__t("applicationTypeFields_authorisedRepresentativeFullName")}
          value={l.repName}
          error={error("repName")}
          onChange={(value) => set("repName", value)}
        />
        <TextField
          label={__t("applicationTypeFields_authorisedRepresentativeAge")}
          value={l.repAge}
          inputMode="numeric"
          error={error("repAge")}
          onChange={(value) => set("repAge", value.replace(/\D/g, ""))}
        />
        <SelectField
          label={__t("applicationTypeFields_authorisedRepresentativeGender")}
          optional
          value={l.repGender}
          options={GENDER_OPTIONS}
          placeholder={__t("applicationTypeFields_choose")}
          onChange={(value) => set("repGender", value)}
        />
        <TextField
          label={__t("applicationTypeFields_authorisedRepresentativeEmailId")}
          optional
          value={l.repEmail}
          type="email"
          error={error("repEmail")}
          onChange={(value) => set("repEmail", value)}
        />
        <TextField
          label={__t("applicationTypeFields_authorisedRepresentativeDesignation")}
          value={l.repDesignation}
          error={error("repDesignation")}
          onChange={(value) => set("repDesignation", value)}
        />
      </div>
      <RadioField
        label={__t("applicationTypeFields_authorisedRepresentativeDifferentlyAbled")}
        optional
        value={l.repDifferentlyAbled}
        options={YES_NO}
        onChange={(value) => set("repDifferentlyAbled", value)}
      />
      <AddressField
        label={__t("applicationTypeFields_authorisedRepresentativeAddress")}
        value={l.repAddress}
        error={error("repAddress")}
        onChange={(value) => set("repAddress", value)}
      />
    </>
  );
}

function AccusedDetails(props: FieldsProps & { institution: boolean }) {
  const __t = __useTranslations();
  const { court } = useCourt();
  const { institution } = props;
  const { l, set, error } = useLitigant(props);
  const rows = l.addresses;

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        {institution ? (
          <>
            <SelectField
              label={__t("applicationTypeFields_typeOfInstitution")}
              value={l.institutionType}
              options={ACCUSED_ENTITY_TYPES}
              placeholder={__t("applicationTypeFields_choose")}
              error={error("institutionType")}
              onChange={(value) => set("institutionType", value)}
            />
            <TextField
              label={__t("applicationTypeFields_institutionName")}
              value={l.institutionName}
              error={error("institutionName")}
              onChange={(value) => set("institutionName", value)}
            />
          </>
        ) : (
          <>
            <TextField
              label={__t("applicationTypeFields_fullName")}
              value={l.fullName}
              error={error("fullName")}
              onChange={(value) => set("fullName", value)}
            />
            <TextField
              label={__t("applicationTypeFields_age")}
              optional
              value={l.age}
              inputMode="numeric"
              error={error("age")}
              onChange={(value) => set("age", value.replace(/\D/g, ""))}
            />
            <TextField
              label={__t("applicationTypeFields_designation")}
              optional
              value={l.designation}
              onChange={(value) => set("designation", value)}
            />
          </>
        )}
        <TextField
          label={__t("applicationTypeFields_mobileNumber")}
          value={l.phone}
          inputMode="tel"
          type="tel"
          error={error("phone")}
          onChange={(value) => set("phone", value)}
        />
        <TextField
          label={__t("applicationTypeFields_emailId")}
          value={l.email}
          type="email"
          error={error("email")}
          onChange={(value) => set("email", value)}
        />
      </div>
      <RepeatingSection
        heading={__t("applicationTypeFields_addresses")}
        addLabel="Add an address"
        emptyLabel={__t("applicationTypeFields_noAddressesAdded")}
        count={rows.length}
        error={error("addresses")}
        onAdd={() => set("addresses", [...rows, emptyAddressWithPolice()])}
      >
        {rows.map((row, index) => (
          <RowWell
            key={row.id}
            legend={`Address ${index + 1}`}
            removeLabel={`Remove address ${index + 1}`}
            onRemove={() =>
              set(
                "addresses",
                rows.filter((item) => item.id !== row.id),
              )
            }
          >
            <AddressField
              label={__t("applicationTypeFields_address")}
              value={row.addr}
              error={props.errors.fields[row.id]}
              onChange={(addr) => {
                set(
                  "addresses",
                  rows.map((item) => (item.id === row.id ? { ...item, addr } : item)),
                );
                props.actions.setError(row.id, undefined);
              }}
            />
            <SelectField
              label={__t("applicationTypeFields_policeStation")}
              value={row.police}
              options={asOptions(policeStationsFor(court))}
              placeholder={__t("applicationTypeFields_chooseThePoliceStation")}
              error={props.errors.fields[`${row.id}.police`]}
              onChange={(police) => {
                set(
                  "addresses",
                  rows.map((item) => (item.id === row.id ? { ...item, police } : item)),
                );
                props.actions.setError(`${row.id}.police`, undefined);
              }}
            />
          </RowWell>
        ))}
      </RepeatingSection>
    </>
  );
}

/* ------------------------------------------------------------ transfer -- */

function TransferFields({ draft, errors, record, actions }: FieldsProps) {
  const __t = __useTranslations();
  const courtText = useCourtText();
  return (
    <>
      <PrefilledField label={__t("applicationTypeFields_currentCourt")} value={courtText(record.court)} />
      <TextField
        label={__t("applicationTypeFields_requestedCourt")}
        value={draft.requestedCourt}
        error={errors.fields.requestedCourt}
        onChange={(value) => actions.update("requestedCourt", value)}
      />
    </>
  );
}

/* ------------------------------------------------------------- generic -- */

function GenericFields({ draft, errors, actions }: FieldsProps) {
  const __t = __useTranslations();
  return (
    <>
      <TextField
        label={__t("applicationTypeFields_applicationTitle")}
        value={draft.title}
        error={__t(errors.fields.title)}
        onChange={(value) => actions.update("title", value)}
      />
    </>
  );
}

/* ------------------------------------------------ advance / postpone ---- */

function RescheduleFields({ draft, errors, record, actions }: FieldsProps) {
  const __t = __useTranslations();
  const hearing = record.nextHearing;
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <PrefilledField
          label={__t("applicationTypeFields_initialHearingDate")}
          value={hearing ? formatCaseDate(hearing.on) : "No hearing is scheduled"}
        />
        <PrefilledField
          label={__t("applicationTypeFields_purposeOfHearing")}
          value={hearing?.purpose ?? "—"}
        />
      </div>
      <SelectField
        label={__t("applicationTypeFields_reasonForRescheduling")}
        value={draft.rescheduleReason}
        options={asOptions(RESCHEDULE_REASONS)}
        placeholder={__t("applicationTypeFields_chooseAReason")}
        error={errors.fields.rescheduleReason}
        onChange={(value) => actions.update("rescheduleReason", value)}
      />
      <DateField
        label={__t("applicationTypeFields_proposedHearingDate")}
        value={draft.proposedHearingDate}
        error={errors.fields.proposedHearingDate}
        onChange={(value) => actions.update("proposedHearingDate", value)}
      />
    </>
  );
}

/* ---------------------------------------------------------- poa change -- */

function PoaChangeFields({ draft, errors, record, actions }: FieldsProps) {
  const __t = __useTranslations();
  const litigants = caseLitigants(record);
  const labelId = useId();
  const chosen = litigants.filter((item) => draft.poaLitigantIds.includes(item.id));

  function toggle(id: string, checked: boolean) {
    actions.update(
      "poaLitigantIds",
      checked
        ? litigants
            .map((item) => item.id)
            .filter((item) => item === id || draft.poaLitigantIds.includes(item))
        : draft.poaLitigantIds.filter((item) => item !== id),
    );
  }

  return (
    <>
      <Field data-invalid={Boolean(errors.fields.poaLitigantIds)}>
        <FieldLabel id={labelId}>{<__LocalizedText id="applicationTypeFields_litigantsAppointingTheApplicant" />}</FieldLabel>
        <div role="group" aria-labelledby={labelId} className="flex flex-col">
          {litigants.map((item) => {
            const id = `${labelId}-${item.id}`;
            return (
              <div key={item.id} className="flex min-h-10 items-center gap-3">
                <Checkbox
                  id={id}
                  checked={draft.poaLitigantIds.includes(item.id)}
                  aria-invalid={Boolean(errors.fields.poaLitigantIds)}
                  onCheckedChange={(checked) => toggle(item.id, checked === true)}
                />
                <Label htmlFor={id} className="font-normal">
                  {item.name}
                  <span className="text-muted-foreground">
                    {" "}
                    · {item.side === "accused" ? __t("applicationTypeFields_accused") : __t("applicationTypeFields_complainant")}
                  </span>
                </Label>
              </div>
            );
          })}
        </div>
        <FieldError>{errors.fields.poaLitigantIds}</FieldError>
      </Field>
      {chosen.map((item) => (
        <FileField
          key={item.id}
          required
          label={__t("applicationTypeFields_authorizationDocumentValue0", {value0: String(item.name)})}
          files={draft.poaAuthorizations[item.id] ?? []}
          error={errors.fields[`poa.${item.id}`]}
          onFilesChange={(files) =>
            actions.update("poaAuthorizations", {
              ...draft.poaAuthorizations,
              [item.id]: files,
            })
          }
          onErrorChange={(error) => actions.setError(`poa.${item.id}`, error)}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------ production of documents -- */

function ProductionFields({ draft, errors, actions }: FieldsProps) {
  const __t = __useTranslations();
  const rows = draft.productionDocuments;
  return (
    <>
      <RepeatingSection
        heading={__t("applicationTypeFields_documents")}
        addLabel="Add a document"
        emptyLabel={__t("applicationTypeFields_noDocumentsAdded")}
        count={rows.length}
        error={errors.fields.productionDocuments}
        onAdd={() =>
          actions.update("productionDocuments", [...rows, emptyTypedDocument()])
        }
      >
        {rows.map((row, index) => (
          <RowWell
            key={row.id}
            legend={`Document ${index + 1}`}
            removeLabel={`Remove document ${index + 1}`}
            onRemove={() =>
              actions.update(
                "productionDocuments",
                rows.filter((item) => item.id !== row.id),
              )
            }
          >
            <TextField
              label={__t("applicationTypeFields_documentType")}
              value={row.type}
              error={errors.fields[`${row.id}.type`]}
              onChange={(type) => {
                actions.update(
                  "productionDocuments",
                  rows.map((item) => (item.id === row.id ? { ...item, type } : item)),
                );
                actions.setError(`${row.id}.type`, undefined);
              }}
            />
            <FileField
              required
              label={__t("applicationTypeFields_file")}
              files={row.files}
              error={errors.fields[`${row.id}.files`]}
              onFilesChange={(files) =>
                actions.update(
                  "productionDocuments",
                  rows.map((item) => (item.id === row.id ? { ...item, files } : item)),
                )
              }
              onErrorChange={(error) => actions.setError(`${row.id}.files`, error)}
            />
          </RowWell>
        ))}
      </RepeatingSection>
    </>
  );
}

/* ------------------------------------------------------ addition of witness -- */

function WitnessFields({ draft, errors, actions }: FieldsProps) {
  const __t = __useTranslations();
  const witnesses = draft.witnesses;

  function updateWitness(id: string, patch: Partial<(typeof witnesses)[number]>) {
    actions.update(
      "witnesses",
      witnesses.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    for (const key of Object.keys(patch)) actions.setError(`${id}.${key}`, undefined);
  }

  return (
    <RepeatingSection
      heading={__t("applicationTypeFields_witnesses")}
      addLabel="Add a witness"
      emptyLabel={__t("applicationTypeFields_noWitnessesAdded")}
      count={witnesses.length}
      error={errors.fields.witnesses}
      onAdd={() => actions.update("witnesses", [...witnesses, emptyWitness()])}
    >
      {witnesses.map((witness, index) => (
        <RowWell
          key={witness.id}
          legend={`Witness ${index + 1}`}
          removeLabel={`Remove witness ${index + 1}`}
          onRemove={() =>
            actions.update(
              "witnesses",
              witnesses.filter((item) => item.id !== witness.id),
            )
          }
        >
          <div className="grid gap-6 md:grid-cols-2">
            <TextField
              label={__t("applicationTypeFields_fullName")}
              optional
              value={witness.fullName}
              error={errors.fields[`${witness.id}.fullName`]}
              onChange={(fullName) => updateWitness(witness.id, { fullName })}
            />
            <TextField
              label={__t("applicationTypeFields_designation")}
              optional
              value={witness.designation}
              onChange={(designation) => {
                updateWitness(witness.id, { designation });
                actions.setError(`${witness.id}.fullName`, undefined);
              }}
            />
            <TextField
              label={__t("applicationTypeFields_age")}
              optional
              value={witness.age}
              inputMode="numeric"
              error={errors.fields[`${witness.id}.age`]}
              onChange={(age) => updateWitness(witness.id, { age: age.replace(/\D/g, "") })}
            />
            <TextField
              label={__t("applicationTypeFields_mobileNumber")}
              optional
              value={witness.mobile}
              inputMode="tel"
              type="tel"
              error={errors.fields[`${witness.id}.mobile`]}
              onChange={(mobile) => updateWitness(witness.id, { mobile })}
            />
            <TextField
              label={__t("applicationTypeFields_emailId")}
              optional
              value={witness.email}
              type="email"
              error={errors.fields[`${witness.id}.email`]}
              onChange={(email) => updateWitness(witness.id, { email })}
            />
          </div>
          <TextAreaField
            label={__t("applicationTypeFields_whatWillTheWitnessProve")}
            optional
            rows={3}
            value={witness.proves}
            onChange={(proves) => updateWitness(witness.id, { proves })}
          />
          {witness.addresses.map((row, addressIndex) => (
            <div key={row.id} className="flex flex-col gap-2">
              <AddressField
                label={
                  witness.addresses.length > 1
                    ? __t("applicationTypeFields_addressValue0", {value0: String(addressIndex + 1)})
                    : __t("applicationTypeFields_address")
                }
                value={row.addr}
                error={errors.fields[row.id]}
                onChange={(addr) => {
                  updateWitness(witness.id, {
                    addresses: witness.addresses.map((item) =>
                      item.id === row.id ? { ...item, addr } : item,
                    ),
                  });
                  actions.setError(row.id, undefined);
                }}
              />
              {witness.addresses.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start text-destructive-ink hover:text-destructive-ink"
                  onClick={() =>
                    updateWitness(witness.id, {
                      addresses: witness.addresses.filter((item) => item.id !== row.id),
                    })
                  }
                >
                  <Trash2Icon data-icon="inline-start" aria-hidden />
                  {<__LocalizedText id="applicationTypeFields_removeAddress" />}{" "}{addressIndex + 1}
                </Button>
              ) : null}
            </div>
          ))}
          <FieldError>{errors.fields[`${witness.id}.addresses`]}</FieldError>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              updateWitness(witness.id, {
                addresses: [
                  ...witness.addresses,
                  { id: `addr-${crypto.randomUUID()}`, addr: blankAddress() },
                ],
              })
            }
          >
            <PlusIcon data-icon="inline-start" aria-hidden />
            {<__LocalizedText id="applicationTypeFields_addAnotherAddress" />}{" "}</Button>
        </RowWell>
      ))}
    </RepeatingSection>
  );
}

/* ----------------------------------------------------- warrant by hand -- */

function WarrantByHandFields({ draft, errors, record, actions }: FieldsProps) {
  const __t = __useTranslations();
  const accused = caseLitigants(record).filter((item) => item.side === "accused");
  const chosen = accused.find((item) => item.id === draft.warrantAccusedId);
  const onFile = chosen ? accusedAddresses(record, chosen.name) : [];
  const pickId = useId();

  return (
    <>
      <SelectField
        label={__t("applicationTypeFields_accused")}
        value={draft.warrantAccusedId}
        options={accused.map((item) => ({ value: item.id, label: item.name }))}
        placeholder={__t("applicationTypeFields_chooseTheAccused")}
        error={errors.fields.warrantAccusedId}
        onChange={(value) => {
          actions.update("warrantAccusedId", value);
          const person = accused.find((item) => item.id === value);
          const addresses = person ? accusedAddresses(record, person.name) : [];
          actions.update("deliveryAddress", addresses[0] ?? blankAddress());
        }}
      />
      {onFile.length > 1 ? (
        <Field>
          <FieldLabel id={`${pickId}-label`}>{<__LocalizedText id="applicationTypeFields_prefillFrom" />}</FieldLabel>
          <RadioGroup
            aria-labelledby={`${pickId}-label`}
            onValueChange={(index) =>
              actions.update("deliveryAddress", onFile[Number(index)])
            }
            className="flex flex-col gap-1"
          >
            {onFile.map((address, index) => (
              <div key={index} className="flex min-h-10 items-center gap-2">
                <RadioGroupItem value={String(index)} id={`${pickId}-${index}`} />
                <Label htmlFor={`${pickId}-${index}`} className="font-normal">
                  {[address.line1, address.city, address.pin].filter(Boolean).join(", ")}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </Field>
      ) : null}
      {draft.warrantAccusedId ? (
        <AddressField
          label={__t("applicationTypeFields_addressForDelivery")}
          value={draft.deliveryAddress}
          error={errors.fields.deliveryAddress}
          onChange={(value) => actions.update("deliveryAddress", value)}
        />
      ) : null}
    </>
  );
}

/* ----------------------------------------------------------- objection -- */

/**
 * Raised from the File objection task, against one application of the other
 * side (ALC-12, ALC-24). What it objects to is fixed, so it is shown locked
 * rather than chosen.
 */
function ObjectionFields({ draft, record }: FieldsProps) {
  const __t = __useTranslations();
  const target = applicationsFile(record).submissions.find(
    (item) => item.id === draft.objectionToId,
  );
  const targetLabel = target
    ? [submissionTypeLabel(target.type), target.applicationNumber ?? target.temporaryId]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <>
      <PrefilledField
        label={__t("applicationTypeFields_objectionTo")}
        value={targetLabel}
      />
    </>
  );
}
