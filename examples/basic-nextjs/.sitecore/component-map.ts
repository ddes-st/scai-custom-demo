// Below are built-in components that are available in the app, it's recommended to keep them as is

import { BYOCServerWrapper, NextjsContentSdkComponent, FEaaSServerWrapper } from '@sitecore-content-sdk/nextjs';
import { Form } from '@sitecore-content-sdk/nextjs';

// end of built-in components
import * as TestimonialBlock from 'src/components/uiim/social-proof/TestimonialBlock';
import * as LogoCloud from 'src/components/uiim/social-proof/LogoCloud';
import * as SearchExperienceV2 from 'src/components/uiim/search/SearchExperienceV2';
import * as TabNavigationSection from 'src/components/uiim/navigation/TabNavigationSection';
import * as SiteFooter from 'src/components/uiim/navigation/SiteFooter';
import * as NavigationHeader from 'src/components/uiim/navigation/NavigationHeader';
import * as AnnouncementBar from 'src/components/uiim/navigation/AnnouncementBar';
import * as SmartMedia from 'src/components/uiim/media/SmartMedia';
import * as ImageGallery from 'src/components/uiim/media/ImageGallery';
import * as LandingStats from 'src/components/uiim/landing/LandingStats';
import * as LandingSocialProof from 'src/components/uiim/landing/LandingSocialProof';
import * as LandingHero from 'src/components/uiim/landing/LandingHero';
import * as LandingFinalCTA from 'src/components/uiim/landing/LandingFinalCTA';
import * as LandingFeatures from 'src/components/uiim/landing/LandingFeatures';
import * as LandingFAQ from 'src/components/uiim/landing/LandingFAQ';
import * as NewsletterSignup from 'src/components/uiim/forms/NewsletterSignup';
import * as ValuePropositionGrid from 'src/components/uiim/content/ValuePropositionGrid';
import * as TrustStatsRow from 'src/components/uiim/content/TrustStatsRow';
import * as RichTextBlock from 'src/components/uiim/content/RichTextBlock';
import * as LegalComplianceBanner from 'src/components/uiim/content/LegalComplianceBanner';
import * as FeatureHighlight from 'src/components/uiim/content/FeatureHighlight';
import * as FAQAccordion from 'src/components/uiim/content/FAQAccordion';
import * as ProductPricingCards from 'src/components/uiim/cards/ProductPricingCards';
import * as FeatureCardsGrid from 'src/components/uiim/cards/FeatureCardsGrid';
import * as HeroBannerCarousel from 'src/components/uiim/banners/HeroBannerCarousel';
import * as HeroBanner from 'src/components/uiim/banners/HeroBanner';
import * as CTABanner from 'src/components/uiim/banners/CTABanner';
import * as ArticleHero from 'src/components/uiim/article/ArticleHero';
import * as ArticleBody from 'src/components/uiim/article/ArticleBody';
import * as input from 'src/components/ui/input';
import * as card from 'src/components/ui/card';
import * as button from 'src/components/ui/button';
import * as badge from 'src/components/ui/badge';
import * as SearchExperienceLoadMore from 'src/components/search-experience/SearchExperience.LoadMore';
import * as SearchExperience from 'src/components/search-experience/SearchExperience';
import * as useSearchField from 'src/components/search-experience/search-components/useSearchField';
import * as useRouter from 'src/components/search-experience/search-components/useRouter';
import * as useParams from 'src/components/search-experience/search-components/useParams';
import * as useEvent from 'src/components/search-experience/search-components/useEvent';
import * as useDebounce from 'src/components/search-experience/search-components/useDebounce';
import * as SearchSkeletonItem from 'src/components/search-experience/search-components/SearchSkeletonItem';
import * as SearchPagination from 'src/components/search-experience/search-components/SearchPagination';
import * as SearchItemCommon from 'src/components/search-experience/search-components/SearchItemCommon';
import * as SearchInput from 'src/components/search-experience/search-components/SearchInput';
import * as SearchError from 'src/components/search-experience/search-components/SearchError';
import * as SearchEmptyResults from 'src/components/search-experience/search-components/SearchEmptyResults';
import * as models from 'src/components/search-experience/search-components/models';
import * as constants from 'src/components/search-experience/search-components/constants';
import * as SearchItemTitle from 'src/components/search-experience/search-components/SearchItem/SearchItemTitle';
import * as SearchItemTags from 'src/components/search-experience/search-components/SearchItem/SearchItemTags';
import * as SearchItemSummary from 'src/components/search-experience/search-components/SearchItem/SearchItemSummary';
import * as SearchItemSubTitle from 'src/components/search-experience/search-components/SearchItem/SearchItemSubTitle';
import * as SearchItemLink from 'src/components/search-experience/search-components/SearchItem/SearchItemLink';
import * as SearchItemImage from 'src/components/search-experience/search-components/SearchItem/SearchItemImage';
import * as SearchItemCategory from 'src/components/search-experience/search-components/SearchItem/SearchItemCategory';
import * as index from 'src/components/search-experience/search-components/SearchItem/index';
import * as Title from 'src/components/basic/title/Title';
import * as RowSplitter from 'src/components/basic/row-splitter/RowSplitter';
import * as RichText from 'src/components/basic/rich-text/RichText';
import * as Promo from 'src/components/basic/promo/Promo';
import * as PartialDesignDynamicPlaceholder from 'src/components/basic/partial-design-dynamic-placeholder/PartialDesignDynamicPlaceholder';
import * as PageContent from 'src/components/basic/page-content/PageContent';
import * as Navigation from 'src/components/basic/navigation/Navigation';
import * as LinkList from 'src/components/basic/link-list/LinkList';
import * as Image from 'src/components/basic/image/Image';
import * as SitecoreStyles from 'src/components/basic/content-sdk/SitecoreStyles';
import * as CdpPageView from 'src/components/basic/content-sdk/CdpPageView';
import * as ContentBlock from 'src/components/basic/content-block/ContentBlock';
import * as Container from 'src/components/basic/container/Container';
import * as ColumnSplitter from 'src/components/basic/column-splitter/ColumnSplitter';

