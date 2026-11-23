/**
 * Run: node --test tools/create-section-components/ai-source-fixup.group-titles.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  captureGroupTitlesFromRepeats,
  injectGroupTitlesFromRepeats,
} from './ai-source-fixup.mjs';

describe('captureGroupTitlesFromRepeats', () => {
  it('reads title or name from repeat values', () => {
    const titles = captureGroupTitlesFromRepeats({
      repeats: [
        {
          value: [
            { name: 'Mobiliteit', links: [] },
            { title: 'Woning', links: [] },
            { name: 'Gezin' },
          ],
        },
      ],
    });
    assert.deepEqual(titles, ['Mobiliteit', 'Woning', 'Gezin']);
  });
});

describe('injectGroupTitlesFromRepeats', () => {
  it('replaces collapsed Alle verzekeringen Titles from repeat names', () => {
    const info = {
      heading: 'Alle verzekeringen',
      repeats: [
        {
          value: [
            { name: 'Mobiliteit' },
            { name: 'Woning' },
            { name: 'Gezin' },
          ],
        },
      ],
    };
    const src = `
export const insuranceCategoryDefinition = {
  displayName: "Insurance Category",
  content: {
    items: [
      {
        name: "Mobility",
        displayName: "Alle verzekeringen",
        fields: { Title: "Alle verzekeringen" },
        children: [
          { name: "Car", displayName: "Autoverzekering", fields: { Link: { text: "Auto", url: "/a" } } }
        ]
      },
      {
        name: "Home",
        displayName: "Alle verzekeringen",
        fields: { Title: "Alle verzekeringen" },
        children: []
      },
      {
        name: "Family",
        displayName: "Alle verzekeringen",
        fields: { Title: "Alle verzekeringen" },
        children: []
      }
    ]
  }
};
`;
    const out = injectGroupTitlesFromRepeats(src, info);
    assert.match(out, /name: "Mobility",\s*displayName: "Mobiliteit"/);
    assert.match(out, /Title: "Mobiliteit"/);
    assert.match(out, /name: "Home",\s*displayName: "Woning"/);
    assert.match(out, /Title: "Woning"/);
    assert.match(out, /name: "Family",\s*displayName: "Gezin"/);
    assert.match(out, /Title: "Gezin"/);
    // Child labels untouched
    assert.match(out, /displayName: "Autoverzekering"/);
    // Root component displayName untouched
    assert.match(out, /displayName: "Insurance Category"/);
  });

  it('does not overwrite distinct card Titles with category names', () => {
    const info = {
      heading: 'Interessant voor jou',
      repeats: [{ value: [{ name: 'Card A' }, { name: 'Card B' }] }],
    };
    const src = `
content: {
  items: [
    { name: "One", displayName: "Woning", fields: { Title: "Woning" } },
    { name: "Two", displayName: "Auto", fields: { Title: "Auto" } }
  ]
}
`;
    const out = injectGroupTitlesFromRepeats(src, info);
    assert.match(out, /Title: "Woning"/);
    assert.match(out, /Title: "Auto"/);
  });
});
