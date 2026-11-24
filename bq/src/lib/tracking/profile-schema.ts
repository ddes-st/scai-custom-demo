/**
 * External attributes to add on the SitecoreAI customer profile schema, then publish.
 * Identity `extensionData` uses these keys. Values are strings or numbers because
 * the IDENTITY payload flattens extension data.
 *
 * | Key                    | Type   | Default    | Meaning                                      |
 * | primaryAudience        | string | customer   | customer or professional                     |
 * | primaryPostalCode      | string |            | Postal code from dealer / location search    |
 * | productAffinityScores  | string | {}         | JSON map of product id → { name, score }     |
 * | dealerAffinityScores   | string | {}         | JSON map of dealer id → { name, score }      |
 * | topProductId           | string |            | Highest product affinity id                  |
 * | topProductScore        | number |            | Highest product affinity score               |
 * | topDealerId            | string |            | Highest dealer affinity id                   |
 * | topDealerScore         | number |            | Highest dealer affinity score                |
 *
 * Scores increase by 1 on an item click and by 3 on a detail view, capped at 100.
 */
export const PROFILE_ATTRIBUTES = {
  primaryAudience: 'primaryAudience',
  primaryPostalCode: 'primaryPostalCode',
  productAffinityScores: 'productAffinityScores',
  dealerAffinityScores: 'dealerAffinityScores',
  topProductId: 'topProductId',
  topProductScore: 'topProductScore',
  topDealerId: 'topDealerId',
  topDealerScore: 'topDealerScore',
} as const;

export type PrimaryAudience = 'customer' | 'professional';

export const DEFAULT_PRIMARY_AUDIENCE: PrimaryAudience = 'customer';

/** Uppercase custom event types. Edge rejects lowercase event types. */
export const UDL_EVENTS = {
  loginOpen: 'DOMSECURITY:LOGIN_OPEN',
  login: 'DOMSECURITY:LOGIN',
  logout: 'DOMSECURITY:LOGOUT',
  audience: 'DOMSECURITY:AUDIENCE_SWITCH',
  primaryLocation: 'DOMSECURITY:PRIMARY_LOCATION',
  productSearch: 'DOMSECURITY:PRODUCT_SEARCH',
  productClick: 'DOMSECURITY:PRODUCT_CLICK',
  productDetail: 'DOMSECURITY:PRODUCT_DETAIL_VIEW',
  dealerClick: 'DOMSECURITY:DEALER_CLICK',
  dealerDetail: 'DOMSECURITY:DEALER_DETAIL_VIEW',
  dealerCallback: 'DOMSECURITY:DEALER_CALLBACK_REQUEST',
  serviceRequest: 'DOMSECURITY:SERVICE_REQUEST',
} as const;