export const componentMap = new Map<string, NextjsContentSdkComponent>([
  ['BYOCWrapper', BYOCServerWrapper],
  ['FEaaSWrapper', FEaaSServerWrapper],
  ['Form', { ...Form, componentType: 'client' }],
  ['TestimonialBlock', { ...TestimonialBlock }],
  ['LogoCloud', { ...LogoCloud }],
  ['SearchExperienceV2', { ...SearchExperienceV2, componentType: 'client' }],
  ['TabNavigationSection', { ...TabNavigationSection, componentType: 'client' }],
  ['SiteFooter', { ...SiteFooter }],
  ['NavigationHeader', { ...NavigationHeader, componentType: 'client' }],
  ['AnnouncementBar', { ...AnnouncementBar }],
  ['SmartMedia', { ...SmartMedia, componentType: 'client' }],
  ['ImageGallery', { ...ImageGallery }],
  ['LandingStats', { ...LandingStats }],
  ['LandingSocialProof', { ...LandingSocialProof }],
  ['LandingHero', { ...LandingHero }],
  ['LandingFinalCTA', { ...LandingFinalCTA }],
  ['LandingFeatures', { ...LandingFeatures }],
  ['LandingFAQ', { ...LandingFAQ, componentType: 'client' }],
  ['NewsletterSignup', { ...NewsletterSignup, componentType: 'client' }],
  ['ValuePropositionGrid', { ...ValuePropositionGrid }],
  ['TrustStatsRow', { ...TrustStatsRow }],
  ['RichTextBlock', { ...RichTextBlock }],
  ['LegalComplianceBanner', { ...LegalComplianceBanner }],
  ['FeatureHighlight', { ...FeatureHighlight, componentType: 'client' }],
  ['FAQAccordion', { ...FAQAccordion }],
  ['ProductPricingCards', { ...ProductPricingCards }],
  ['FeatureCardsGrid', { ...FeatureCardsGrid, componentType: 'client' }],
  ['HeroBannerCarousel', { ...HeroBannerCarousel, componentType: 'client' }],
  ['HeroBanner', { ...HeroBanner, componentType: 'client' }],
  ['CTABanner', { ...CTABanner }],
  ['ArticleHero', { ...ArticleHero, componentType: 'client' }],
  ['ArticleBody', { ...ArticleBody }],
  ['input', { ...input }],
  ['card', { ...card }],
  ['button', { ...button }],
  ['badge', { ...badge }],
  ['SearchExperience', { ...SearchExperienceLoadMore, ...SearchExperience, componentType: 'client' }],
  ['useSearchField', { ...useSearchField, componentType: 'client' }],
  ['useRouter', { ...useRouter, componentType: 'client' }],
  ['useParams', { ...useParams, componentType: 'client' }],
  ['useEvent', { ...useEvent, componentType: 'client' }],
  ['useDebounce', { ...useDebounce, componentType: 'client' }],
  ['SearchSkeletonItem', { ...SearchSkeletonItem, componentType: 'client' }],
  ['SearchPagination', { ...SearchPagination, componentType: 'client' }],
  ['SearchItemCommon', { ...SearchItemCommon, componentType: 'client' }],
  ['SearchInput', { ...SearchInput, componentType: 'client' }],
  ['SearchError', { ...SearchError, componentType: 'client' }],
  ['SearchEmptyResults', { ...SearchEmptyResults, componentType: 'client' }],
  ['models', { ...models }],
  ['constants', { ...constants }],
  ['SearchItemTitle', { ...SearchItemTitle, componentType: 'client' }],
  ['SearchItemTags', { ...SearchItemTags, componentType: 'client' }],
  ['SearchItemSummary', { ...SearchItemSummary, componentType: 'client' }],
  ['SearchItemSubTitle', { ...SearchItemSubTitle, componentType: 'client' }],
  ['SearchItemLink', { ...SearchItemLink, componentType: 'client' }],
  ['SearchItemImage', { ...SearchItemImage, componentType: 'client' }],
  ['SearchItemCategory', { ...SearchItemCategory, componentType: 'client' }],
  ['index', { ...index, componentType: 'client' }],
  ['Title', { ...Title }],
  ['RowSplitter', { ...RowSplitter }],
  ['RichText', { ...RichText }],
  ['Promo', { ...Promo }],
  ['PartialDesignDynamicPlaceholder', { ...PartialDesignDynamicPlaceholder }],
  ['PageContent', { ...PageContent }],
  ['Navigation', { ...Navigation, componentType: 'client' }],
  ['LinkList', { ...LinkList }],
  ['Image', { ...Image }],
  ['SitecoreStyles', { ...SitecoreStyles, componentType: 'client' }],
  ['CdpPageView', { ...CdpPageView, componentType: 'client' }],
  ['ContentBlock', { ...ContentBlock, componentType: 'client' }],
  ['Container', { ...Container }],
  ['ColumnSplitter', { ...ColumnSplitter }],
]);

export default componentMap;
