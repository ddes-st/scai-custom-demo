import React, { JSX } from 'react';
import { Text } from '@sitecore-content-sdk/nextjs';
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Category: Field<string>;
  Enabled: Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <li className="m-0" />;
  }

  const enabled = fields.Enabled?.value === true || String(fields.Enabled?.value) === '1';

  return (
    <li className="m-0">
      <label className="my-1 flex min-h-6 cursor-pointer flex-row items-center">
        <input type="checkbox" role="switch" defaultChecked={enabled} className="peer sr-only" />
        <span className="relative block h-6 w-11 shrink-0 rounded-[14px] border-2 border-[#909090] bg-[#909090] transition-colors peer-checked:border-[#37cd8f] peer-checked:bg-[#37cd8f] after:absolute after:left-0 after:top-0 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
        <span className="ml-1.5 whitespace-nowrap">
          <Text field={fields.Category} />
        </span>
      </label>
    </li>
  );
};

export default Default;
