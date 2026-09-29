import React, { JSX } from "react";
import {
  Field,
  Page,
  DesignLibraryApp,
  ImageField,
  LinkField,
  RichTextField,
} from "@sitecore-content-sdk/nextjs";
import Scripts from "src/Scripts";
import SitecoreStyles from "components/content-sdk/SitecoreStyles";
import { AppPlaceholder } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";

interface LayoutProps {
  page: Page;
}

export interface PersonFields {
  personFirstName?: Field<string>;
  personLastName?: Field<string>;
  personJobTitle?: Field<string>;
  personProfileImage?: ImageField;
  personBio?: RichTextField;
  personLinkedIn?: LinkField;
}

export interface PersonReference {
  id?: string;
  name?: string;
  url?: string;
  fields?: PersonFields;
}

export interface RouteFields {
  [key: string]: unknown;
  // Standard page fields
  Title?: Field;
  MetaTitle?: Field;
  OpenGraphTitle?: Field;
  OpenGraphDescription?: Field;
  OpenGraphImage?: ImageField;
  TwitterTitle?: Field;
  TwitterDescription?: Field;
  TwitterImage?: ImageField;
  Robots?: Field;
  CanonicalUrl?: LinkField;
  BackgroundColor?: Field;
  metadataTitle?: Field;
  metadataKeywords?: Field;
  pageTitle?: Field;
  metadataDescription?: Field;
  pageSummary?: Field;
  ogTitle?: Field;
  ogDescription?: Field;
  ogImage?: ImageField;
  thumbnailImage?: ImageField;
  // Article Page fields
  ArticleContent?: RichTextField;
  ArticleImage?: ImageField;
  ArticleAuthor?: PersonReference;
  ArticlePublicationDate?: Field;
  ArticleKeyTakeaways?: RichTextField;
  ArticleReadTime?: Field;
  // Landing Page — Hero Data
  heroEyebrow?: Field<string>;
  heroHeadline?: Field<string>;
  heroSubhead?: Field<string>;
  heroPrimaryCta?: LinkField;
  heroSecondaryCta?: LinkField;
  heroImage?: ImageField;
  heroVideo?: LinkField;
  // Landing Page — Features Data
  feature1IconName?: Field<string>;
  feature1Title?: Field<string>;
  feature1Description?: RichTextField;
  feature2IconName?: Field<string>;
  feature2Title?: Field<string>;
  feature2Description?: RichTextField;
  feature3IconName?: Field<string>;
  feature3Title?: Field<string>;
  feature3Description?: RichTextField;
  // Landing Page — Stats Data
  stat1Number?: Field<string>;
  stat1Label?: Field<string>;
  stat2Number?: Field<string>;
  stat2Label?: Field<string>;
  stat3Number?: Field<string>;
  stat3Label?: Field<string>;
  // Landing Page — Social Proof Data
  testimonialQuote?: RichTextField;
  testimonialAuthorName?: Field<string>;
  testimonialAuthorTitle?: Field<string>;
  testimonialAuthorImage?: ImageField;
  partnerLogosImage?: ImageField;
  // Landing Page — FAQ Data
  faq1Question?: Field<string>;
  faq1Answer?: RichTextField;
  faq2Question?: Field<string>;
  faq2Answer?: RichTextField;
  faq3Question?: Field<string>;
  faq3Answer?: RichTextField;
  faq4Question?: Field<string>;
  faq4Answer?: RichTextField;
  faq5Question?: Field<string>;
  faq5Answer?: RichTextField;
  // Landing Page — Final CTA Data
  finalCtaHeadline?: Field<string>;
  finalCtaSubhead?: RichTextField;
  finalCtaButton?: LinkField;
  // Brand Page
  brandStyle?: Field<string>;
  brandHeroEyebrow?: Field<string>;
  brandHeroTitle?: Field<string>;
  brandHeroSubtitle?: RichTextField;
  brandHeroImage?: ImageField;
  brandHeroCta?: LinkField;
  brandPillarsTitle?: Field<string>;
  brandPillar1Title?: Field<string>;
  brandPillar1Description?: RichTextField;
  brandPillar1Image?: ImageField;
  brandPillar2Title?: Field<string>;
  brandPillar2Description?: RichTextField;
  brandPillar2Image?: ImageField;
  brandPillar3Title?: Field<string>;
  brandPillar3Description?: RichTextField;
  brandPillar3Image?: ImageField;
  brandPillar4Title?: Field<string>;
  brandPillar4Description?: RichTextField;
  brandPillar4Image?: ImageField;
  brandStoryTitle?: Field<string>;
  brandStoryBody?: RichTextField;
  brandStoryImage?: ImageField;
  brandHighlight1Title?: Field<string>;
  brandHighlight1Body?: RichTextField;
  brandHighlight2Title?: Field<string>;
  brandHighlight2Body?: RichTextField;
  brandHighlight3Title?: Field<string>;
  brandHighlight3Body?: RichTextField;
  brandCtaHeadline?: Field<string>;
  brandCtaSubhead?: RichTextField;
  brandCtaButton?: LinkField;
  brandFaqTitle?: Field<string>;
  brandFaq1Question?: Field<string>;
  brandFaq1Answer?: RichTextField;
  brandFaq2Question?: Field<string>;
  brandFaq2Answer?: RichTextField;
  brandFaq3Question?: Field<string>;
  brandFaq3Answer?: RichTextField;
  brandFaq4Question?: Field<string>;
  brandFaq4Answer?: RichTextField;
  brandFaq5Question?: Field<string>;
  brandFaq5Answer?: RichTextField;
  brandFaq6Question?: Field<string>;
  brandFaq6Answer?: RichTextField;
}

const Layout = ({ page }: LayoutProps): JSX.Element => {
  const { layout, mode } = page;
  const { route } = layout.sitecore;
  const mainClassPageEditing = mode.isEditing ? "editing-mode" : "prod-mode";

  const routeFields = (route?.fields ?? {}) as RouteFields;
  const bgHex = routeFields?.BackgroundColor?.value?.toString?.()?.trim();
  const isValidHex =
    bgHex && /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(bgHex);
  const rootStyle = isValidHex
    ? { backgroundColor: bgHex, minHeight: "100vh" }
    : undefined;

  return (
    <>
      <Scripts />
      <SitecoreStyles layoutData={layout} />
      {/* root placeholder for the app, which we add components to using route data */}
      <div className={mainClassPageEditing} style={rootStyle}>
        {mode.isDesignLibrary ? (
          route && (
            <DesignLibraryApp
              page={page}
              rendering={route}
              componentMap={componentMap}
              loadServerImportMap={() => import(".sitecore/import-map.server")}
            />
          )
        ) : (
          <>
            <header>
              <div id="header">
                {route && (
                  <AppPlaceholder
                    page={page}
                    componentMap={componentMap}
                    name="headless-header"
                    rendering={route}
                  />
                )}
              </div>
            </header>
            <main >             
              <div id="content">
                {route && (
                  <AppPlaceholder
                    page={page}
                    componentMap={componentMap}
                    name="headless-main"
                    rendering={route}
                  />
                )}
              </div>
            </main>
            <footer>
              <div id="footer">
                {route && (
                  <AppPlaceholder
                    page={page}
                    componentMap={componentMap}
                    name="headless-footer"
                    rendering={route}
                  />
                )}
              </div>
            </footer>
          </>
        )}
      </div>
    </>
  );
};

export default Layout;
