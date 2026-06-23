import { useEffect } from 'react';

export const SITE = {
  name: 'Wiblaster',
  legalName: 'Wiblaster',
  url: 'https://wiblaster.com',
  locale: 'en_US',
  twitter: '@wiblaster',
  email: 'support@wiblaster.com',
  favicon: '/favicon.png',
  logo: '/logo-blue-bg.png',
  ogImage: '/logo-blue-bg.png',
  defaultTitle: 'Wiblaster | Ecommerce Store Finder & Email Outreach Tool',
  defaultDescription:
    'Discover and scan Shopify and WooCommerce stores, extract verified business emails, and run automated outreach campaigns from a single dashboard.',
  defaultKeywords:
    'ecommerce email finder, shopify store emails, store lead generation, cold email outreach, email scanner, verified store leads, dropshipping outreach, B2B ecommerce leads, outreach automation',
};

export const PAGE_SEO = {
  home: {
    title: SITE.defaultTitle,
    description: SITE.defaultDescription,
    path: '/',
  },
  pricing: {
    title: 'Pricing | Wiblaster – Store Email Scanner & Outreach Plans',
    description:
      'Compare Wiblaster plans for store email scanning, verified ecommerce leads, and automated outreach. Start with a $1 seven-day trial.',
    path: '/pricing',
  },
  login: {
    title: 'Sign In | Wiblaster',
    description: 'Sign in to Wiblaster to scan store emails, manage campaigns, and track outreach performance.',
    path: '/login',
    robots: 'noindex, follow',
  },
  signup: {
    title: 'Create Account | Wiblaster – Start Your $1 Trial',
    description:
      'Create your Wiblaster account and start finding ecommerce store emails, building lead lists, and sending outreach in minutes.',
    path: '/signup',
  },
  privacy: {
    title: 'Privacy Policy | Wiblaster',
    description: 'How Wiblaster collects, uses, and protects your data when you use our store scanner and outreach platform.',
    path: '/privacy',
  },
  terms: {
    title: 'Terms of Service | Wiblaster',
    description: 'Terms and conditions for using Wiblaster store email scanning, lead discovery, and outreach tools.',
    path: '/terms',
  },
};

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function applyPageSeo({
  title = SITE.defaultTitle,
  description = SITE.defaultDescription,
  path = '/',
  robots = 'index, follow',
  ogType = 'website',
  image = SITE.ogImage,
} = {}) {
  const canonical = `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`;

  document.title = title;
  upsertMeta('name', 'description', description);
  upsertMeta('name', 'robots', robots);
  upsertLink('canonical', canonical);

  upsertMeta('property', 'og:type', ogType);
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:image', `${SITE.url}${image}`);
  upsertMeta('property', 'og:site_name', SITE.name);

  upsertMeta('name', 'twitter:card', 'summary');
  upsertMeta('name', 'twitter:url', canonical);
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
  upsertMeta('name', 'twitter:image', `${SITE.url}${image}`);
}

export function usePageSeo(pageKey) {
  const config = PAGE_SEO[pageKey] || PAGE_SEO.home;

  useEffect(() => {
    applyPageSeo(config);
  }, [pageKey]);
}

export function getOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}${SITE.logo}`,
    image: `${SITE.url}${SITE.ogImage}`,
    description: SITE.defaultDescription,
  };
}

export function getSoftwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE.url,
    description: SITE.defaultDescription,
    offers: {
      '@type': 'Offer',
      price: '1.00',
      priceCurrency: 'USD',
      description: 'Three-day trial',
    },
    featureList: [
      'Ecommerce store email scanner',
      'Verified Shopify and WooCommerce store leads',
      'Automated cold email campaigns',
      'Multiple sender accounts and templates',
      'Store lead filters by country, platform, and tags',
    ],
  };
}

export function getWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.url,
    description: SITE.defaultDescription,
    publisher: {
      '@type': 'Organization',
      name: SITE.name,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE.url}${SITE.logo}`,
      },
    },
  };
}
