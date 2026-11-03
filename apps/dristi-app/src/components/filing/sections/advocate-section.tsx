"use client";

/**
 * Advocate details — the advocates on the Vakalatnama, and which complainant each acts for.
 *
 * An advocate is found once, not described twice: one search box takes either a name or
 * a bar number and looks both up among the advocates approved on the court portal
 * (`GET /advocates?search=`). What it finds is then shown as a result — name and number —
 * so the spelling that reaches the Vakalatnama is the register's rather than a re-keying
 * of it, and the advocate's backend id is kept to put them on the case. An advocate filing
 * for themselves can fill their own row from their profile in one click, and the panel
 * beside the form shows the uploaded Vakalatnama.
 *
 * The advocates are saved to the case as the step closes (`useCaseAdvocates`).
 */

import * as React from "react";
import Link from "next/link";
import { CheckIcon, ChevronDownIcon, PlusIcon, UserRoundIcon } from "lucide-react";

import { blankAdvocate } from "@/lib/filing/blank";
import {
  ADVOCATE_SEARCH_MIN_LENGTH,
  caseFilingApi,
  type FoundAdvocate,
} from "@/lib/filing/data/cases-api";
import { useProfile } from "@/lib/filing/profile";
import {
  complainantChoices,
  isPartyInPerson,
  partySourceSlot,
  representedIndices,
} from "@/lib/filing/selectors";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { removeAdvocateFromCase, useCaseAdvocates } from "@/lib/filing/use-case-advocates";
import { Identifier } from "@/components/chrome/identifier";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard, HalfWidth } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { ComboField } from "@/components/filing/inputs";
import { SectionNotice, UnsavedNotice } from "@/components/filing/notices";
import { RemoveButton } from "@/components/filing/repeat-lists";
import {
  SourcePanel,
  useSourceOpenState,
  ViewSourceButton,
} from "@/components/filing/source-panel";

/** A filing carries at most six advocates. */
const MAX_ADVOCATES = 6;

