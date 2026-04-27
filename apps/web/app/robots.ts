import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/preview-gallery', '/preview-gallery/*', '/review', '/review/*'],
      },
    ],
  };
}
