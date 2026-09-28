'use client';
import { ComponentProps } from '@/lib/component-props';
import { cn } from '@/lib/utils';
import { TypeaheadSearchBox, TypeaheadFields } from '@/lib/search-ui/TypeaheadSearchBox';

interface SearchTypeaheadProps extends ComponentProps {
  fields: TypeaheadFields;
}

const EmptyStateFallback = () => (
  <div className="component search-typeahead">
    <span className="is-empty-hint">SearchTypeahead</span>
  </div>
);

export const Default = (props: SearchTypeaheadProps) => {
  const { fields, params, page, rendering } = props;
  const isEditing = page?.mode?.isEditing ?? false;

  if (!fields || !fields?.SearchIndex?.value) {
    return isEditing ? <EmptyStateFallback /> : null;
  }

  return (
    <section
      className={cn('component search-typeahead', params?.styles)}
      id={params?.RenderingIdentifier || undefined}
    >
      <div className="mx-auto max-w-7xl px-6 pt-6">
        <TypeaheadSearchBox
          fields={fields}
          page={page}
          rendering={rendering}
          className="max-w-md"
        />
      </div>
    </section>
  );
};

// Slim strip that extends the site header: brand header background, hairline
// bottom border, right-aligned compact pill search box. For sites whose
// NavigationHeader does not embed the search slot directly.
export const Header = (props: SearchTypeaheadProps) => {
  const { fields, params, page, rendering } = props;
  const isEditing = page?.mode?.isEditing ?? false;

  if (!fields || !fields?.SearchIndex?.value) {
    return isEditing ? <EmptyStateFallback /> : null;
  }

  return (
    <section
      className={cn('component search-typeahead', params?.styles)}
      id={params?.RenderingIdentifier || undefined}
    >
      <div
        className="w-full border-b"
        style={{
          backgroundColor: 'var(--brand-header-bg, #ffffff)',
          borderColor: 'var(--brand-border, #e5e7eb)',
        }}
      >
        <div className="mx-auto flex max-w-7xl justify-end px-4 py-2 sm:px-6">
          <TypeaheadSearchBox
            fields={fields}
            page={page}
            rendering={rendering}
            compact
            className="w-full max-w-xs"
          />
        </div>
      </div>
    </section>
  );
};
