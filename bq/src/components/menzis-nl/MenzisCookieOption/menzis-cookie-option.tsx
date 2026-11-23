import React, { JSX } from 'react';
import { Text } from '@sitecore-content-sdk/nextjs';
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Label: Field<string>;
  Description: Field<string>;
  Value: Field<string>;
  Selected: Field<boolean>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;
  if (!fields) return <div>Missing Component Datasource.</div>;

  const selected = fields.Selected?.value === true || String(fields.Selected?.value) === '1';
  const value = String(fields.Value?.value ?? '');

  return (
    <div className="w-full">
      <label
        className="relative flex cursor-pointer items-start py-1 pl-8 text-base font-normal leading-6"
        htmlFor={`CookieOptions_Value_${value}`}
      >
        <span className="absolute left-0 top-1 inline-block h-5 w-5 rounded-full border border-[#043572] bg-white">
          <span className="absolute inset-[16.6667%] rounded-full bg-[#1a1a1a] transition-transform peer-checked:scale-100 scale-0" />
        </span>
        <input
          id={`CookieOptions_Value_${value}`}
          name="CookieOptions.Value"
          type="radio"
          value={value}
          defaultChecked={selected}
          className="peer sr-only"
        />
        <span>
          <Text field={fields.Label} />
        </span>
      </label>
      <p className="mb-1 mt-1 text-sm leading-6 text-[#043572]">
        <Text field={fields.Description} />
      </p>
    </div>
  );
};

export default Default;
