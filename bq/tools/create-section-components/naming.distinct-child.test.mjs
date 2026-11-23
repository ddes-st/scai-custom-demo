/**
 * Run: node --test tools/create-section-components/naming.distinct-child.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  distinctCompositeChildPascal,
  ensureDistinctCompositeChildren,
  toDefinitionKey,
} from './naming.mjs';

describe('distinctCompositeChildPascal', () => {
  it('strips Carousel suffix when child equals parent', () => {
    assert.equal(
      distinctCompositeChildPascal(
        'SitecoreFeatureCardCarousel',
        'SitecoreFeatureCardCarousel',
      ),
      'SitecoreFeatureCard',
    );
  });

  it('appends Item when stripped name has no card/item suffix', () => {
    assert.equal(
      distinctCompositeChildPascal('SitecoreAwardsCarousel', 'SitecoreAwardsCarousel'),
      'SitecoreAwardsItem',
    );
  });

  it('keeps already-distinct child names', () => {
    assert.equal(
      distinctCompositeChildPascal('SitecoreEventCarousel', 'SitecoreContentCarousel'),
      'SitecoreContentCarousel',
    );
  });

  it('maps AwardBadgeCarousel → AwardBadge', () => {
    assert.equal(
      distinctCompositeChildPascal(
        'SitecoreAwardBadgeCarousel',
        'SitecoreAwardBadgeCarousel',
      ),
      'SitecoreAwardBadge',
    );
  });
});

describe('ensureDistinctCompositeChildren', () => {
  it('renames self-same children and yields distinct definitionKeys', () => {
    const kids = [
      { componentName: 'SitecoreFeatureCardCarousel', repeatHint: 7 },
    ];
    ensureDistinctCompositeChildren('SitecoreFeatureCardCarousel', kids);
    assert.equal(kids[0].componentName, 'SitecoreFeatureCard');
    assert.notEqual(
      toDefinitionKey(kids[0].componentName),
      toDefinitionKey('SitecoreFeatureCardCarousel'),
    );
  });

  it('leaves distinct children unchanged', () => {
    const kids = [{ componentName: 'SitecoreBenefitCard', repeatHint: 3 }];
    ensureDistinctCompositeChildren('SitecoreCardGrid', kids);
    assert.equal(kids[0].componentName, 'SitecoreBenefitCard');
  });
});
