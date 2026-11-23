/**
 * Wire-time: self-nested layoutSketch must fall back to package children.
 * Run: node --import tsx --test tools/create-section-components/resolve-children-from-sketch.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { presentationChildrenFromLayoutSketch } from './html-multi-band-contract.mjs';
import { resolveChildrenFromSketchOrPackages } from './presentation.mjs';

describe('resolveChildrenFromSketchOrPackages', () => {
  it('falls back when sketch only nests the host under itself', () => {
    const hostKey = 'menzis-footer-support-navigation';
    const layoutSketch = {
      renderings: [
        {
          componentName: 'MenzisFooterSupportNavigation',
          placeholders: {
            'account-links': [
              {
                componentName: 'MenzisFooterSupportNavigation',
                datasourceName: 'Footer Support Navigation Links',
              },
            ],
          },
        },
      ],
    };
    const componentResults = [
      {
        role: 'section',
        componentName: 'MenzisFooterSupportNavigation',
        definitionKey: hostKey,
      },
      {
        role: 'child',
        componentName: 'MenzisFooterAccountLinks',
        definitionKey: 'menzis-footer-account-links',
        contentItemNames: ['Footer Support Navigation Links'],
      },
    ];
    const children = resolveChildrenFromSketchOrPackages({
      layoutSketch,
      componentResults,
      parentDefinitionKey: hostKey,
      mapSketch: presentationChildrenFromLayoutSketch,
      buildFallback: () => [
        {
          definitionKey: 'menzis-footer-account-links',
          datasourceItem: 'Footer Support Navigation Links',
          placeholder: 'account-links',
        },
      ],
    });
    assert.equal(children.length, 1);
    assert.equal(children[0].definitionKey, 'menzis-footer-account-links');
  });

  it('keeps valid sketch children when not self-nested', () => {
    const hostKey = 'menzis-footer-support-navigation';
    const layoutSketch = {
      componentName: 'MenzisFooterSupportNavigation',
      placeholders: {
        'account-links': [
          {
            componentName: 'MenzisFooterAccountLinks',
            datasourceName: 'Links',
          },
        ],
      },
    };
    const componentResults = [
      {
        role: 'section',
        componentName: 'MenzisFooterSupportNavigation',
        definitionKey: hostKey,
      },
      {
        role: 'child',
        componentName: 'MenzisFooterAccountLinks',
        definitionKey: 'menzis-footer-account-links',
      },
    ];
    const children = resolveChildrenFromSketchOrPackages({
      layoutSketch,
      componentResults,
      parentDefinitionKey: hostKey,
      mapSketch: presentationChildrenFromLayoutSketch,
      buildFallback: () => [{ definitionKey: 'should-not-use' }],
    });
    assert.equal(children.length, 1);
    assert.equal(children[0].definitionKey, 'menzis-footer-account-links');
    assert.equal(children[0].datasourceItem, 'Links');
  });
});
