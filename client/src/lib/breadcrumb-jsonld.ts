export interface Breadcrumb {
  name: string;
  /** Site-relative path, e.g. "/tours". */
  path: string;
}

/** schema.org BreadcrumbList for a page's trail. Google wants at least two crumbs. */
export function buildBreadcrumbJsonLd(crumbs: Breadcrumb[], siteUrl: string) {
  if (crumbs.length < 2) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: `${siteUrl}${crumb.path}`,
    })),
  };
}
