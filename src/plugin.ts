import { type DocumentActionComponent, definePlugin, type PluginOptions } from "sanity";
import { withLanguage } from "./actions/withLanguage";
import { type PublishToastOptions, withPublishToast } from "./actions/withPublishToast";
import { createTranslationStatusBadge, type TranslationStatusBadgeOptions } from "./badges/TranslationStatusBadge";
import { createLanguageSelector, type LanguageSelectorOptions } from "./components/LanguageSelector";
import type { TranslationsConfig } from "./config";
import { filterTemplatesByStudioLanguage } from "./templates";

/** @public */
export interface StudioTranslationsOptions {
  /** Studio language select in the tool menu. Default: `true`. */
  languageSelector?: boolean | LanguageSelectorOptions;
  /** Translation status badge on translatable documents. Default: `true`. */
  statusBadge?: boolean | TranslationStatusBadgeOptions;
  /**
   * Set the language field to the Studio language when it is missing, before these actions run.
   * Default: `true` (= `["publish", "schedule"]`).
   */
  ensureLanguageOnPublish?: boolean | { actions?: string[] };
  /** Toast shown after publishing a translatable document. Default: off. */
  publishToast?: false | PublishToastOptions;
  /**
   * Only offer initial-value templates for the current Studio language on translatable types.
   * Place this plugin after `documentInternationalization()` so its templates are filtered. Default: `false`.
   */
  filterTemplates?: boolean;
}

const asOptions = <T extends object>(value: boolean | T | undefined, fallback: boolean): T | null => {
  if (value === undefined) {
    return fallback ? ({} as T) : null;
  }

  if (value === false) {
    return null;
  }

  return value === true ? ({} as T) : value;
};

/**
 * Studio translation tooling. Every feature can be switched off or customised.
 *
 * @public
 */
export function studioTranslations(config: TranslationsConfig, options: StudioTranslationsOptions = {}): PluginOptions {
  const selector = asOptions(options.languageSelector, true);
  const badge = asOptions(options.statusBadge, true);
  const ensureLanguage = asOptions(options.ensureLanguageOnPublish, true);
  const ensureLanguageActions = ensureLanguage?.actions ?? ["publish", "schedule"];
  const toast = options.publishToast || null;

  const Badge = badge ? createTranslationStatusBadge(config, badge) : null;
  const ToolMenu = selector ? createLanguageSelector(config, selector) : null;

  return definePlugin({
    name: "sanity-plugin-studio-translations",

    studio: ToolMenu ? { components: { toolMenu: ToolMenu } } : undefined,

    schema: options.filterTemplates ? { templates: (prev, context) => filterTemplatesByStudioLanguage(config, prev, context.schema) } : undefined,

    document: {
      badges: (prev, context) => {
        if (!Badge) {
          return prev;
        }

        const applies = badge?.types ? badge.types.includes(context.schemaType) : config.isTranslatable(context.schemaType, context.schema);

        return applies ? [...prev, Badge] : prev;
      },

      actions: (prev, context) => {
        if (!ensureLanguage && !toast) {
          return prev;
        }

        const translatable = config.isTranslatable(context.schemaType, context.schema);
        const showToast = !!toast && (toast.types ? toast.types.includes(context.schemaType) : translatable);

        return prev.map((action): DocumentActionComponent => {
          let next = action;

          if (ensureLanguage && translatable && action.action && ensureLanguageActions.includes(action.action)) {
            next = withLanguage(config, next, context);
          }

          if (toast && showToast && action.action === "publish") {
            next = withPublishToast(next, toast);
          }

          return next;
        });
      },
    },
  })();
}
