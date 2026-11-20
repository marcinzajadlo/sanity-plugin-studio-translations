import { useEffect, useState } from "react";
import { type DocumentBadgeComponent, useClient } from "sanity";
import type { TranslationsConfig } from "../config";

/** @public */
export interface TranslationStatusBadgeLabels {
  missingLabel: (missing: string) => string;
  missingTitle: (missing: string) => string;
  publishedLabel: (published: number, total: number) => string;
  unpublishedTitle: (unpublished: string) => string;
  allPublishedTitle: string;
}

/** @public */
export interface TranslationStatusBadgeOptions {
  /** Limit the badge to these types. Default: every translatable type. */
  types?: string[];
  labels?: Partial<TranslationStatusBadgeLabels>;
}

const DEFAULT_LABELS: TranslationStatusBadgeLabels = {
  missingLabel: (missing) => `Missing: ${missing}`,
  missingTitle: (missing) => `Missing translations: ${missing}`,
  publishedLabel: (published, total) => `${published}/${total} published`,
  unpublishedTitle: (unpublished) => `Unpublished translations: ${unpublished}`,
  allPublishedTitle: "All translations published",
};

interface Status {
  found: string[];
  published: string[];
}

type StatusRow = { found: string[] | null; publishedLangs: string[] | null; refs: string[] | null };

const STATUS_QUERY = `*[_type == $metadataType && references($id)]{
  "found": translations[defined(value._ref)]{ "lang": coalesce(language, _key) }.lang,
  "publishedLangs": translations[defined(value->._id)]{ "lang": coalesce(language, _key) }.lang,
  "refs": translations[defined(value._ref)].value._ref
}`;

const LISTEN_QUERY = `*[(_type == $metadataType && references($id)) || _id in $refs]`;

/**
 * Creates a document badge showing which translations exist and are published.
 *
 * @public
 */
export function createTranslationStatusBadge(config: TranslationsConfig, options: TranslationStatusBadgeOptions = {}): DocumentBadgeComponent {
  const labels = { ...DEFAULT_LABELS, ...options.labels };
  const { languages, metadataType, languageField, apiVersion } = config;
  const supportedIds = new Set(languages.map((l) => l.id));
  const titles = (ids: string[]) =>
    languages
      .filter((l) => ids.includes(l.id))
      .map((l) => l.title)
      .join(", ");

  const TranslationStatusBadge: DocumentBadgeComponent = ({ draft, published }) => {
    const doc = draft ?? published;
    const client = useClient({ apiVersion });
    const [status, setStatus] = useState<Status | null>(null);
    const docId = doc?._id?.replace(/^drafts\./, "") ?? "";
    const ownLanguage = (doc as Record<string, unknown> | null)?.[languageField] as string | undefined;
    const isCurrentDocPublished = !!published;

    useEffect(() => {
      if (!docId) {
        return;
      }

      let cancelled = false;
      let currentRefs: string[] = [];
      let subscription: { unsubscribe: () => void } | null = null;

      const subscribe = () => {
        subscription?.unsubscribe();
        subscription = client
          .listen(LISTEN_QUERY, { id: docId, refs: currentRefs, metadataType }, { includeResult: false, visibility: "query" })
          .subscribe({ next: () => fetchStatus() });
      };

      const fetchStatus = () => {
        client.fetch<StatusRow[] | null>(STATUS_QUERY, { id: docId, metadataType }).then((result) => {
          if (cancelled) {
            return;
          }

          const known = (lang: string) => supportedIds.has(lang);
          const foundSet = new Set((result?.flatMap((r) => r.found ?? []) ?? []).filter(known));
          const publishedSet = new Set((result?.flatMap((r) => r.publishedLangs ?? []) ?? []).filter(known));

          if (ownLanguage && known(ownLanguage)) {
            foundSet.add(ownLanguage);

            if (isCurrentDocPublished) {
              publishedSet.add(ownLanguage);
            }
          }

          setStatus({ found: Array.from(foundSet), published: Array.from(publishedSet) });

          const nextRefs = Array.from(new Set(result?.flatMap((r) => r.refs ?? []) ?? [])).sort();

          if (nextRefs.join(",") !== currentRefs.join(",")) {
            currentRefs = nextRefs;
            subscribe();
          }
        });
      };

      fetchStatus();
      subscribe();

      return () => {
        cancelled = true;
        subscription?.unsubscribe();
      };
    }, [docId, client, ownLanguage, isCurrentDocPublished]);

    if (!status) {
      return null;
    }

    const total = languages.length;
    const missing = languages.filter((l) => !status.found.includes(l.id)).map((l) => l.id);

    if (missing.length > 0) {
      return { label: labels.missingLabel(titles(missing)), color: "danger", title: labels.missingTitle(titles(missing)) };
    }

    const draftOnly = languages.filter((l) => !status.published.includes(l.id)).map((l) => l.id);

    if (draftOnly.length > 0) {
      return { label: labels.publishedLabel(status.published.length, total), color: "warning", title: labels.unpublishedTitle(titles(draftOnly)) };
    }

    return { label: labels.publishedLabel(total, total), color: "success", title: labels.allPublishedTitle };
  };

  return TranslationStatusBadge;
}
