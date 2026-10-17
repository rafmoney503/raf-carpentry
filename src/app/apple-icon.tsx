import { ImageResponse } from 'next/og';

/* The icon a phone puts on its home screen when the site is saved there: the steps mark, paper planks on ink with
   the yellow ball on top. The phone rounds the corners itself. */

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#15171a' }}>
        <svg width="128" height="128" viewBox="0 0 100 100">
          <rect x="10" y="72" width="80" height="14" rx="3" fill="#f5f6f3" />
          <rect x="34" y="54" width="56" height="14" rx="3" fill="#f5f6f3" />
          <rect x="58" y="36" width="32" height="14" rx="3" fill="#f5f6f3" />
          <circle cx="74" cy="20" r="13" fill="#ffe45c" stroke="#15171a" strokeWidth="3" />
        </svg>
      </div>
    ),
    size,
  );
}
