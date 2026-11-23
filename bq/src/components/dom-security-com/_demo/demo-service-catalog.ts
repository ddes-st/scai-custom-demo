/**
 * Hardcoded service-request catalog inspired by dom-security.com/be/en product taxonomy.
 */

export type DemoProductFamily =
  | 'mechanical-cylinder'
  | 'mechanical-lock'
  | 'digital-cylinder'
  | 'digital-handle'
  | 'media'
  | 'furniture-lock';

export type DemoProduct = {
  id: string;
  name: string;
  family: DemoProductFamily;
  group: string;
};

export type DemoRequestOption = {
  id: string;
  label: string;
};

const REQUESTS_BY_FAMILY: Record<DemoProductFamily, DemoRequestOption[]> = {
  'mechanical-cylinder': [
    { id: 'recreate-key', label: 'Recreate / order a spare key' },
    { id: 'extend-master-key', label: 'Extend master-key system' },
    { id: 'compatible-cylinder', label: 'Order compatible cylinder' },
    { id: 'skg-upgrade', label: 'Request SKG-rated upgrade' },
  ],
  'mechanical-lock': [
    { id: 'spare-lock-case', label: 'Order spare lock case' },
    { id: 'cylinder-pairing', label: 'Request compatible cylinder pairing' },
    { id: 'install-advice', label: 'Installation advice via dealer' },
  ],
  'digital-cylinder': [
    { id: 'spare-digital-cylinder', label: 'Order spare digital cylinder' },
    { id: 'programming-media', label: 'Order programming / media card' },
    { id: 'compatible-reader', label: 'Request compatible wall reader' },
    { id: 'battery-support', label: 'Battery / maintenance support' },
  ],
  'digital-handle': [
    { id: 'spare-handle', label: 'Order spare handle' },
    { id: 'eniq-media', label: 'Order ENiQ media' },
    { id: 'app-support', label: 'App / programming support' },
    { id: 'egress-advice', label: 'Compatible panic/egress advice' },
  ],
  media: [
    { id: 'spare-media', label: 'Order spare media (tag/card)' },
    { id: 'tapkey-support', label: 'Tapkey Premium / app support' },
    { id: 'add-door-tapkey', label: 'Add door to existing Tapkey system' },
  ],
  'furniture-lock': [
    { id: 'spare-furniture-lock', label: 'Order spare lock' },
    { id: 'compatible-key-media', label: 'Request compatible key/media' },
    { id: 'furniture-install', label: 'Installation advice' },
  ],
};

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: 'ix-twinstar',
    name: 'DOM ix Twinstar',
    family: 'mechanical-cylinder',
    group: 'Door Hardware — Mechanical cylinders',
  },
  {
    id: 'ix-teco',
    name: 'DOM ix Teco',
    family: 'mechanical-cylinder',
    group: 'Door Hardware — Mechanical cylinders',
  },
  {
    id: 'mortise-lock',
    name: 'DOM Mortise Lock',
    family: 'mechanical-lock',
    group: 'Door Hardware — Mechanical locks',
  },
  {
    id: 'multipoint-lock',
    name: 'DOM Multipoint Lock',
    family: 'mechanical-lock',
    group: 'Door Hardware — Mechanical locks',
  },
  {
    id: 'els-pro',
    name: 'DOM ELS Pro',
    family: 'digital-cylinder',
    group: 'Access Control — Digital cylinders',
  },
  {
    id: 'eniq-guard',
    name: 'DOM ENiQ Guard',
    family: 'digital-handle',
    group: 'Access Control — Digital handles',
  },
  {
    id: 'eniq-touchbar',
    name: 'DOM ENiQ TouchBar',
    family: 'digital-handle',
    group: 'Access Control — Digital handles',
  },
  {
    id: 'tapkey',
    name: 'DOM Tapkey',
    family: 'media',
    group: 'Access Control — Media / apps',
  },
  {
    id: 'eniq-els-media',
    name: 'ENiQ / ELS transponder media',
    family: 'media',
    group: 'Access Control — Media / apps',
  },
  {
    id: 'furniture-lock',
    name: 'DOM furniture lock',
    family: 'furniture-lock',
    group: 'Industrial — Furniture locks',
  },
];

export const DEFAULT_PRODUCT_ID = 'ix-twinstar';
export const DEFAULT_REQUEST_ID = 'recreate-key';

export const PREFERRED_TIME_OPTIONS = [
  { id: 'anytime', label: 'Anytime' },
  { id: '08-11', label: 'Between 8am and 11am' },
  { id: '11-13', label: 'Between 11am and 1pm' },
  { id: '13-16', label: 'Between 1pm and 4pm' },
] as const;

export function getProductById(id: string): DemoProduct | undefined {
  return DEMO_PRODUCTS.find((p) => p.id === id);
}

export function getRequestsForProduct(productId: string): DemoRequestOption[] {
  const product = getProductById(productId);
  if (!product) return [];
  return REQUESTS_BY_FAMILY[product.family] || [];
}
