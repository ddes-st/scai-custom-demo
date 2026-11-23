import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Copyright: TextField;
  "Site Map Link": LinkField;
}

type FooterBarProps = ComponentProps & { fields: Fields };

export const Default = (props: FooterBarProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <div
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="border-t border-white/20 bg-[#0c0e45] text-white font-[Source_Sans_Pro] text-[13px]"
    >
      <div className="mx-auto flex w-full max-w-[1110px] flex-col items-stretch lg:flex-row lg:items-center lg:px-5">
        <div className="order-1 px-5 py-4 text-center lg:order-2 lg:flex-1 lg:px-0 lg:py-4 lg:text-left">
          <Link field={fields["Site Map Link"]} />
        </div>
        <div className="order-2 border-t border-white/20 px-5 py-4 text-center lg:order-1 lg:border-t-0 lg:px-0 lg:py-4 lg:text-left">
          <Text field={fields.Copyright} />
        </div>
      </div>
    </div>
  );
};
