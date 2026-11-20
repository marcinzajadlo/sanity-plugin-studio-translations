import { BoundaryElementProvider, Flex, Grid, Select } from "@sanity/ui";
import type { ComponentType } from "react";
import type { ToolMenuProps } from "sanity";
import type { TranslationsConfig } from "../config";

/** @public */
export interface LanguageSelectorOptions {
  /** Reload the Studio after switching language so structure filters and templates pick it up. Default: `true`. */
  reloadOnChange?: boolean;
  /** Render only the default tool menu when there is a single language. Default: `true`. */
  hideWhenSingle?: boolean;
}

/**
 * Creates a `studio.components.toolMenu` component that renders the default tool menu
 * plus a Studio language select.
 *
 * @public
 */
export function createLanguageSelector(config: TranslationsConfig, options: LanguageSelectorOptions = {}): ComponentType<ToolMenuProps> {
  const { reloadOnChange = true, hideWhenSingle = true } = options;

  function LanguageSelector(props: ToolMenuProps) {
    const toolMenu = <BoundaryElementProvider element={document.body}>{props.renderDefault(props)}</BoundaryElementProvider>;

    if (hideWhenSingle && config.languages.length < 2) {
      return toolMenu;
    }

    const onChange = (id: string) => {
      config.setStudioLanguage(id);

      if (reloadOnChange) {
        location.reload();
      }
    };

    return (
      <Grid gridTemplateColumns={[1, 1, 1, 2]} gap={[2, 2, 2, 0]}>
        {toolMenu}

        <Flex style={{ width: "fit-content" }}>
          <Select fontSize={1} radius={6} onChange={(e) => onChange(e.currentTarget.value)} defaultValue={config.getStudioLanguage()}>
            {config.languages.map((language) => (
              <option key={language.id} value={language.id}>
                {language.title}
              </option>
            ))}
          </Select>
        </Flex>
      </Grid>
    );
  }

  return LanguageSelector;
}
