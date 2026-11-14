# Localization

How UI text is written in the Dristi App so it can be shown in English, Hindi and the
other deployment languages. Read this before adding or changing any text a user sees.

The app uses [next-intl](https://next-intl.dev). The chosen language is kept in the
`NEXT_LOCALE` cookie, so server and client components render in the same language.

## Where text lives

| File | Holds |
|---|---|
| `apps/dristi-app/messages/en.json` | English, the source of every message |
| `apps/dristi-app/messages/hi.json` | Hindi. Same keys as `en.json`. A missing key shows English. |
| `src/i18n/messages.ts` | Loads the catalogs; `MessageKey` type; `translateMessage` for code outside React |
| `src/i18n/request.ts` | Tells next-intl the language for each request, from the `NEXT_LOCALE` cookie |
| `src/i18n/next-intl.d.ts` | Registers the keys, so a missing or misspelt key fails to compile |
| `src/components/shell/locale.tsx` | `LocaleProvider` / `useLocale()`: the language switch, which writes the cookie |

Malayalam still lives inline in `Copy` objects (`{ en, ml }`) and is read through
`pick` / `fillCopy`. It will move to `ml.json` later.

## How a component gets its text

One import works in client components, shared components and server components:

```tsx
import { useTranslations } from "next-intl";

const t = useTranslations();
<Button>{t("common_save")}</Button>
```

An `async` server component uses `getTranslations` instead:

```tsx
import { getTranslations } from "next-intl/server";

const t = await getTranslations();
```

Code outside React (content models, `pick`, `fillCopy`) uses
`translateMessage(locale, key)` from `@/i18n/messages`.

Keys are type-checked against `en.json`: `t("common_sav")` or `t("Draft")` is a
compile error, and typing `t("access_` lists every `access_` key. Add the key to
`en.json` first, then use it.

If a file already has its own `t` (e.g. a `Copy` helper), name the translator
`tr` instead.

## Rule 1 — Never put English text in code. Put a key.

Every string a user sees is a key in `en.json`, rendered through the translator.

```tsx
// ✗ wrong
<Button>Add person</Button>

// ✓ right
<Button>{t("accessList_addPerson")}</Button>
```

## Rule 2 — Constants hold keys, not English

Status labels, option lists, table headers, default props: anything defined outside a
component stores the **key**. The component translates it.

```ts
// ✗ wrong — English in a constant
const STATUS_LABEL = {
  draft: "Draft",
  approved: "Approved",
  declined: "Declined",
};

// ✓ right — keys, typed so a typo fails to compile
import type { MessageKey } from "@/i18n/messages";

const STATUS_LABEL: Record<Status, MessageKey> = {
  draft: "vakalatnama_statusDraft",
  approved: "vakalatnama_statusApproved",
  declined: "vakalatnama_statusDeclined",
};

// component
<span>{t(STATUS_LABEL[status])}</span>
```

The same applies to default props: `text = "pagination_previous"`, not `text = "Previous"`.

**Why:** the app never looks a key up from its English text. That lookup silently fails
once a real translation exists (the Hindi catalog has no "Draft" to match), and it
picks the wrong key when the same word means different things ("Order" as a court
order and as a sort order).

## Rule 3 — Key names

- Flat keys, **prefixed with the file name** in camelCase:
  `addSignatureDialog_paymentReference`.
- **Never use `.` in a key.** next-intl reads a dot as nesting.
- Generic actions shared across the app use `common_`: `common_close`,
  `common_cancel`, `common_save`, `common_back`, `common_next`, `common_submit`.
  Only these approved words. Never share a word whose translation depends on context
  ("Order", "Status", "Bail").
- Two strings that differ only in capitals are separate keys with a readable suffix:
  `addSignatureDialog_paymentReference` ("Payment reference") and
  `addSignatureDialog_paymentReferenceLabel` ("payment reference").

## Rule 4 — Values go in placeholders, never joined

```ts
// ✗ wrong — word order is fixed to English
t("access_accessGivenTo") + " " + name

// ✓ right
"access_accessGivenToName": "Access given to {name}"
t("access_accessGivenToName", { name })
```

## Rule 5 — Special characters in `en.json` must be escaped

Messages use ICU message format. Every message is always formatted, so these
characters must be escaped or the message fails to render:

| You want to show | Write in JSON | Why |
|---|---|---|
| `{` or `}` | `'{'` / `'}'` | Braces mark placeholders |
| An apostrophe right before `{`, `}` or `#` | `''` | A single `'` there starts a quoted section |
| `<` followed by a letter | `'<'` | `<x` reads as a rich-text tag |
| Ordinary apostrophes, e.g. `Don't` | `Don't` | No escaping needed |

The catalog test formats every message in `en.json` and fails on any that cannot render.

## Rule 6 — Sentences with links or bold: one key, `t.rich`

Never split a sentence into pieces around a link. Hindi word order differs, and pieces
cannot be reordered.

```json
"signing_readTerms": "Read the <link>terms</link> before signing"
```

```tsx
{t.rich("signing_readTerms", { link: (chunks) => <Link href="/terms">{chunks}</Link> })}
```

The translator moves `<link>` wherever the language needs it:
`"हस्ताक्षर करने से पहले <link>शर्तें</link> पढ़ें"`.

## Rule 7 — Adding a new message

1. Add the key and English text to `en.json`.
2. Add the same key to `hi.json` (English until a reviewed translation exists).
3. Run `npm run test:app`. It checks that both catalogs have the same keys, placeholders
   and tags, that keys are `file_name` shaped with no dots, that every message formats,
   and that every key used in code (including `Copy` keys read through `pick`) exists.

## Not localized (yet)

- **Fixture and sandbox data** (`lib/*/fixtures.ts`, `lib/tasks/sandbox.ts`). This is
  demo data that will come from the back end.
- **Task and application history sentences** (`lib/tasks/transitions.ts`). They are
  stored as finished English sentences; translating them needs an event key plus values
  in the stored record.
- **Page titles** (`export const metadata`).
- **Plurals** use separate keys (`access_1Case`, `access_countCases`) for now, not ICU
  plural form.
