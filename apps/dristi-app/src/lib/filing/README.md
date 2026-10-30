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
| `data/cases-api.ts` — case filing API | "Start filing" opens a backend draft (`POST /cases`) and the local draft takes its id (`draft.caseId`); every intake file is also uploaded as a case document (`use-case-documents.ts`), and removed from the case when cleared or replaced. Identity proof and loan papers have no backend type yet and stay local. Complainants, advocates, accused and witnesses are saved as their step opens and closes (`use-step-sync.ts`, with `use-case-parties.ts` / `use-case-advocates.ts`; mapping in `parties.ts` / `advocates.ts`): only complete parties are sent, and one still missing a field the backend requires is held back with a note naming it; the first phone and address fill the backend's fields and the rest go in `additional_details`; a litigant's own complainant (their account's mobile) is added as `self`, so the backend links their account; a complainant's PoA holder is saved after the complainants, with a mandate naming that complainant's participant (`POST /cases/{id}/poa-holders`), and revoked when no longer named; an institution accused is saved once per person summoned for it; witnesses are the complainant's (`side: COMPLAINANT`); an advocate is found by `GET /advocates?search=` and saved as one representation per complainant they act for, once those complainants are on the case; anything removed from the form is taken off the case | Evidence and details sections; then reading drafts back from `GET /cases` |
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
