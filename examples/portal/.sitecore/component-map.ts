// Below are built-in components that are available in the app, it's recommended to keep them as is
import { NextjsContentSdkComponent } from '@sitecore-content-sdk/nextjs';


import { BYOCServerWrapper, FEaaSServerWrapper } from '@sitecore-content-sdk/nextjs';
import { Form } from '@sitecore-content-sdk/nextjs';

// end of built-in import section
import * as Title from 'src/components/sxa/title/Title';
import * as RowSplitter from 'src/components/sxa/row-splitter/RowSplitter';
import * as RichText from 'src/components/sxa/rich-text/RichText';
import * as Promo from 'src/components/sxa/promo/Promo';
import * as PageContent from 'src/components/sxa/page-content/PageContent';
import * as Navigation from 'src/components/sxa/navigation/Navigation';
import * as LinkList from 'src/components/sxa/link-list/LinkList';
import * as Image from 'src/components/sxa/image/Image';
import * as Container from 'src/components/sxa/container/Container';
import * as ColumnSplitter from 'src/components/sxa/column-splitter/ColumnSplitter';
import * as PartialDesignDynamicPlaceholder from 'src/components/partial-design-dynamic-placeholder/PartialDesignDynamicPlaceholder';
import * as ThemeNights from 'src/components/Portal/ThemeNights';
import * as TestDriveCta from 'src/components/Portal/TestDriveCta';
import * as SectionCards from 'src/components/Portal/SectionCards';
import * as Roster from 'src/components/Portal/Roster';
import * as ProgramFinder from 'src/components/Portal/ProgramFinder';
import * as ProgramDetail from 'src/components/Portal/ProgramDetail';
import * as ProductDetail from 'src/components/Portal/ProductDetail';
import * as ProductCatalog from 'src/components/Portal/ProductCatalog';
import * as PressRelease from 'src/components/Portal/PressRelease';
import * as PressList from 'src/components/Portal/PressList';
import * as PortalHero from 'src/components/Portal/PortalHero';
import * as PortalHeader from 'src/components/Portal/PortalHeader';
import * as PortalFooter from 'src/components/Portal/PortalFooter';
import * as PortalBanner from 'src/components/Portal/PortalBanner';
import * as PlayerDetail from 'src/components/Portal/PlayerDetail';
import * as PartnerWall from 'src/components/Portal/PartnerWall';
import * as PartnerHub from 'src/components/Portal/PartnerHub';
import * as PartnerDetail from 'src/components/Portal/PartnerDetail';
import * as ModelHighlights from 'src/components/Portal/ModelHighlights';
import * as MicrositeHero from 'src/components/Portal/MicrositeHero';
import * as MicrositeGallery from 'src/components/Portal/MicrositeGallery';
import * as MicrositeCountdown from 'src/components/Portal/MicrositeCountdown';
import * as MediaLibrary from 'src/components/Portal/MediaLibrary';
import * as MediaHubTile from 'src/components/Portal/MediaHubTile';
import * as GameSchedule from 'src/components/Portal/GameSchedule';
import * as GameDetail from 'src/components/Portal/GameDetail';
import * as GameCenter from 'src/components/Portal/GameCenter';
import * as ExpertFinder from 'src/components/Portal/ExpertFinder';
import * as EventsCalendar from 'src/components/Portal/EventsCalendar';
import * as DealerLocator from 'src/components/Portal/DealerLocator';
import * as ContentHubList from 'src/components/Portal/ContentHubList';
import * as ContentHubItems from 'src/components/Portal/ContentHubItems';
import * as ContentHubDetail from 'src/components/Portal/ContentHubDetail';
import * as ByTheNumbers from 'src/components/Portal/ByTheNumbers';
import * as BrandGrid from 'src/components/Portal/BrandGrid';
import * as BrandBook from 'src/components/Portal/BrandBook';

export const componentMap = new Map<string, NextjsContentSdkComponent>([
  ['BYOCWrapper', BYOCServerWrapper],
  ['FEaaSWrapper', FEaaSServerWrapper],
  ['Form', { ...Form, componentType: 'client' }],
  ['Title', { ...Title }],
  ['RowSplitter', { ...RowSplitter }],
  ['RichText', { ...RichText }],
  ['Promo', { ...Promo }],
  ['PageContent', { ...PageContent }],
  ['Navigation', { ...Navigation, componentType: 'client' }],
  ['LinkList', { ...LinkList }],
  ['Image', { ...Image }],
  ['Container', { ...Container }],
  ['ColumnSplitter', { ...ColumnSplitter }],
  ['PartialDesignDynamicPlaceholder', { ...PartialDesignDynamicPlaceholder }],
  ['ThemeNights', { ...ThemeNights }],
  ['TestDriveCta', { ...TestDriveCta }],
  ['SectionCards', { ...SectionCards }],
  ['Roster', { ...Roster }],
  ['ProgramFinder', { ...ProgramFinder }],
  ['ProgramDetail', { ...ProgramDetail }],
  ['ProductDetail', { ...ProductDetail }],
  ['ProductCatalog', { ...ProductCatalog }],
  ['PressRelease', { ...PressRelease }],
  ['PressList', { ...PressList }],
  ['PortalHero', { ...PortalHero }],
  ['PortalHeader', { ...PortalHeader }],
  ['PortalFooter', { ...PortalFooter }],
  ['PortalBanner', { ...PortalBanner }],
  ['PlayerDetail', { ...PlayerDetail }],
  ['PartnerWall', { ...PartnerWall }],
  ['PartnerHub', { ...PartnerHub }],
  ['PartnerDetail', { ...PartnerDetail }],
  ['ModelHighlights', { ...ModelHighlights }],
  ['MicrositeHero', { ...MicrositeHero }],
  ['MicrositeGallery', { ...MicrositeGallery }],
  ['MicrositeCountdown', { ...MicrositeCountdown }],
  ['MediaLibrary', { ...MediaLibrary }],
  ['MediaHubTile', { ...MediaHubTile }],
  ['GameSchedule', { ...GameSchedule }],
  ['GameDetail', { ...GameDetail }],
  ['GameCenter', { ...GameCenter }],
  ['ExpertFinder', { ...ExpertFinder }],
  ['EventsCalendar', { ...EventsCalendar }],
  ['DealerLocator', { ...DealerLocator }],
  ['ContentHubList', { ...ContentHubList }],
  ['ContentHubItems', { ...ContentHubItems }],
  ['ContentHubDetail', { ...ContentHubDetail }],
  ['ByTheNumbers', { ...ByTheNumbers }],
  ['BrandGrid', { ...BrandGrid }],
  ['BrandBook', { ...BrandBook }],
]);

export default componentMap;
