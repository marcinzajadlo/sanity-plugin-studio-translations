import { useToast } from "@sanity/ui/toast";
import type { DocumentActionComponent, DocumentActionProps } from "sanity";

/** @public */
export interface PublishToastOptions {
  /** Limit the toast to these types. Default: every translatable type. */
  types?: string[];
  title: string;
  description?: string;
  status?: "info" | "warning" | "success" | "error";
}

/**
 * Wraps a document action so a toast is shown after it runs.
 *
 * @public
 */
export function withPublishToast(originalAction: DocumentActionComponent, options: PublishToastOptions): DocumentActionComponent {
  const action: DocumentActionComponent = (props: DocumentActionProps) => {
    const original = originalAction(props);
    const toast = useToast();

    if (!original) {
      return null;
    }

    return {
      ...original,
      onHandle: () => {
        original.onHandle?.();

        toast.push({ status: options.status ?? "warning", title: options.title, description: options.description });
      },
    };
  };

  action.action = originalAction.action;
  action.displayName = originalAction.displayName;

  return action;
}
