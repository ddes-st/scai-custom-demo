/**
 * DOM Security entry points for the unified data layer.
 * Profile attribute names and event types live in src/lib/tracking/profile-schema.ts.
 */
export {
  clearLoginIdentityGuard,
  ensureLoginIdentityFromSession,
  pushAudienceToProfile,
  pushDealerCallbackRequest,
  pushDealerPostalToProfile,
  pushLoginOpen,
  pushLoginToProfile,
  pushLogoutToProfile,
  pushPrimaryLocation,
  pushProductSearch,
  pushServiceRequest,
  seedCustomerProfile,
  trackDealerClick,
  trackDealerDetailView,
  trackProductClick,
  trackProductDetailView,
} from 'lib/tracking/unified-data-layer';
