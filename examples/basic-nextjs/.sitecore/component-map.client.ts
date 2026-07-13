// Client-safe component map for App Router

import { BYOCClientWrapper, NextjsContentSdkComponent, FEaaSClientWrapper } from '@sitecore-content-sdk/nextjs';
import { Form } from '@sitecore-content-sdk/nextjs';

import * as SearchExperienceV2 from 'src/components/uiim/search/SearchExperienceV2';
import * as TabNavigationSection from 'src/components/uiim/navigation/TabNavigationSection';
import * as NavigationHeader from 'src/components/uiim/navigation/NavigationHeader';
import * as SmartMedia from 'src/components/uiim/media/SmartMedia';
import * as LandingFAQ from 'src/components/uiim/landing/LandingFAQ';
import * as NewsletterSignup from 'src/components/uiim/forms/NewsletterSignup';
import * as FeatureCardsGrid from 'src/components/uiim/cards/FeatureCardsGrid';
import * as HeroBannerCarousel from 'src/components/uiim/banners/HeroBannerCarousel';
import * as HeroBanner from 'src/components/uiim/banners/HeroBanner';
import * as ArticleHero from 'src/components/uiim/article/ArticleHero';
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
import * as SearchItemTitle from 'src/components/search-experience/search-components/SearchItem/SearchItemTitle';
import * as SearchItemTags from 'src/components/search-experience/search-components/SearchItem/SearchItemTags';
import * as SearchItemSummary from 'src/components/search-experience/search-components/SearchItem/SearchItemSummary';
import * as SearchItemSubTitle from 'src/components/search-experience/search-components/SearchItem/SearchItemSubTitle';
import * as SearchItemLink from 'src/components/search-experience/search-components/SearchItem/SearchItemLink';
import * as SearchItemImage from 'src/components/search-experience/search-components/SearchItem/SearchItemImage';
import * as SearchItemCategory from 'src/components/search-experience/search-components/SearchItem/SearchItemCategory';
import * as index from 'src/components/search-experience/search-components/SearchItem/index';
import * as Navigation from 'src/components/basic/navigation/Navigation';
import * as SitecoreStyles from 'src/components/basic/content-sdk/SitecoreStyles';
import * as CdpPageView from 'src/components/basic/content-sdk/CdpPageView';
import * as ContentBlock from 'src/components/basic/content-block/ContentBlock';

export const componentMap = new Map<string, NextjsContentSdkComponent>([
  ['BYOCWrapper', BYOCClientWrapper],
  ['FEaaSWrapper', FEaaSClientWrapper],
  ['Form', Form],
  ['SearchExperienceV2', { ...SearchExperienceV2 }],
  ['TabNavigationSection', { ...TabNavigationSection }],
  ['NavigationHeader', { ...NavigationHeader }],
  ['SmartMedia', { ...SmartMedia }],
  ['LandingFAQ', { ...LandingFAQ }],
  ['NewsletterSignup', { ...NewsletterSignup }],
  ['FeatureCardsGrid', { ...FeatureCardsGrid }],
  ['HeroBannerCarousel', { ...HeroBannerCarousel }],
  ['HeroBanner', { ...HeroBanner }],
  ['ArticleHero', { ...ArticleHero }],
  ['SearchExperience', { ...SearchExperienceLoadMore, ...SearchExperience }],
  ['useSearchField', { ...useSearchField }],
  ['useRouter', { ...useRouter }],
  ['useParams', { ...useParams }],
  ['useEvent', { ...useEvent }],
  ['useDebounce', { ...useDebounce }],
  ['SearchSkeletonItem', { ...SearchSkeletonItem }],
  ['SearchPagination', { ...SearchPagination }],
  ['SearchItemCommon', { ...SearchItemCommon }],
  ['SearchInput', { ...SearchInput }],
  ['SearchError', { ...SearchError }],
  ['SearchEmptyResults', { ...SearchEmptyResults }],
  ['SearchItemTitle', { ...SearchItemTitle }],
  ['SearchItemTags', { ...SearchItemTags }],
  ['SearchItemSummary', { ...SearchItemSummary }],
  ['SearchItemSubTitle', { ...SearchItemSubTitle }],
  ['SearchItemLink', { ...SearchItemLink }],
  ['SearchItemImage', { ...SearchItemImage }],
  ['SearchItemCategory', { ...SearchItemCategory }],
  ['index', { ...index }],
  ['Navigation', { ...Navigation }],
  ['SitecoreStyles', { ...SitecoreStyles }],
  ['CdpPageView', { ...CdpPageView }],
  ['ContentBlock', { ...ContentBlock }],
]);

export default componentMap;
