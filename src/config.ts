import type { Schema } from "sanity";

/** @public */
export interface TranslationLanguage {
  id: string;
  title: string;
}

/** @public */
export interface TranslationsConfigInput {
  /** Languages editors can work in. The first one is the default Studio language. */
  languages: TranslationLanguage[];
  /** localStorage key holding the selected Studio language. Default: `"studioLanguage"`. */
  storageKey?: string;
  /** API version used for every client call made by the plugin. Default: `"2025-01-01"`. */
  apiVersion?: string;
  /** Field holding a document's language. Default: `"language"`. */
  languageField?: string;
  /** Document type that stores translation metadata. Default: `"translation.metadata"` (@sanity/document-internationalization). */
  metadataType?: string;
  /**
   * Translatable schema types. When omitted, every type that has a `languageField` field
   * is treated as translatable (resolved from the Studio schema at runtime).
   */
  schemaTypes?: string[];
}

/** @public */
export interface TranslationsConfig extends Required<Omit<TranslationsConfigInput, "schemaTypes">> {
  schemaTypes?: string[];
  /** The Studio language picked in the language selector (falls back to the first language). Safe to call outside React. */
  getStudioLanguage: () => string;
  /** Persists a Studio language. Unknown ids are ignored. */
  setStudioLanguage: (id: string) => void;
  /** Whether a schema type is translatable. */
  isTranslatable: (typeName: string, schema?: Schema) => boolean;
  /** Translatable document types (name + title), resolved from the schema. */
  getTranslatableDocumentTypes: (schema: Schema) => { name: string; title: string }[];
}

const hasLocalStorage = () => {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
};

/**
 * Creates the shared translations config. Pass the result to the `studioTranslations()` plugin
 * and to structure helpers like `missingTranslations()`.
 *
 * @public
 */
export function defineTranslationsConfig(input: TranslationsConfigInput): TranslationsConfig {
  if (!input.languages?.length) {
    throw new Error("[sanity-plugin-studio-translations] `languages` must contain at least one language.");
  }

  const storageKey = input.storageKey ?? "studioLanguage";
  const languageField = input.languageField ?? "language";
  const ids = new Set(input.languages.map((l) => l.id));
  const defaultLanguage = input.languages[0].id;

  const getStudioLanguage = () => {
    if (!hasLocalStorage()) {
      return defaultLanguage;
    }

    const stored = localStorage.getItem(storageKey);

    return stored && ids.has(stored) ? stored : defaultLanguage;
  };

  const setStudioLanguage = (id: string) => {
    if (ids.has(id) && hasLocalStorage()) {
      localStorage.setItem(storageKey, id);
    }
  };

  const hasLanguageField = (typeName: string, schema?: Schema) => {
    const type = schema?.get(typeName) as { fields?: { name: string }[] } | undefined;

    return !!type?.fields?.some((f) => f.name === languageField);
  };

  const isTranslatable = (typeName: string, schema?: Schema) =>
    input.schemaTypes ? input.schemaTypes.includes(typeName) : hasLanguageField(typeName, schema);

  const getTranslatableDocumentTypes = (schema: Schema) =>
    schema
      .getTypeNames()
      .map((name) => schema.get(name))
      .filter((type): type is NonNullable<typeof type> => !!type && type.type?.name === "document" && !type.name.startsWith("sanity."))
      .filter((type) => isTranslatable(type.name, schema))
      .map((type) => ({ name: type.name, title: type.title ?? type.name }));

  return {
    languages: input.languages,
    storageKey,
    apiVersion: input.apiVersion ?? "2025-01-01",
    languageField,
    metadataType: input.metadataType ?? "translation.metadata",
    schemaTypes: input.schemaTypes,
    getStudioLanguage,
    setStudioLanguage,
    isTranslatable,
    getTranslatableDocumentTypes,
  };
}
