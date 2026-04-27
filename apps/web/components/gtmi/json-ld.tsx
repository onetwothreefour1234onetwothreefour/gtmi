import * as React from 'react';

export interface JsonLdProps {
  data: Record<string, unknown>;
}

/**
 * Inline <script type="application/ld+json"> for structured data.
 *
 * Phase 4.5 emits schema.org `Dataset` records on /programs/[id] and
 * /countries/[iso]. The data prop is JSON-stringified and rendered into a
 * server-component script tag — never reaches the client bundle as JS.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
