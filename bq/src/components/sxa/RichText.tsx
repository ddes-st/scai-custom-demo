import React from 'react';
import { RichText as ContentSdkRichText } from '@sitecore-content-sdk/nextjs';
import { RichTextProps } from './sxa-rich-text.props';

export const Default = (props: RichTextProps) => {
  const text = props.fields ? (
    <ContentSdkRichText field={props.fields.Text} />
  ) : (
    <span className="is-empty-hint">Rich text</span>
  );
  const id = props.params.RenderingIdentifier;
  const styles = String(props.params.styles || props.params.Styles || '').trimEnd();

  return (
    <div className={`component rich-text ${styles}`.trim()} id={id ? id : undefined}>
      <div className="component-content">{text}</div>
    </div>
  );
};
