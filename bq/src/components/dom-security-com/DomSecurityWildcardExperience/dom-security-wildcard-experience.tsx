import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { ComponentMap, TextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import WildcardExperienceClient from './dom-security-wildcard-experience.client';

interface Fields {
  'Source Root'?: TextField;
}

type Props = ComponentWithContextProps & { fields?: Fields };

/**
 * Lazy-load the component map so module evaluation of this file does not
 * participate in a circular import with `.sitecore/component-map` (which
 * registers this component). A static top-level import of the map caused
 * `Cannot access 'Default' before initialization` when the map was annotated
 * `componentType: 'client'`.
 */
function getComponentMap(): ComponentMap {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('.sitecore/component-map') as { default: ComponentMap }).default;
}

/**
 * Server shell: resolves language / source root, renders the wildcard
 * placeholder, and wraps children in the client provider that fetches the
 * slug item via `/api/sitecore/igql`.
 */
export const Default = (props: Props) => {
  const { fields, rendering, params, page } = props;
  const language =
    page?.locale ||
    page?.layout?.sitecore?.context?.language ||
    'en';
  const sourceRoot = fields?.['Source Root']?.value?.toString() || '';
  const dynId = params?.DynamicPlaceholderId;
  const phKey = dynId ? `wildcard-content-${dynId}` : 'wildcard-content';
  const componentMap = getComponentMap();

  return (
    <WildcardExperienceClient sourceRoot={sourceRoot} language={language}>
      <AppPlaceholder
        name={phKey}
        rendering={rendering}
        page={page}
        componentMap={componentMap}
      />
    </WildcardExperienceClient>
  );
};
