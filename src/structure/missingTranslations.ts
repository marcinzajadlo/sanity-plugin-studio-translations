import { WarningOutlineIcon } from "@sanity/icons/WarningOutline";
import type { ComponentType } from "react";
import type { ListItemBuilder, StructureBuilder, StructureResolverContext } from "sanity/structure";
import type { TranslationsConfig } from "../config";

/** @public */
export interface MissingTranslationsOptions {
  /** Default: `"Missing translations"`. */
  title?: string;
  icon?: ComponentType;
  /** Document types to check. Default: translatable document types from the schema. */
  types?: { name: string; title: string }[];
}

// Counts translations in the published metadata document; fewer than $totalLanguages means one is missing.
const missingCondition = (languageField: string) => `
  @[${JSON.stringify(languageField)}] == $language
  && !(_id in path("drafts.**"))
  && coalesce(
       count(*[_type == $metadataType && !(_id in path("drafts.**")) && references(^._id)][0]
              .translations[defined(value._ref)]),
       0
     ) < $totalLanguages
`;

/**
 * A structure list item listing documents (in the current Studio language) that lack
 * one or more translations, grouped by type.
 *
 * @public
 */
export function missingTranslationsListItem(
  S: StructureBuilder,
  context: StructureResolverContext,
  config: TranslationsConfig,
  options: MissingTranslationsOptions = {},
): ListItemBuilder {
  const title = options.title ?? "Missing translations";
  const condition = missingCondition(config.languageField);

  return S.listItem()
    .id("missingTranslations")
    .title(title)
    .icon(options.icon ?? WarningOutlineIcon)
    .child(async () => {
      const client = context.getClient({ apiVersion: config.apiVersion });
      const types = options.types ?? config.getTranslatableDocumentTypes(context.schema);
      const baseParams = {
        language: config.getStudioLanguage(),
        totalLanguages: config.languages.length,
        metadataType: config.metadataType,
      };

      const typesWithMissing: string[] = await client.fetch(`array::unique(*[_type in $types && ${condition}]._type)`, {
        ...baseParams,
        types: types.map((t) => t.name),
      });

      const items = types
        .filter((t) => typesWithMissing.includes(t.name))
        .map(({ name, title: typeTitle }) =>
          S.listItem()
            .id(name)
            .title(typeTitle)
            .schemaType(name)
            .child(
              S.documentList()
                .id(`missingTranslations-${name}`)
                .title(typeTitle)
                .schemaType(name)
                .filter(`_type == $type && ${condition}`)
                .params({ ...baseParams, type: name })
                .apiVersion(config.apiVersion),
            ),
        );

      return S.list()
        .title(title)
        .items(items.length > 0 ? items : [S.divider()]);
    });
}

/**
 * Same as `missingTranslationsListItem`, preceded by a divider, returned as an array to spread
 * into `S.list().items([...])`. Returns `[]` when there are fewer than two languages.
 *
 * @public
 */
export function missingTranslations(
  S: StructureBuilder,
  context: StructureResolverContext,
  config: TranslationsConfig,
  options: MissingTranslationsOptions & { withDivider?: boolean } = {},
): (ReturnType<StructureBuilder["divider"]> | ListItemBuilder)[] {
  if (config.languages.length < 2) {
    return [];
  }

  const item = missingTranslationsListItem(S, context, config, options);

  return options.withDivider === false ? [item] : [S.divider(), item];
}
