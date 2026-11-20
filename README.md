# sanity-plugin-studio-translations

Studio-side translation tooling for Sanity projects that use
[`@sanity/document-internationalization`](https://github.com/sanity-io/plugins/tree/main/plugins/%40sanity/document-internationalization):

| Feature | What it does | Default |
|---|---|---|
| `languageSelector` | Adds a Studio language select next to the tool menu (stored in localStorage). | on |
| `statusBadge` | Document badge: `Missing: English` / `1/2 published` / `2/2 published`. Updates live. | on |
| `ensureLanguageOnPublish` | Sets the language field to the Studio language when it's missing, before `publish` and `schedule` run. | on |
| `publishToast` | Shows a toast after publishing a translatable document. | off |
| `filterTemplates` | Only offers "new document" templates for the current Studio language on translatable types. | off |
| `missingTranslations()` | Structure helper: lists documents (in the Studio language) that lack translations, grouped by type. | call it yourself |

## Setup

### 1. Shared config

Structure and templates run outside React, so the config lives in a module that the plugin and
your structure both import:

```ts
// sanity/translations.ts
import { defineTranslationsConfig } from "sanity-plugin-studio-translations";

export const translations = defineTranslationsConfig({
  languages: [
    { id: "no", title: "Norsk" },
    { id: "en", title: "English" },
  ],
  storageKey: `studioLanguage:${projectId}`, // default: "studioLanguage"
  apiVersion: "2025-11-19",                   // default: "2025-01-01"
  languageField: "language",                  // default
  metadataType: "translation.metadata",       // default
  schemaTypes: ["article", "page"],           // default: every type with a `languageField` field
});

// Use this wherever you filter lists by the Studio language.
export const { getStudioLanguage } = translations;
```

### 2. Plugin

```ts
// sanity.config.tsx
import { studioTranslations } from "sanity-plugin-studio-translations";
import { translations } from "./sanity/translations";

plugins: [
  documentInternationalization({ /* ... */ }),
  // Put this after documentInternationalization so `filterTemplates` sees its templates.
  studioTranslations(translations, {
    languageSelector: true,              // or false, or { reloadOnChange, hideWhenSingle }
    statusBadge: {                       // or true / false
      types: ["article"],
      labels: { missingLabel: (l) => `Mangler: ${l}` },
    },
    ensureLanguageOnPublish: true,       // or { actions: ["publish"] }
    publishToast: {                      // default: false
      title: "Remember to update project translations",
      status: "warning",
      types: ["project"],
    },
    filterTemplates: true,
  }),
],
```

Your own `document.actions` resolver in `sanity.config` runs after the plugin, so you can keep
wrapping `publish` (e.g. a slug cascade). The plugin's wrapper keeps `action.action`.

### 3. Structure

```ts
import { missingTranslations } from "sanity-plugin-studio-translations";
import { translations } from "../translations";

S.list().items([
  // ...
  ...missingTranslations(S, context, translations, { title: "Manglende oversettelser" }),
]);
```

It returns `[divider, item]`, or `[]` when there's only one language. Pass `withDivider: false` to
leave out the divider, or use `missingTranslationsListItem()` to get the single list item.

## Lower-level exports

To compose things by hand instead of using the plugin:
`createLanguageSelector`, `createTranslationStatusBadge`, `withLanguage`, `withPublishToast`,
`filterTemplatesByStudioLanguage`.

## Migrating an existing project

1. Create `sanity/translations.ts` as above. Keep `storageKey: \`studioLanguage:${projectId}\`` so editors keep their selected language.
2. Replace `getStudioLanguage` imports from `sanity/studio/components/LanguageSelector` with `sanity/translations`.
3. Remove from `sanity.config`: the `TranslationStatusBadge` badge resolver, `createActionWithLanguage` / `createPublishWithLanguage`,
   `createPublishWithProjectToast` (use `publishToast`), the language templates filter (use `filterTemplates`), and `studio.components.toolMenu`.
4. Swap the local `missingTranslations` list item for the helper.
5. Delete `sanity/studio/components/{LanguageSelector,TranslationStatusBadge}`, `sanity/structure/listItems/missingTranslations`
   and the action files.

## Requirements

`sanity` 5 or 6 and React 18 or 19. `@sanity/ui` 4 and `@sanity/icons` 5 are installed as dependencies.

## License

MIT
