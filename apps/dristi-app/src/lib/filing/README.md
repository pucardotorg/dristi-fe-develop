# E-filing — how the front end works, and where the backend plugs in

The S-138 e-filing flow (`/filings/**`) is moving onto the DRISTI backend section by
section. A filing starts on the backend and its documents are saved there; the rest of the
draft is still kept in the browser (IndexedDB) as the form's working copy, and reference
lookups hit public endpoints. Values are typed by the filer — nothing is read off the
uploaded documents.

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
| `data/cases-api.ts` — case filing API | "Start filing" opens a backend draft (`POST /cases`) and the local draft takes its id (`draft.caseId`); every intake file is also uploaded as a case document (`use-case-documents.ts`), and removed from the case when cleared or replaced. Identity proof and loan papers have no backend type yet and stay local | Parties, evidence and details sections; then reading drafts back from `GET /cases` |
| `data/repository.ts` → `data/indexeddb.ts` | IndexedDB (`dristi-efiling`: `drafts`, `files`) — the working copy of the draft and the file bytes for previews | Removed once the backend holds every section and serves file downloads |
| `profile.tsx` — `useProfile()` | The signed-in account from `GET /users/me` (name, mobile, email, Bar number) | — |
| `lookups.ts` — `lookupIfsc`, `lookupPin` | `ifsc.razorpay.com`, `api.postalpincode.in` | The backend's `GET /pincodes/{pincode}`; an IFSC service |
| `registry.ts` | A fixed stand-in bar register and returning-litigant record | The backend's advocate search (not built yet) |
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
