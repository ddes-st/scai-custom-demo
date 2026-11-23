import { JSX } from 'react';
import { Text, Link } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import { getDatasource, getFieldValue } from 'lib/component-props';

type LinkChild = {
  link?: LinkField | { jsonValue?: LinkField };
  fields?: { Link?: LinkField };
};

type Datasource = {
  heading?: Field<string> | { jsonValue?: Field<string> };
  Heading?: Field<string>;
  tone?: Field<string> | { jsonValue?: Field<string> };
  Tone?: Field<string>;
  children?: { results?: LinkChild[] };
};

type Props = ComponentWithContextProps & {
  fields?: Datasource | { data?: { datasource?: Datasource } };
};

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Datasource>(props.fields);
  const heading =
    getFieldValue(datasource?.heading) ?? datasource?.Heading;
  const toneField = getFieldValue(datasource?.tone) ?? datasource?.Tone;
  const mint = String(toneField?.value ?? '') === 'mint';
  const links = datasource?.children?.results ?? [];

  return (
    <section className="px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[118rem]">
        <h2 className="mb-4 pt-2 text-2xl font-bold leading-8 md:text-[2.8rem] md:leading-9">
          <Text field={heading} />
        </h2>
        <div className="grid gap-4 lg:grid-cols-2 lg:grid-cols-3">
          <div
            className={`flex flex-col rounded-2xl p-6 ${mint ? 'bg-[#d7f4ed]' : 'bg-[#f0f7fe]'}`}
          >
            <h3 className="mb-5 text-xl font-bold md:text-[2.2rem]">
              <Text field={heading} />
            </h3>
            <ul className="list-none mb-6 w-full space-y-3">
              {links.map((item: LinkChild, index: number) => {
                const linkField =
                  getFieldValue(item.link) ?? item.fields?.Link;
                if (!linkField) return null;
                return (
                  <li
                    key={index}
                    className="relative pl-7 leading-6 before:absolute before:left-0 before:top-1 before:text-xl before:content-['→']"
                  >
                    <Link
                      field={linkField}
                      className="underline decoration-1 underline-offset-2"
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
