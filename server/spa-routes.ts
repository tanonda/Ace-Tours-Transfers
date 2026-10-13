import type { Response } from "express";

/**
 * Paths the client router (client/src/App.tsx SITE_ROUTES) renders as real pages.
 * Anything else gets the app's not-found screen, so the server must answer it
 * with a 404 status — a 200 there is what Google reports as a "soft 404".
 * spa-routes.test.ts fails if this list drifts from App.tsx.
 */
const PAGE_PATHS = new Set([
  "/",
  "/tours",
  "/transfers",
  "/about",
  "/contact",
  "/cart",
  "/checkout",
  "/payment",
  "/payment/success",
  "/payment/cancel",
  "/manage-booking",
  "/review",
  "/confirmation",
  "/staff-access",
  "/register",
  "/privacy-policy",
  "/photo-credits",
  "/terms-of-service",
  "/faq",
  "/blog",
  "/reset-password",
  "/port-vila-airport-transfers",
  "/efate-island-day-tours",
  "/blue-lagoon-vanuatu-tour",
  "/mele-cascades-tour",
  "/vanuatu-cultural-tours",
  "/port-vila-private-transfers",
  "/admin/dashboard",
  "/admin/bookings",
  "/admin/products",
  "/admin/blog",
  "/admin/customers",
  "/admin/settings",
  "/admin/analytics",
  "/admin/reports",
  "/admin/promotions",
  "/admin/calendar",
  "/admin/recovery",
  "/admin/staff",
  "/admin/cms",
  "/admin/reconciliation",
  "/admin/payments",
  "/admin/pricing",
  "/admin/blackouts",
  "/admin/capacity",
  "/admin/audit-logs",
  "/admin/reviews",
  "/admin/fraud",
  "/admin/newsletter",
  "/admin/notifications",
  "/admin/profile",
  "/admin/external-services",
  "/field-service/dashboard",
  "/dashboard",
  "/customer/dashboard",
  "/dashboard/bookings",
  "/customer/bookings",
  "/dashboard/saved",
  "/dashboard/profile",
]);

/** /tours/:id, /transfers/:id, /blog/:slug — one segment. Whether the record exists is checked per request. */
const DETAIL_PAGE = /^\/(tours|transfers|blog)\/[^/]+$/;

export function isSpaRoute(reqPath: string): boolean {
  const p = reqPath.length > 1 ? reqPath.replace(/\/+$/, "") : reqPath;
  return PAGE_PATHS.has(p) || DETAIL_PAGE.test(p);
}

/**
 * Detail routes call this when the product/article they name doesn't exist, so the
 * static server answers 404 instead of a snapshot or the app shell.
 */
export function markPageNotFound(res: Response): void {
  res.locals.pageNotFound = true;
}

export function isPageNotFound(res: Response): boolean {
  return res.locals.pageNotFound === true;
}
