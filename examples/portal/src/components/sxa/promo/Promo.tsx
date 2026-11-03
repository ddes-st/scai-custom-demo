// Adapted from Sitecore's xmcloud-starter-js (examples/kit-nextjs-skate-park/src/components/promo/Promo.tsx),
// Apache License 2.0 — see ../LICENSE-xmcloud-starter-js.md.
// Changes: the SDK's plain Image instead of NextImage, DAM images through the portal; no JSON-LD (structured data) output;
// the wrapper is a module-level component, not one created during render.
import React, { JSX } from 'react';
import {
  Image as ContentSdkImage,
  ImageField,
  RichText as ContentSdkRichText,
} from '@sitecore-content-sdk/nextjs';
import { portalImageField } from 'src/lib/portal/dam-image';
import { CompatibleLink } from 'components/content-sdk/CompatibleLink';
import { getFieldValue } from 'lib/component-props';
import { PromoContentProps, PromoFields as Fields, PromoProps } from './promo.props';

const Wrapper = ({ styles, id, children }: { styles?: string; id?: string; children: JSX.Element }): JSX.Element => (
  <article className={`component promo ${styles ?? ''}`.trim()} id={id}>
    <div className="component-content">{children}</div>
  </article>
);

const PromoContent = (props: PromoContentProps): JSX.Element => {
  const { fields, params, renderText } = props;
  const { styles, RenderingIdentifier: id } = params;

  if (!fields) {
    return (
      <Wrapper styles={styles} id={id}>
        <span className="is-empty-hint">Promo</span>
      </Wrapper>
    );
  }

  const promoIconField = getFieldValue(fields.PromoIcon);
  const promoTextField = getFieldValue(fields.PromoText);
  const promoLinkField = getFieldValue(fields.PromoLink);

  return (
    <Wrapper styles={styles} id={id}>
      <>
        <figure className="field-promoicon">
          <ContentSdkImage field={portalImageField(promoIconField as ImageField | undefined, 640)} />
        </figure>
        <div className="promo-text">
          {renderText(fields)}
        </div>
      </>
    </Wrapper>
  );
};

export const Default = (props: PromoProps): JSX.Element => {
  const renderText = (fields: Fields) => {
    const promoTextField = getFieldValue(fields.PromoText);
    const promoLinkField = getFieldValue(fields.PromoLink);

    return (
      <>
        <div className="field-promotext">
          <ContentSdkRichText field={promoTextField} />
        </div>
        <div className="field-promolink">
          {promoLinkField ? <CompatibleLink field={promoLinkField} /> : null}
        </div>
      </>
    );
  };

  return <PromoContent {...props} renderText={renderText} />;
};

export const WithText = (props: PromoProps): JSX.Element => {
  const renderText = (fields: Fields) => (
    <>
      <div className="field-promotext">
        <ContentSdkRichText className="promo-text" field={getFieldValue(fields.PromoText)} />
      </div>
      <div className="field-promotext">
        <ContentSdkRichText className="promo-text" field={getFieldValue(fields.PromoText2)} />
      </div>
    </>
  );

  return <PromoContent {...props} renderText={renderText} />;
};