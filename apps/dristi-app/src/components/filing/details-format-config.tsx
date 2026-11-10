"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

/**
 * Additional details formats (`/filings/formats`): the texts a filer can start "Any
 * additional details" from, and what each `[variable]` in them is filled with.
 *
 * Laid out as the magistrate's order template configuration — formats on the left, the
 * selected one's text and variables on the right — with one addition: each variable is
 * mapped to a field of the e-filing form, or left for the filer to write. Changes save as
 * they are made, in this browser (`lib/filing/details-formats.ts`).
 */

import * as React from "react";
import { CopyIcon, FileTextIcon, PlusIcon, TrashIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { DETAIL_FIELD_GROUPS, bracketsIn } from "@/lib/filing/detail-fields";
import {
  FILER_WRITES,
  mappedByHand,
  mappedField,
  newFormatId,
  readDetailsFormats,
  removeDetailsFormat,
  saveDetailsFormat,
  setDefaultFormat,
  serverDetailsFormats,
  subscribeToDetailsFormats,
  type DetailsFormat,
} from "@/lib/filing/details-formats";
import { getStep } from "@/lib/filing/steps";
import {
  PAGE_GROUND,
  PAGE_GUTTER,
  PAGE_SUBTITLE,
  PAGE_TITLE,
} from "@/components/shell/page-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { DetailFieldMenu } from "@/components/filing/detail-field-menu";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "@/components/filing/rich-text-editor";

const SECTION_LABEL =
  "text-caption font-bold uppercase tracking-wider text-muted-foreground";

function Dot({ filled }: { filled: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        filled ? "bg-success-muted-foreground" : "bg-warning-muted-foreground",
      )}
    />
  );
}

function VariableLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-caption text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Dot filled />
        {<__LocalizedText id="detailsFormatConfig_filledFromTheEFilingForm" />}{" "}</span>
      <span className="flex items-center gap-1.5">
        <Dot filled={false} />
        {<__LocalizedText id="detailsFormatConfig_filerWrites" />}{" "}</span>
    </div>
  );
}

