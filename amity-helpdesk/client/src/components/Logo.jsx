import { useState } from 'react';

// Official logo: file ko  client/public/amity-logo.png  naam se rakh do, wahi dikhega.
// File na mile to neeche wala shield (fallback) dikhega.
export default function Logo({ size = 56 }) {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <img
        src="/amity-logo.png"
        alt="Amity University logo"
        height={size}
        style={{ height: size, width: 'auto', display: 'block' }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <svg width={size * 0.85} height={size} viewBox="0 0 64 76" role="img" aria-label="Amity University">
      <path d="M32 3 6 12v26c0 17 11 29 26 35 15-6 26-18 26-35V12L32 3Z" fill="#1d3f78" />
      <path d="M32 3v70c15-6 26-18 26-35V12L32 3Z" fill="#c9a227" />
      <path d="M32 3 6 12v26c0 17 11 29 26 35 15-6 26-18 26-35V12L32 3Z" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path
        d="M33 20c7 8 10 13 10 20a11 11 0 0 1-22 0c0-5 3-8 6-12 0 4 2 6 4 6-2-5-1-10 2-14Z"
        fill="#fbf6e6"
      />
    </svg>
  );
}