export function AdvocateSection() {
  const { draft, update, hrefFor } = useFiling();
  const { prev, next } = neighbours("advocate");
  const { profile } = useProfile();
  const { unsaved, retryUnsaved } = useCaseAdvocates();

  const advocates = draft.advocates;
  const choices = complainantChoices(draft.complainants);

  /**
   * A complainant who conducts the case themselves has no advocate on record, so those
   * indices leave the "Advocate for" list. They stay in it as disabled rows rather than
   * vanishing — the absence is a consequence of an answer they gave, and the row is where
   * that reads. When every complainant is a party in person there is nothing to fill in
   * at all, so the section says so instead of showing an unfillable form.
   */
  const represented = representedIndices(draft.complainants);
  const pipLabels = draft.complainants.flatMap((c, i) =>
    isPartyInPerson(c) ? [`Complainant ${i + 1}`] : []
  );
  const allInPerson = draft.complainants.length > 0 && represented.length === 0;

  /**
   * The source rail is a column beside the form from `xl` up, so it starts expanded
   * there as in the demo; collapsed, it stays in the layout as a strip. Below that it
   * is a sheet over the form — opened on request ("View source document") rather than
   * covering the screen on arrival.
   */
  const [sourceOpen, setSourceOpen] = useSourceOpenState();

  /**
   * The advocates the search box offers, searched again on every keystroke — by name or
   * bar number alike, since either is a real way to find an advocate. The backend needs
   * `ADVOCATE_SEARCH_MIN_LENGTH` characters before it searches; only the latest search's answer is shown.
   */
  const [register, setRegister] = React.useState<FoundAdvocate[]>([]);
  const [searchFailed, setSearchFailed] = React.useState(false);
  const latestSearch = React.useRef<AbortController | null>(null);
  const searchRegister = React.useCallback(async (query: string) => {
    latestSearch.current?.abort();
    const controller = new AbortController();
    latestSearch.current = controller;
    try {
      const rows = await caseFilingApi.searchAdvocates(query, controller.signal);
      if (controller.signal.aborted) return [];
      setRegister(rows);
      setSearchFailed(false);
      return rows;
    } catch {
      if (!controller.signal.aborted) {
        setRegister([]);
        setSearchFailed(true);
      }
      return [];
    }
  }, []);

  /**
   * What is typed into the search box, per advocate row. It is not the advocate's name:
   * searching and having-found are different states, and conflating them is what made
   * the field look like two boxes for one answer.
   */
  const [queries, setQueries] = React.useState<Record<string, string>>({});
  const setQuery = (id: string, value: string) =>
    setQueries((q) => ({ ...q, [id]: value }));


  // One Vakalatnama is uploaded per complainant; show the one belonging to the complainant
  // the first advocate acts for (clamped, since indices survive a complainant's removal).
  const vakalatnamaParty = Math.min(
    advocates[0]?.forComplainants[0] ?? 0,
    Math.max(0, draft.complainants.length - 1)
  );
  const vakalatnama = partySourceSlot(draft, vakalatnamaParty, "vakalatnama");

  /** By row id, not index: a search can come back after a row above it was removed. */
  const choose = React.useCallback(
    (rowId: string, adv: FoundAdvocate) =>
      update((d) => {
        const row = d.advocates.find((a) => a.id === rowId);
        if (!row) return;
        row.advocateId = adv.id;
        row.barNumber = adv.barNumber;
        row.name = adv.name;
      }),
    [update]
  );

  /**
   * Put the search's exact bar-number match in a row, since only the search gives the id
   * that puts an advocate on the case; without one, the results are left open to pick from.
   */
  const takeBarNumberMatch = React.useCallback(
    (rowId: string, barNumber: string, rows: FoundAdvocate[]) => {
      const match = rows.find((r) => r.barNumber.toUpperCase() === barNumber.toUpperCase());
      setQuery(rowId, match ? "" : barNumber);
      if (match) choose(rowId, match);
    },
    [choose]
  );

  /** The signed-in advocate filling in their own row. */
  const canUseProfile = !!profile?.barNumber.trim();
  const fillFromProfile = async (rowId: string) => {
    const barNumber = profile?.barNumber.trim() ?? "";
    takeBarNumberMatch(rowId, barNumber, await searchRegister(barNumber));
  };

  /*
   * A row named but never found through the search — the signed-in advocate's own card,
   * prefilled when the filing started, or a draft from before the search — is looked up
   * once as the step opens, so it can go on the case.
   */
  const lookedUp = React.useRef(false);
  React.useEffect(() => {
    if (lookedUp.current) return;
    lookedUp.current = true;
    const row = draft.advocates.find((a) => !a.advocateId && a.barNumber.trim());
    if (!row) return;
    const barNumber = row.barNumber.trim();
    caseFilingApi
      .searchAdvocates(barNumber)
      .then((rows) => takeBarNumberMatch(row.id, barNumber, rows))
      .catch(() => setQuery(row.id, barNumber));
  }, [draft.advocates, takeBarNumberMatch]);

  const toggleComplainant = (index: number, choice: number) =>
    update((d) => {
      const current = d.advocates[index].forComplainants;
      d.advocates[index].forComplainants = current.includes(choice)
        ? current.filter((k) => k !== choice)
        : [...current, choice].sort((a, b) => a - b);
    });

  const toggleAll = (index: number, allSelected: boolean) =>
    update((d) => {
      d.advocates[index].forComplainants = allSelected
        ? []
        : representedIndices(d.complainants);
    });

  const addAdvocate = () =>
    update((d) => {
      if (d.advocates.length >= MAX_ADVOCATES) return;
      d.advocates.push(blankAdvocate());
    });

  const removeAdvocate = (index: number) => {
    if (advocates.length <= 1) return;
    removeAdvocateFromCase(advocates[index]);
    update((d) => {
      d.advocates.splice(index, 1);
    });
  };

  return (
    <>
      <FilingMain sourceOpen={sourceOpen}>
        <FilingPageHeader
          title="Advocate details"
          description="Add the advocates representing the complainant, as listed on the Vakalatnama."
          actions={
            !sourceOpen ? (
              <ViewSourceButton onClick={() => setSourceOpen(true)} />
            ) : null
          }
        />

        {unsaved.length > 0 ? (
          <UnsavedNotice
            labels={unsaved.map((x) => x.name || `Advocate ${advocates.indexOf(x) + 1}`)}
            error={unsaved[0].syncError ?? ""}
            noun="details"
            onRetry={() => void retryUnsaved()}
          />
        ) : null}

        {/* Stated, not enforced: appearing in person is the complainant's own answer on
            the previous screen, so this reports the consequence rather than blocking. */}
        {pipLabels.length ? (
          <SectionNotice
            variant="info"
            title={
              allInPerson ? "The complainant appears in person" : "Appearing as a party in person"
            }
          >
            {allInPerson
              ? "This filing has no advocate on record. The complainant conducts the case in person."
              : `${pipLabels.join(" and ")} ${
                  pipLabels.length > 1 ? "conduct" : "conducts"
                } the case in person, so no advocate goes on record for them.`}{" "}
            Change this under{" "}
            <Link
              href={hrefFor("complainant")}
              className="font-medium text-current underline underline-offset-2"
            >
              Complainant details
            </Link>
            .
          </SectionNotice>
        ) : null}

        {/* Only approved advocates are found by the search below; the notice says why. */}
        {allInPerson || draft.dismissed.advocateInfo ? null : (
          <SectionNotice
            variant="neutral"
            title="Adding an advocate"
            onDismiss={() =>
              update((d) => {
                d.dismissed.advocateInfo = true;
              })
            }
          >
            Only advocates registered on the court portal can appear on a filing.
          </SectionNotice>
        )}

        {allInPerson ? null : advocates.map((a, i) => {
          // Indices are kept even if a complainant is removed or turns party-in-person;
          // only the ones an advocate may still act for count as selected.
          const selected = a.forComplainants.filter((k) => represented.includes(k));
          // Found through the search: the backend id is what "already found" means.
          const found = a.advocateId;
          const allSelected =
            represented.length > 0 && selected.length === represented.length;
          // "All complainants" is only true when none were held back for appearing in
          // person; otherwise the ones actually covered are named.
          const forLabel =
            selected.length === 0
              ? "Select complainants"
              : allSelected && represented.length === choices.length
                ? "All complainants"
                : selected.map((k) => choices[k]).join(", ");

          return (
            <FormCard
              key={a.id}
              title={`Advocate ${i + 1}`}
              action={
                advocates.length > 1 ? (
                  <RemoveButton
                    label={`Remove advocate ${i + 1}`}
                    onClick={() => removeAdvocate(i)}
                  />
                ) : undefined
              }
            >
              {/* A lone short answer takes half the card, like every other one. */}
              <HalfWidth>
                <FormField asGroup label="Advocate for" required>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      aria-label="Advocate for"
                      className="w-full justify-between font-normal"
                    >
                      <span
                        className={
                          selected.length === 0
                            ? "min-w-0 truncate text-muted-foreground"
                            : "min-w-0 truncate"
                        }
                      >
                        {forLabel}
                      </span>
                      <ChevronDownIcon
                        data-icon="inline-end"
                        aria-hidden
                        className="text-muted-foreground"
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuCheckboxItem
                      checked={allSelected}
                      onCheckedChange={() => toggleAll(i, allSelected)}
                      onSelect={(event) => event.preventDefault()}
                    >
                      All complainants
                    </DropdownMenuCheckboxItem>
                    {choices.map((label, k) => {
                      const inPerson = isPartyInPerson(draft.complainants[k]);
                      return (
                        <DropdownMenuCheckboxItem
                          key={label}
                          checked={!inPerson && selected.includes(k)}
                          disabled={inPerson}
                          onCheckedChange={() => toggleComplainant(i, k)}
                          onSelect={(event) => event.preventDefault()}
                        >
                          <span className="min-w-0 truncate">{label}</span>
                          {inPerson ? (
                            <span className="ml-auto pl-3 text-caption font-medium text-muted-foreground">
                              In person
                            </span>
                          ) : null}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuContent>
                  </DropdownMenu>
                </FormField>
              </HalfWidth>

              {/*
                One search, not two fields. The bar number and the name are the same
                lookup from two directions, so asking for both put one register behind
                two boxes. Only advocates on the register can appear on a filing, so the
                register is the whole path — there is nothing to type by hand.
              */}
              {found ? (
                <FormField asGroup label="Advocate" required>
                  <div className="flex items-start gap-3 rounded-lg bg-surface-sunken p-4">
                    <span
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-success bg-success-muted text-success-muted-foreground"
                    >
                      <CheckIcon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-semibold text-foreground">
                        {a.name}
                      </p>
                      <p className="truncate text-caption text-muted-foreground">
                        <Identifier value={a.barNumber} label="bar registration" />
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Change advocate ${i + 1}`}
                      onClick={() => {
                        setQuery(a.id, "");
                        update((d) => {
                          d.advocates[i].advocateId = undefined;
                          d.advocates[i].barNumber = "";
                          d.advocates[i].name = "";
                        });
                      }}
                    >
                      Change
                    </Button>
                  </div>
                </FormField>
              ) : (
                <FormField label="Advocate" required>
                  <ComboField
                    value={queries[a.id] ?? ""}
                    onChange={(v: string) => {
                      setQuery(a.id, v);
                      void searchRegister(v);
                    }}
                    items={register}
                    filter={null}
                    onSelect={(item) => {
                      setQuery(a.id, "");
                      choose(a.id, item as FoundAdvocate);
                    }}
                    itemKey={(item) => (item as FoundAdvocate).id}
                    itemLabel={(item) => (item as FoundAdvocate).name}
                    renderItem={(item) => {
                      const adv = item as FoundAdvocate;
                      return (
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{adv.name}</span>
                          <span className="truncate text-caption text-muted-foreground">
                            {/* A combobox row is an option — no control nested inside it. */}
                            <Identifier
                              value={adv.barNumber}
                              label="bar registration"
                              copyable={false}
                            />
                          </span>
                        </span>
                      );
                    }}
                    placeholder="Name or bar number"
                    emptyLabel={
                      searchFailed
                        ? "We couldn't search right now. Try again."
                        : (queries[a.id] ?? "").trim().length < ADVOCATE_SEARCH_MIN_LENGTH
                          ? "Start typing an advocate's name or Bar number"
                          : "No approved advocate by that name or number."
                    }
                    ariaLabel="Advocate"
                  />
                </FormField>
              )}

              {canUseProfile ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit"
                  // Six identical "Use my details" in a row otherwise; the visible label
                  // stays inside the accessible name, so voice control still works.
                  aria-label={`Use my details for advocate ${i + 1}`}
                  onClick={() => void fillFromProfile(a.id)}
                >
                  <UserRoundIcon data-icon="inline-start" aria-hidden />
                  Use my details
                </Button>
              ) : null}
            </FormCard>
          );
        })}

        {allInPerson ? null : (
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={addAdvocate}
            disabled={advocates.length >= MAX_ADVOCATES}
          >
            <PlusIcon data-icon="inline-start" aria-hidden />
            Add another advocate
          </Button>
        )}
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        continueHref={next ? hrefFor(next) : undefined}
      />

      <SourcePanel
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        eyebrow="Uploaded document"
        title="Vakalatnama"
        chips={
          vakalatnama?.file
            ? [
                {
                  label: vakalatnama.file.name,
                  active: true,
                  onClick: () => setSourceOpen(true),
                },
              ]
            : []
        }
        file={vakalatnama?.file ?? null}
        uploadHref={hrefFor("upload")}
        imageAlt="Uploaded Vakalatnama"
        note="Copy the advocate's name and bar number from this document."
      />
    </>
  );
}
