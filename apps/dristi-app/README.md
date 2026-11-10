# Dristi App

Main product app for Dristi. Shared UI primitives live in `src/components/ui/` and
the theme tokens in `src/app/globals.css`.

## Run

From the repository root:

```bash
git clone <this-repo> && cd <this-repo>
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Localization

The App Router uses `next-intl`, configured in `next.config.ts` and
`src/i18n/request.ts`. Message catalogs live at:

- `messages/en.json` — English source copy
- `messages/hi.json` — Hindi catalog; currently an intentional English copy until
  reviewed Hindi translations are supplied

The existing language switch updates `LocaleProvider`, the active `next-intl` catalog,
and the document's `lang` attribute. Client components use
`src/i18n/use-translations.ts`; server components use
`src/i18n/server-translations.ts`. Existing bilingual content models can continue to
use `pick(copy, locale)`.

Add every new user-facing message under a stable, feature-prefixed key in both catalogs.
Use ICU placeholders for interpolated values, for example:

```json
{
  "cases_selectedCount": "{count} cases selected"
}
```

```tsx
const t = useTranslations();
return <p>{t("cases_selectedCount", {count})}</p>;
```

Run `npm run test:app` to check catalog parity, interpolation, fallbacks, and references
to missing keys.
