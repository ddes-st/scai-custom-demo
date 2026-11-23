import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDatasourceProps,
  buildFlatFieldsProps,
  buildPreviewProps,
  mergePreviewFieldsForItem,
  parseFieldTypesFromDefinition,
  seedToSitecoreField,
} from './build-preview-props.mjs';

describe('buildPreviewProps', () => {
  it('maps text and link seeds', () => {
    const def = `
export const x = {
  content: {
    items: [
      {
        name: 'A',
        fields: {
          Title: 'Hello',
          CTA: { text: 'Go', url: '/x' },
        },
      },
    ],
  },
};
`;
    const props = buildPreviewProps(def);
    assert.equal(props.fields.Title.value, 'Hello');
    assert.equal(props.fields.CTA.value.href, '/x');
    assert.ok(props.fields.data?.datasource);
  });

  it('scopes flat + datasource to named content item (no items[0] leak)', () => {
    const def = `
export const x = {
  model: { itemTemplate: { sections: [{ fields: [
    { name: 'Heading', type: 'Single-Line Text' },
  ] }] } },
  content: {
    items: [
      { name: 'First', fields: { Heading: 'Alpha' } },
      { name: 'Second', fields: { Heading: 'Beta' } },
    ],
  },
};
`;
    const props = buildPreviewProps(def, 'Second');
    assert.equal(props.fields.Heading.value, 'Beta');
    assert.equal(
      props.fields.data?.datasource?.Heading?.value ??
        props.fields.data?.datasource?.heading?.value,
      'Beta',
    );
    const ds = buildDatasourceProps(def, 'Second');
    assert.equal(ds.fields.Heading.value, 'Beta');
  });

  it('maps image seeds with src', () => {
    const f = seedToSitecoreField({ src: 'https://example.com/a.png', alt: 'A' });
    assert.equal(f.value.src, 'https://example.com/a.png');
    assert.equal(f.value.alt, 'A');
  });

  it('maps AI image seeds { url, alt } via heuristic', () => {
    const f = seedToSitecoreField({
      url: 'https://example.com/logo.svg',
      alt: 'Homepage',
    });
    assert.equal(f.value.src, 'https://example.com/logo.svg');
    assert.equal(f.value.alt, 'Homepage');
    assert.equal(f.value.href, undefined);
  });

  it('maps { svgMarkup, alt } Image seeds to a data-URI src', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>';
    const f = seedToSitecoreField({ svgMarkup: svg, alt: 'Energyprice.be' }, 'Logo', 'Image');
    assert.ok(String(f.value.src).startsWith('data:image/svg+xml;charset=utf-8,'));
    assert.ok(String(f.value.src).includes(encodeURIComponent('<svg')));
    assert.equal(f.value.alt, 'Energyprice.be');
  });

  it('maps untyped { svgMarkup, alt } via heuristic', () => {
    const svg = '<svg><circle cx="1" cy="1" r="1"/></svg>';
    const f = seedToSitecoreField({ svgMarkup: svg, alt: 'Mark' });
    assert.ok(String(f.value.src).startsWith('data:image/svg+xml'));
    assert.equal(f.value.alt, 'Mark');
  });

  it('keeps { text, url } as Link (not Image)', () => {
    const f = seedToSitecoreField({ text: 'Home', url: 'https://example.com/' });
    assert.equal(f.value.href, 'https://example.com/');
    assert.equal(f.value.text, 'Home');
    assert.equal(f.value.src, undefined);
  });

  it('maps Image by field type even without alt', () => {
    const f = seedToSitecoreField(
      { url: 'https://example.com/hero.jpg' },
      'Hero Image',
      'Image',
    );
    assert.equal(f.value.src, 'https://example.com/hero.jpg');
    assert.equal(f.value.alt, 'Hero Image');
  });

  it('maps all childItemTemplate fields onto children.results', () => {
    const def = `
export const crelanConsentPreferencesModalDefinition = {
  model: {
    itemTemplate: {
      name: 'Modal',
      sections: [{ name: 'Data', fields: [{ name: 'Heading', type: 'Single-Line Text' }] }],
    },
    childItemTemplate: {
      name: 'Category',
      sections: [{
        name: 'Data',
        fields: [
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Status', type: 'Single-Line Text' },
          { name: 'Enabled', type: 'Checkbox' },
          { name: 'Configurable', type: 'Checkbox' },
        ],
      }],
    },
  },
  content: {
    items: [{
      name: 'Cookie Preferences',
      fields: { Heading: 'Voorkeurenmenu' },
      children: [{
        name: 'Strictly Necessary',
        fields: {
          Title: 'Strikt noodzakelijke cookies',
          Status: 'Altijd actief',
          Enabled: true,
          Configurable: false,
        },
      }],
    }],
  },
};
`;
    const props = buildPreviewProps(def);
    const child = props.fields.data.datasource.children.results[0];
    assert.equal(child.field.title.value, 'Strikt noodzakelijke cookies');
    assert.equal(child.field.status.value, 'Altijd actief');
    assert.equal(child.field.enabled.value, true);
    assert.equal(child.field.configurable.value, false);
    assert.equal(props.fields.data.datasource.heading.value, 'Voorkeurenmenu');
    // PascalCase for getDatasource().Heading (promoted List.reference TSX)
    assert.equal(props.fields.data.datasource.Heading.value, 'Voorkeurenmenu');
  });

  it('maps typed Image seeds from full definition', () => {
    const def = `
export const crelanMainMenuDefinition = {
  model: {
    itemTemplate: {
      name: 'Main Menu',
      sections: [
        {
          name: 'Data',
          fields: [
            { name: 'Logo', type: 'Image', default: { url: 'https://ex/logo.svg', alt: 'Logo' } },
            { name: 'Home Link', type: 'General Link', default: { text: 'Home', url: '/' } },
          ],
        },
      ],
    },
  },
  content: {
    items: [
      {
        name: 'Main Menu',
        fields: {
          Logo: { url: 'https://ex/logo.svg', alt: 'Homepage' },
          'Home Link': { text: 'Home', url: 'https://ex/' },
        },
      },
    ],
  },
};
`;
    const types = parseFieldTypesFromDefinition(def);
    assert.equal(types.item.Logo, 'Image');
    assert.equal(types.item['Home Link'], 'General Link');

    const props = buildPreviewProps(def);
    assert.equal(props.fields.Logo.value.src, 'https://ex/logo.svg');
    assert.equal(props.fields.Logo.value.alt, 'Homepage');
    assert.equal(props.fields['Home Link'].value.href, 'https://ex/');
    assert.equal(props.fields['Home Link'].value.text, 'Home');
    assert.equal(props.fields['Home Link'].value.src, undefined);
  });

  it('mergePreviewFieldsForItem clears Image when item omits it', () => {
    const def = `
export const d = {
  model: {
    itemTemplate: {
      name: 'Card',
      sections: [{
        name: 'Data',
        fields: [
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Image', type: 'Image' },
        ],
      }],
    },
  },
  content: {
    items: [
      {
        name: 'Apple Pay Card',
        fields: {
          Title: 'Apple',
          Image: { url: 'https://cdn.example.com/apple.png', alt: 'Apple' },
        },
      },
      {
        name: 'Customer Card',
        fields: {
          Title: 'Word klant',
        },
      },
    ],
  },
};
`;
    const defaults = buildPreviewProps(def);
    assert.ok(defaults.fields.Image?.value?.src);
    const flatCustomer = buildFlatFieldsProps(def, 'Customer Card');
    const merged = mergePreviewFieldsForItem(
      defaults.fields,
      flatCustomer.fields,
      def,
    );
    assert.equal(merged.Title.value, 'Word klant');
    assert.equal(merged.Image?.value?.src, '');
    assert.ok(defaults.fields.Image?.value?.src, 'defaults unchanged');
  });
});
