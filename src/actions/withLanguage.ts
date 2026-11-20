import type { DocumentActionComponent, DocumentActionProps, DocumentActionsContext } from "sanity";
import type { TranslationsConfig } from "../config";

/**
 * Wraps a document action so the document's language field is set (to the Studio language)
 * before the action runs.
 *
 * Use it on `publish` and `schedule`: a scheduled document is published later by Sanity
 * itself with no action running, so the field must be set while the editor is still here.
 * That is also why `version` is read before `draft`.
 *
 * @public
 */
export function withLanguage(config: TranslationsConfig, originalAction: DocumentActionComponent, context: DocumentActionsContext): DocumentActionComponent {
  const client = context.getClient({ apiVersion: config.apiVersion });

  const action: DocumentActionComponent = (props: DocumentActionProps) => {
    const original = originalAction(props);

    if (!original) {
      return null;
    }

    return {
      ...original,
      onHandle: async () => {
        const document = props.version ?? props.draft;

        if (document?._id && !document[config.languageField] && config.isTranslatable(document._type, context.schema)) {
          await client
            .patch(document._id)
            .setIfMissing({ [config.languageField]: config.getStudioLanguage() })
            .commit({ visibility: "async" });
        }

        original.onHandle?.();
      },
    };
  };

  action.action = originalAction.action;
  action.displayName = originalAction.displayName;

  return action;
}
