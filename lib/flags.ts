/**
 * Build-time feature flags (NEXT_PUBLIC_* values are compiled into the bundle).
 *
 * PAYMENTS_LIVE: set NEXT_PUBLIC_PAYMENTS_LIVE=true only once Stripe checkout is
 * actually integrated. Until then the paywall says payments open soon, collects
 * no card details, and free-plan profile limits are not enforced.
 */
export const PAYMENTS_LIVE = process.env.NEXT_PUBLIC_PAYMENTS_LIVE === "true";
