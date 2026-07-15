import React, { JSX } from 'react';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';

type SodexoArticleContentProps = ComponentProps & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields: any;
};

const SodexoArticleContentDefaultComponent = (): JSX.Element => (
  <div className="component sodexo-article-content">
    <div className="component-content">
      <span className="is-empty-hint">SodexoArticleContent</span>
    </div>
  </div>
);

export const Default = ({ params }: SodexoArticleContentProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  return (
    <div className={cn('component sodexo-article-content', styles)} id={RenderingIdentifier}>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <p className="text-sm opacity-60">
          This component has been decomposed into RichTextBlock, BenefitHighlight, FeatureHighlight, and RelatedContent.
        </p>
      </div>
    </div>
  );
};
