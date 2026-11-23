import { Text } from '@sitecore-content-sdk/nextjs';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps, getDatasource, getFieldValue } from 'lib/component-props';
import DealerLocatorChrome, { type DealerRecord } from './dom-security-dealer-locator.client';
import { BELGIUM_DEALERS } from './dealers.data.util';

type GqlText = TextField | { jsonValue?: TextField } | null | undefined;

type DealerChild = {
  id?: string;
  name?: string;
  title?: GqlText;
  label?: GqlText;
  address?: GqlText;
  address2?: GqlText;
  phone?: GqlText;
  fax?: GqlText;
  email?: GqlText;
  website?: GqlText;
  latitude?: GqlText;
  longitude?: GqlText;
  types?: GqlText;
  externalId?: GqlText;
};

type DealerLocatorDatasource = {
  heading?: GqlText;
  subtitle?: GqlText;
  searchPlaceholder?: GqlText;
  useMyLocationLabel?: GqlText;
  locationError?: GqlText;
  noResultsMessage?: GqlText;
  searchCriteriaLabel?: GqlText;
  selectDealersLabel?: GqlText;
  mechanicalLabel?: GqlText;
  digitalLabel?: GqlText;
  mapCookieTitle?: GqlText;
  mapCookieBody?: GqlText;
  children?: { results?: DealerChild[] };
  Heading?: TextField;
  Subtitle?: TextField;
  'Search Placeholder'?: TextField;
  'Use My Location Label'?: TextField;
  'Location Error'?: TextField;
  'No Results Message'?: TextField;
  'Search Criteria Label'?: TextField;
  'Select Dealers Label'?: TextField;
  'Mechanical Type Label'?: TextField;
  'Digital Type Label'?: TextField;
  'Map Cookie Title'?: TextField;
  'Map Cookie Body'?: TextField;
};

type DealerLocatorProps = ComponentProps & {
  fields?: DealerLocatorDatasource | { data?: { datasource?: DealerLocatorDatasource } };
};

function textValue(field: GqlText | TextField | undefined): string {
  const unwrapped = getFieldValue(field as GqlText);
  if (unwrapped == null) return '';
  if (typeof unwrapped === 'string' || typeof unwrapped === 'number') {
    return String(unwrapped);
  }
  const value = (unwrapped as TextField)?.value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

function toDealer(child: DealerChild, index: number): DealerRecord | null {
  const lat = Number.parseFloat(textValue(child.latitude));
  const lng = Number.parseFloat(textValue(child.longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const typesRaw = textValue(child.types);
  return {
    id: textValue(child.externalId) || child.id || child.name || `dealer-${index}`,
    title: textValue(child.title) || child.name || 'Dealer',
    label: textValue(child.label),
    address: textValue(child.address),
    address2: textValue(child.address2),
    phone: textValue(child.phone),
    fax: textValue(child.fax),
    email: textValue(child.email).trim(),
    website: textValue(child.website).trim(),
    latitude: lat,
    longitude: lng,
    types: typesRaw
      .split(/[;|]/)
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

function resolveDealers(datasource: DealerLocatorDatasource | undefined): DealerRecord[] {
  // Prefer GraphQL children when present (small sets). Large locator lists exceed
  // Experience Edge ComponentQuery complexity — fall back to bundled seed data.
  const fromGraphql = (datasource?.children?.results ?? [])
    .map((child, index) => toDealer(child, index))
    .filter((d): d is DealerRecord => Boolean(d));
  if (fromGraphql.length > 0) return fromGraphql;
  return BELGIUM_DEALERS;
}

export const Default = (props: DealerLocatorProps) => {
  const datasource = getDatasource<DealerLocatorDatasource>(props.fields);
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  const dealers = resolveDealers(datasource);

  const heading =
    getFieldValue(datasource?.heading) || getFieldValue(datasource?.Heading);
  const subtitle =
    getFieldValue(datasource?.subtitle) || getFieldValue(datasource?.Subtitle);

  const label = (gqlKey: keyof DealerLocatorDatasource, flatKey: keyof DealerLocatorDatasource, fallback: string) =>
    textValue(datasource?.[gqlKey] as GqlText) ||
    textValue(datasource?.[flatKey] as GqlText) ||
    fallback;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-white px-[15px] py-8 font-[Source_Sans_Pro] text-black lg:py-16"
    >
      <div className="mx-auto w-full max-w-[1170px]">
        <div className="mb-6 lg:mb-10">
          {heading ? (
            <Text
              field={heading}
              tag="h1"
              className="m-0 text-[2.4rem] font-light leading-[1.1] text-[#333] lg:text-[63px] lg:leading-[69px]"
            />
          ) : null}
          {subtitle ? (
            <Text
              field={subtitle}
              tag="h2"
              className="mt-5 mb-0 text-[1.25rem] font-light leading-normal text-black lg:text-[30px]"
            />
          ) : null}
        </div>

        <DealerLocatorChrome
          dealers={dealers}
          searchPlaceholder={label('searchPlaceholder', 'Search Placeholder', 'Find code')}
          useMyLocationLabel={label('useMyLocationLabel', 'Use My Location Label', 'Use my location')}
          locationError={label('locationError', 'Location Error', 'Something went wrong')}
          noResultsMessage={label('noResultsMessage', 'No Results Message', 'No Dealers Found')}
          searchCriteriaLabel={label('searchCriteriaLabel', 'Search Criteria Label', 'Search criteria')}
          selectDealersLabel={label('selectDealersLabel', 'Select Dealers Label', 'Select Dealers')}
          mechanicalLabel={label(
            'mechanicalLabel',
            'Mechanical Type Label',
            'Mechanical locking systems',
          )}
          digitalLabel={label('digitalLabel', 'Digital Type Label', 'Digital locking systems')}
          mapCookieTitle={label('mapCookieTitle', 'Map Cookie Title', 'Cookies are disabled')}
          mapCookieBody={label(
            'mapCookieBody',
            'Map Cookie Body',
            'In order to use the map you need to accept the cookies.',
          )}
        />
      </div>
    </section>
  );
};
