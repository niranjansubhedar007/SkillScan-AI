// app/icon.jsx
import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#3B82F6',
          borderRadius: '8px',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Robot Head */}
          <rect width="24" height="24" rx="6" fill="#3B82F6" />
          
          {/* Eyes */}
          <circle cx="8" cy="10" r="2" fill="white" />
          <circle cx="16" cy="10" r="2" fill="white" />
          <circle cx="8" cy="10" r="1" fill="#1E293B" />
          <circle cx="16" cy="10" r="1" fill="#1E293B" />
          
          {/* Mouth */}
          <rect x="9" y="14" width="6" height="1.5" rx="0.75" fill="white" />
          
          {/* Antenna */}
          <rect x="11" y="4" width="2" height="3" fill="#E2E8F0" />
          <circle cx="12" cy="3" r="1.5" fill="#F97316" />
        </svg>
      </div>
    ),
    { ...size }
  )
}