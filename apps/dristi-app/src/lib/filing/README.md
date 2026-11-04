# E-filing — how the front end works, and where the backend plugs in

The S-138 e-filing flow (`/filings/**`) is moving onto the DRISTI backend section by
section. A filing starts on the backend and its documents, complainants, advocates,
accused and witnesses are saved there; the rest of the draft is still kept in the
browser (IndexedDB) as the form's working copy, and reference lookups hit public
endpoints. Values are typed by the filer — nothing is read off the uploaded documents.

## Model

`types.ts` is the contract. One `FilingDraft` per filing (`id`, `caseId`, `status: draft |
filed`, `lastStep`, `intake`, parties, cheques, notices, …, `sign`, timestamps). Uploads
are `StoredFileRef`s (`{ id, name, size, type, ext }`) — the bytes live in the file store.
`blank.ts` builds an empty draft; `buildDocumentGroups` derives the "List of documents"
step from the case (the store recomputes it on every commit, so it can never disagree
with the intake).

## Seams

| Seam | Today | Next |
| --- | --- | --- |
| `data/cases-api.ts` — case filing API | "Start filing" opens a backend draft (`POST /cases`) and the local draft takes its id (`draft.caseId`); every intake file, and every file on a custom row of the list of documents, is also uploaded as a case document (`use-case-documents.ts`; type and details decided in `case-documents.ts`), and removed from the case when cleared, replaced or its card is removed. The type says what a document is, not which cheque or party — every cheque's scan is a `BOUNCED_CHEQUE`. A custom row goes up as `OTHER_SUPPORTING_DOCUMENT` under its typed name (`display_name`); "Natively digital" goes up as `is_digital`; a later change to either is patched onto the saved copy (`PATCH /case-documents/{id}`). Every upload-step party is a complainant (party card `i` is complainant `i`, kept in step both ways and removed together); their identity proof, vakalatnama and PoA document are linked to that complainant's participant (`case_participant_id`) — on upload if the complainant is saved, otherwise patched on after the complainant step saves, and again if the complainant is re-added under a new id. Documents are linked to evidence in two directions: a demand notice's proof of dispatch, proof of delivery and reply carry that notice's `case_evidence_id` (sent on upload if the notice is saved, otherwise patched on after the demand notice step saves; each paper points at its own notice, and a delivered notice without a linked proof of delivery fails submit), while a scan — cheque, return memo, demand notice — never carries `case_evidence_id` (E07030): its evidence row points at it with `case_document_id`, set when the step saves, again when a scan is uploaded after its row exists, and cleared (`null`) when the scan is removed. Complainants, advocates, accused and witnesses are saved as their step opens and closes (`use-step-sync.ts`, with `use-case-parties.ts` / `use-case-advocates.ts`; mapping in `parties.ts` / `advocates.ts`): only complete parties are sent, and one still missing a field the backend requires is held back with a note naming it; the first phone and address fill the backend's fields and the rest go in `additional_details`; a complainant's or PoA holder's permanent address is sent as `permanent_address` only when it differs from the residential one (never in `additional_details`), and a PATCH sends `permanent_address: null` to clear it once it is the same again; a litigant's own complainant (their account's mobile) is added as `self`, so the backend links their account; an institution complainant goes with its PAN or CIN, or with `institution.pan_cin_skip_declared: true` when the filer declared the skip, and is held back until it has one or the other (the backend refuses it otherwise); a complainant's PoA holder is saved after the complainants, with a mandate naming that complainant's participant (`POST /cases/{id}/poa-holders`), and revoked when no longer named; an institution accused is saved once per person summoned for it; an accused with no phone or email the filer declared they cannot find goes with `contact_details_unknown_declared: true`, kept on the draft as `contactUnknownDeclaredAt` and dropped (PATCHed to `false`) once a phone or email is added; witnesses are the complainant's (`side: COMPLAINANT`); an advocate is found by `GET /advocates?search=` and saved as one representation per complainant they act for, once those complainants are on the case; anything removed from the form is taken off the case. Every call sends JSON except the document upload, which is multipart | Evidence and details sections — a cheque's scan and return memo and a demand notice's scan are uploaded as plain documents, then linked from the evidence record (`PATCH /case-evidence/{id}` with `case_document_id`), never by sending `case_evidence_id` on the upload; then reading drafts back from `GET /cases` |
| `data/repository.ts` → `data/indexeddb.ts` | IndexedDB (`dristi-efiling`: `drafts`, `files`) — the working copy of the draft and the file bytes for previews | Removed once the backend holds every section and serves file downloads |
| `profile.tsx` — `useProfile()` | The signed-in account from `GET /users/me` (name, mobile, email, Bar number) | — |
| `lookups.ts` — `lookupIfsc`, `lookupPin` | `ifsc.razorpay.com`, `api.postalpincode.in` | The backend's `GET /pincodes/{pincode}`; an IFSC service |
| `registry.ts` | A fixed stand-in returning-litigant record (ON Court) | The court's own records, read after the number is verified |
| Sign & pay (`components/filing/sections/sign-section.tsx`) | Sandbox: any OTP, simulated payment, generated `KL-nnnnnn-yyyy` case-file number, `status = filed` | eSign provider, payment gateway, registry-issued case number |

## Store

`store.tsx` — `FilingProvider` per `/filings/[draftId]`: loads the draft, `update((d) =>
…)` clones + commits + debounced write; `saveState` is the real write state (`saving`,
`saved`, `error`). `lastStep` follows the URL so "Continue draft" resumes in place.
`files.ts` gives screens object URLs and PDF page-1 renders for any stored file.

## Runtime assets

`scripts/copy-runtime-assets.mjs` (predev/prebuild) copies the pdf.js worker into
`public/vendor/` (git-ignored) so nothing is fetched from a CDN at runtime.

## Known gaps the form does not collect yet

The court document prints only what is typed. Fields the standard complaint format
expects that the form does not yet ask for: parent/spouse name of individuals ("S/o"),
the advocate's State Bar Council. Add them to the model + section when product confirms.
