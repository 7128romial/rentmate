// Google Maps embed URLs. The unauthenticated /maps?...&output=embed endpoint
// is free and requires no API key. Coordinates take precedence over address.

export function mapEmbedUrl(property, { zoom = 15 } = {}) {
  if (!property) return '';
  const hasCoords = Number.isFinite(property.lat) && Number.isFinite(property.lng);
  const q = hasCoords
    ? `${property.lat},${property.lng}`
    : property.address || property.title || '';
  if (!q) return '';
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&output=embed&hl=he`;
}

export function mapLinkUrl(property) {
  if (!property) return '';
  const hasCoords = Number.isFinite(property.lat) && Number.isFinite(property.lng);
  const q = hasCoords
    ? `${property.lat},${property.lng}`
    : property.address || property.title || '';
  if (!q) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function renderMap(host, property, options = {}) {
  if (!host) return;
  host.innerHTML = '';
  const url = mapEmbedUrl(property, options);
  if (!url) return;

  const wrap = document.createElement('div');
  wrap.className = 'map-embed';

  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  iframe.setAttribute('allowfullscreen', '');
  iframe.title = property.address || 'מיקום הדירה';
  wrap.appendChild(iframe);

  if (property.address) {
    const link = document.createElement('a');
    link.className = 'map-address';
    link.href = mapLinkUrl(property);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `📍 ${property.address}`;
    wrap.appendChild(link);
  }

  host.appendChild(wrap);
}
