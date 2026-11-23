import React, { JSX } from 'react';
import { Image, AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { ImageField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface Fields {
  'Background Graphic': ImageField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const footerColumnsBase = 'footer-columns';
  const footerColumnsName = phKey ? `${footerColumnsBase}-${phKey}` : footerColumnsBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <footer className="relative z-[3] overflow-hidden bg-[#f4f4f4] py-12">
      <Image
        field={fields['Background Graphic']}
        className="pointer-events-none absolute -bottom-12 -right-56 -z-0 w-[31rem] max-w-none"
      />
      <div className="relative z-[1] mx-auto max-w-[1336px] px-4 min-[692px]:px-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-8 min-[692px]:grid-cols-2 lg:grid-cols-4">
          <AppPlaceholder
            name={footerColumnsName}
            rendering={rendering}
            page={page}
            componentMap={componentMap}
          />
        </div>
      </div>
    </footer>
  );
};

export default Default;
