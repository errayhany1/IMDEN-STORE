import { useEffect } from 'react';

const SITE_URL = 'https://errayhany.com';

function setMetaTag(attr, key, content) {
  if (!content) return;
  let element = document.querySelector(`meta[${attr}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(url) {
  if (!url) return;
  let element = document.querySelector(`link[rel="canonical"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', url);
}

function setJsonLd(id, data) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement('script');
    element.setAttribute('type', 'application/ld+json');
    element.setAttribute('id', id);
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);
}

export function useSEO({
  title,
  description,
  canonicalPath,
  ogImage,
  ogType = 'website',
  jsonLd,
}) {
  useEffect(() => {
    if (title) {
      document.title = title;
      setMetaTag('property', 'og:title', title);
      setMetaTag('name', 'twitter:title', title);
    }

    if (description) {
      setMetaTag('name', 'description', description);
      setMetaTag('property', 'og:description', description);
      setMetaTag('name', 'twitter:description', description);
    }

    if (canonicalPath) {
      const fullUrl = `${SITE_URL}${canonicalPath}`;
      setCanonical(fullUrl);
      setMetaTag('property', 'og:url', fullUrl);
    }

    if (ogImage) {
      const imageUrl = ogImage.startsWith('http') ? ogImage : `${SITE_URL}${ogImage}`;
      setMetaTag('property', 'og:image', imageUrl);
      setMetaTag('property', 'og:image:secure_url', imageUrl);
      setMetaTag('name', 'twitter:image', imageUrl);
      setMetaTag('name', 'twitter:card', 'summary_large_image');
    }

    if (ogType) {
      setMetaTag('property', 'og:type', ogType);
    }

    if (jsonLd) {
      const schemas = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      schemas.forEach((schema, index) => {
        setJsonLd(`dynamic-jsonld-${index}`, schema);
      });
    }

    return () => {
      document.querySelectorAll('script[id^="dynamic-jsonld-"]').forEach(el => el.remove());
    };
  }, [title, description, canonicalPath, ogImage, ogType, jsonLd]);
}
