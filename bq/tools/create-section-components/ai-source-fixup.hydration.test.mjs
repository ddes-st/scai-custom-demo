import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ensureSuppressHydrationWarningOnLinks,
  ensureSuppressHydrationWarningOnVariantRoots,
  normalizeComponentTsx,
} from './ai-source-fixup.mjs';

describe('ensureSuppressHydrationWarningOnLinks', () => {
  it('adds suppressHydrationWarning to Link tags missing it', () => {
    const src = `export const Default = () => (
  <div>
    <Link field={linkField} className="a" />
    <Link field={other}>
      <Text field={title} />
    </Link>
  </div>
);
`;
    const out = ensureSuppressHydrationWarningOnLinks(src);
    assert.equal((out.match(/<Link\b[^>]*\bsuppressHydrationWarning\b/g) || []).length, 2);
  });

  it('is idempotent when already present', () => {
    const src = `<Link field={f} suppressHydrationWarning className="a" />`;
    const out = ensureSuppressHydrationWarningOnLinks(src);
    assert.equal(out, src);
  });

  it('does not treat => inside field={…} as the Link tag end', () => {
    const src = `<Link field={items.find((item) => item.Logo)?.Link ?? getLinkField(items[0])} className="mr-6 shrink-0">
<Image field={logo} />
</Link>`;
    const out = ensureSuppressHydrationWarningOnLinks(src);
    assert.match(out, /field=\{items\.find\(\(item\) => item\.Logo\)/);
    assert.match(out, /suppressHydrationWarning/);
    assert.doesNotMatch(out, /\(item\) = showLinkText|\(item\) = suppress/);
  });
});

describe('ensureSuppressHydrationWarningOnVariantRoots', () => {
  it('adds suppressHydrationWarning on FooterLegal-like block return root', () => {
    const src = `export const Default = (props: Props) => {
  const renderingId = props.params?.id;
  return (
    <div
      key={renderingId}
      className="flex w-full"
    >
      <Link field={linkField} className="text-sm" />
    </div>
  );
};
`;
    const out = ensureSuppressHydrationWarningOnVariantRoots(src);
    assert.match(out, /<div\b[^>]*\bsuppressHydrationWarning\b/);
    assert.doesNotMatch(out, /<Link\b[^>]*\bsuppressHydrationWarning\b/);
  });

  it('adds suppressHydrationWarning on arrow implicit-return root', () => {
    const src = `export const Default = () => (
  <section className="hero">
    <h1>Hi</h1>
  </section>
);
`;
    const out = ensureSuppressHydrationWarningOnVariantRoots(src);
    assert.match(out, /<section\b[^>]*\bsuppressHydrationWarning\b/);
  });

  it('is idempotent on roots that already have the prop', () => {
    const src = `export const Default = () => (
  <div suppressHydrationWarning className="x">ok</div>
);
`;
    const out = ensureSuppressHydrationWarningOnVariantRoots(src);
    assert.equal((out.match(/\bsuppressHydrationWarning\b/g) || []).length, 1);
  });

  it('does not inject suppressHydrationWarning on PascalCase custom roots', () => {
    const src = `export const Default = (props: Props) => {
  return (
    <ClientWrapper>
      <p>banner</p>
    </ClientWrapper>
  );
};
`;
    const out = ensureSuppressHydrationWarningOnVariantRoots(src);
    assert.equal(out, src);
    assert.doesNotMatch(out, /<ClientWrapper\b[^>]*\bsuppressHydrationWarning\b/);
  });

  it('does not inject on self-closing PascalCase custom roots', () => {
    const src = `export const Default = () => (
  <ClientWrapper/>
);
`;
    const out = ensureSuppressHydrationWarningOnVariantRoots(src);
    assert.equal(out, src);
    assert.doesNotMatch(out, /suppressHydrationWarning/);
  });

  it('does not inject on PascalCase root even when a DOM child exists inside', () => {
    const src = `export const Default = () => (
  <ClientWrapper>
    <section className="banner">ok</section>
  </ClientWrapper>
);
`;
    const out = ensureSuppressHydrationWarningOnVariantRoots(src);
    assert.doesNotMatch(out, /<ClientWrapper\b[^>]*\bsuppressHydrationWarning\b/);
    // Root inject only looks at the first open tag; nested DOM is AI's job.
    assert.doesNotMatch(out, /<section\b[^>]*\bsuppressHydrationWarning\b/);
  });
});

describe('normalizeComponentTsx hydration wiring', () => {
  it('applies link + root suppressHydrationWarning together', () => {
    const src = `import { Link } from '@sitecore-content-sdk/nextjs';
interface Fields {
  Link: import('@sitecore-content-sdk/nextjs').LinkField;
}
type Props = { fields: Fields; params?: Record<string, string>; rendering?: { uid?: string; params?: Record<string, string> } };
export const Default = (props: Props) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const linkField = fields.Link;
  return (
    <div key={renderingId || props.rendering?.uid} className="flex w-full">
      <ul>
        <li>
          <Link field={linkField} className="text-sm" />
        </li>
      </ul>
    </div>
  );
};
`;
    const out = normalizeComponentTsx(src);
    assert.match(out, /<div\b[^>]*\bsuppressHydrationWarning\b/);
    assert.match(out, /<Link\b[^>]*\bsuppressHydrationWarning\b/);
  });

  it('adds spaced suppressHydrationWarning on valid childless Link (no showLinkText rewrite)', () => {
    const src = `import { Link } from '@sitecore-content-sdk/nextjs';
interface Fields {
  Request Demo Link: import('@sitecore-content-sdk/nextjs').LinkField;
}
type Props = { fields: Fields; params?: Record<string, string>; rendering?: { uid?: string; params?: Record<string, string> } };
export const Default = (props: Props) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const requestDemoField = fields["Request Demo Link"];
  const isEditing = Boolean(props.page?.mode?.isEditing);
  return (
    <div key={renderingId || props.rendering?.uid} className="flex">
      {(requestDemoField?.value?.href || isEditing) && (
        <Link field={requestDemoField} className="flex items-center" />
      )}
    </div>
  );
};
`;
    const out = normalizeComponentTsx(src);
    assert.doesNotMatch(out, /showLinkTextWithChildrenPresent/);
    assert.match(out, /<Link\b[^>]*\bsuppressHydrationWarning\b[^>]*\/>/);
  });

  it('adds suppressHydrationWarning on sibling Links without rewriting showLinkText', () => {
    const src = `import { Link, Text } from '@sitecore-content-sdk/nextjs';
interface Fields {
  Message: import('@sitecore-content-sdk/nextjs').Field<string>;
  'Privacy Policy Link': import('@sitecore-content-sdk/nextjs').LinkField;
  'Storage Preferences Link': import('@sitecore-content-sdk/nextjs').LinkField;
  'Storage Preferences Label': import('@sitecore-content-sdk/nextjs').Field<string>;
}
type Props = { fields: Fields; params?: Record<string, string>; rendering?: { uid?: string; params?: Record<string, string> } };
export const Default = (props: Props) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const privacyPolicyField = fields['Privacy Policy Link'];
  const storagePreferencesField = fields['Storage Preferences Link'];
  return (
    <div key={renderingId || props.rendering?.uid}>
      <p>
        <Text field={fields.Message} />{' '}
        <Link field={privacyPolicyField} className="underline" />
      </p>
      <Link field={storagePreferencesField} className="underline">
        <Text field={fields["Storage Preferences Label"]} />
      </Link>
    </div>
  );
};
`;
    const out = normalizeComponentTsx(src);
    assert.doesNotMatch(out, /showLinkTextWithChildrenPresent/);
    assert.match(
      out,
      /<Link\b[^>]*\bfield=\{privacyPolicyField\}[^>]*\bsuppressHydrationWarning\b[^>]*\/>/,
    );
    assert.match(
      out,
      /<Link\b[^>]*\bfield=\{storagePreferencesField\}[^>]*\bsuppressHydrationWarning\b/,
    );
  });
});