/** Each variable in the text, and the field it is filled with. */
function VariableMappings({
  format,
  onMap,
}: {
  format: DetailsFormat;
  onMap: (variable: string, mapping: string) => void;
}) {
  const __t = __useTranslations();
  const variables = bracketsIn(format.html);

  if (!variables.length) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center text-body-compact text-muted-foreground italic">
        {<__LocalizedText id="detailsFormatConfig_noVariablesInTheFormatText" />}{" "}</div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {variables.map((variable) => {
        const field = mappedField(format, variable);
        const byName = field && !mappedByHand(format, variable);
        return (
          <div
            key={variable}
            className="flex flex-col gap-2 rounded-md border border-hairline bg-card px-3 py-2 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Dot filled={!!field} />
              <span className="min-w-0 font-mono text-caption font-medium break-words">
                {variable}
              </span>
              {byName ? (
                <span className="shrink-0 text-caption text-muted-foreground">
                  {<__LocalizedText id="detailsFormatConfig_matchedByName" />}{" "}</span>
              ) : null}
            </div>
            <Select
              value={field?.name ?? FILER_WRITES}
              onValueChange={(mapping) => onMap(variable, mapping)}
            >
              <SelectTrigger
                className="w-full sm:w-64"
                aria-label={__t("detailsFormatConfig_whatFillsValue0", {value0: String(variable)})}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILER_WRITES}>{<__LocalizedText id="detailsFormatConfig_filerWrites" />}</SelectItem>
                <SelectSeparator />
                {DETAIL_FIELD_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{__t(group.label)}</SelectLabel>
                    {group.fields.map((f) => (
                      <SelectItem key={f.name} value={f.name}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}

function FormatEditor({
  format,
  onDuplicate,
  onDelete,
}: {
  format: DetailsFormat;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const __t = __useTranslations();
  const editor = React.useRef<RichTextEditorHandle>(null);
  const update = (patch: Partial<DetailsFormat>) => saveDetailsFormat({ ...format, ...patch });

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-6 md:p-8">
        <Input
          value={format.name}
          onChange={(e) => update({ name: e.target.value })}
          className="text-title font-semibold"
          aria-label={__t("detailsFormatConfig_formatName")}
        />

        <div className="flex items-start gap-3 rounded-lg border border-hairline bg-surface-sunken p-3">
          <Switch
            id={`default-${format.id}`}
            checked={!!format.isDefault}
            onCheckedChange={(on) => setDefaultFormat(on ? format.id : null)}
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`default-${format.id}`} className="text-body-compact font-medium">
              {<__LocalizedText id="detailsFormatConfig_useAsTheDefaultFormat" />}{" "}</Label>
            <p className="text-caption text-muted-foreground">
              {<__LocalizedText id="detailsFormatConfig_aFilingWhoseAdditionalDetailsAreEmpty" />}{" "}</p>
          </div>
        </div>

        <section className="flex flex-col gap-2">
          <Label className={SECTION_LABEL}>{<__LocalizedText id="detailsFormatConfig_formatText" />}</Label>
          <RichTextEditor
            value={format.html}
            onChange={(html) => update({ html })}
            ariaLabel="Format text"
            placeholder={__t("detailsFormatConfig_theTextTheFilerStartsFromUse")}
            minHeightClassName="min-h-96"
            handleRef={editor}
            toolbarEnd={
              <DetailFieldMenu
                label={__t("detailsFormatConfig_insertVariable")}
                onPick={(field) => editor.current?.insertText(`[${field.name}]`)}
                describe={(field) => getStep(field.step).title}
              />
            }
          />
          <p className="text-caption text-muted-foreground">
            {<__LocalizedText id="detailsFormatConfig_writeAnyNameInBracketsForA" />}{" "}</p>
        </section>

        <VariableLegend />

        <section className="flex flex-col gap-2">
          <Label className={SECTION_LABEL}>{<__LocalizedText id="detailsFormatConfig_variables" />}</Label>
          <p className="text-caption text-muted-foreground">
            {<__LocalizedText id="detailsFormatConfig_chooseTheEFilingFieldThatFills" />}{" "}</p>
          <VariableMappings
            format={format}
            onMap={(variable, mapping) =>
              update({ mappings: { ...format.mappings, [variable]: mapping } })
            }
          />
        </section>

        <Separator />

        <div className="flex items-center gap-2">
          <span className="text-caption text-muted-foreground">
            {<__LocalizedText id="detailsFormatConfig_changesSaveAsYouMakeThemIn" />}{" "}</span>
          <span className="flex-1" />
          <Button type="button" variant="outline" size="sm" onClick={onDuplicate}>
            <CopyIcon data-icon="inline-start" aria-hidden />
            {<__LocalizedText id="detailsFormatConfig_duplicate" />}{" "}</Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:bg-destructive-muted"
          >
            <TrashIcon data-icon="inline-start" aria-hidden />
            {<__LocalizedText id="detailsFormatConfig_delete" />}{" "}</Button>
        </div>
      </div>
    </ScrollArea>
  );
}

export function DetailsFormatsScreen() {
  return (
    <div className={cn("flex w-full flex-1 flex-col gap-6", PAGE_GROUND, PAGE_GUTTER)}>
      <header className="flex flex-col gap-1">
        <h1 className={cn(PAGE_TITLE, "text-foreground")}>{<__LocalizedText id="detailsFormatConfig_additionalDetailsFormats" />}</h1>
        <p className={PAGE_SUBTITLE}>
          {<__LocalizedText id="detailsFormatConfig_theTextsAFilingCanStartAny" />}{" "}</p>
      </header>
      <DetailsFormatConfig />
    </div>
  );
}

function DetailsFormatConfig() {
  const __t = __useTranslations();
  const formats = React.useSyncExternalStore(
    subscribeToDetailsFormats,
    readDetailsFormats,
    serverDetailsFormats,
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = formats.find((f) => f.id === selectedId) ?? formats[0] ?? null;

  function add(format: Omit<DetailsFormat, "id">) {
    const id = newFormatId();
    saveDetailsFormat({ ...format, id });
    setSelectedId(id);
  }

  return (
    <Card className="flex min-h-0 flex-1 overflow-hidden border-hairline shadow-raised">
      <CardContent className="flex min-h-0 flex-1 flex-col p-0 md:flex-row">
        <div className="flex min-h-0 w-full flex-col border-b border-hairline md:w-60 md:shrink-0 md:border-r md:border-b-0 lg:w-64">
          <ScrollArea className="max-h-[40vh] min-h-0 flex-1 md:max-h-none">
            <div className="flex flex-col gap-0.5 p-3">
              <div className="px-2 py-1.5 text-caption font-bold uppercase tracking-wider text-muted-foreground">
                {<__LocalizedText id="detailsFormatConfig_anyAdditionalDetails" />}{" "}</div>
              {formats.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedId(f.id)}
                  aria-current={selected?.id === f.id ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-body-compact leading-snug transition-colors",
                    selected?.id === f.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <FileTextIcon aria-hidden className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{f.name || __t("detailsFormatConfig_untitled")}</span>
                  {f.isDefault ? (
                    <Badge
                      variant={selected?.id === f.id ? "secondary" : "outline"}
                      className="shrink-0"
                    >
                      {<__LocalizedText id="detailsFormatConfig_default" />}{" "}</Badge>
                  ) : null}
                </button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => add({ name: "New format", html: "", mappings: {} })}
                className="mx-2 mt-2"
              >
                <PlusIcon data-icon="inline-start" aria-hidden />
                {<__LocalizedText id="detailsFormatConfig_newFormat" />}{" "}</Button>
            </div>
          </ScrollArea>
        </div>

        <div className="min-h-0 min-w-0 flex-1">
          {selected ? (
            <FormatEditor
              key={selected.id}
              format={selected}
              onDuplicate={() =>
                add({
                  name: `${selected.name} (copy)`,
                  html: selected.html,
                  mappings: { ...selected.mappings },
                })
              }
              onDelete={() => {
                removeDetailsFormat(selected.id);
                setSelectedId(null);
              }}
            />
          ) : (
            <div className="flex min-h-64 items-center justify-center text-body-compact text-muted-foreground">
              {<__LocalizedText id="detailsFormatConfig_noFormatsFilersWriteAdditionalDetailsFrom" />}{" "}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
