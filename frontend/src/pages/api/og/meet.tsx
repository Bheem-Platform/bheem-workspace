import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get('title') || 'Video Meeting';
    const code = searchParams.get('code') || '';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1F2937 0%, #111827 50%, #0F172A 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Logo and Brand */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '40px',
            }}
          >
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '20px',
                boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <span
              style={{
                fontSize: '48px',
                fontWeight: 700,
                color: 'white',
                letterSpacing: '-1px',
              }}
            >
              Bheem Meet
            </span>
          </div>

          {/* Meeting Title */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              maxWidth: '900px',
              padding: '0 40px',
            }}
          >
            <h1
              style={{
                fontSize: '56px',
                fontWeight: 700,
                color: 'white',
                margin: '0 0 20px 0',
                lineHeight: 1.2,
                textAlign: 'center',
              }}
            >
              {title}
            </h1>

            {code && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  marginTop: '10px',
                }}
              >
                <span
                  style={{
                    fontSize: '24px',
                    color: '#9CA3AF',
                    marginRight: '12px',
                  }}
                >
                  Meeting Code:
                </span>
                <span
                  style={{
                    fontSize: '28px',
                    fontWeight: 600,
                    color: '#10B981',
                    fontFamily: 'monospace',
                    letterSpacing: '2px',
                  }}
                >
                  {code}
                </span>
              </div>
            )}
          </div>

          {/* Call to Action */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: '50px',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              borderRadius: '16px',
              padding: '20px 48px',
              boxShadow: '0 8px 32px rgba(16, 185, 129, 0.4)',
            }}
          >
            <span
              style={{
                fontSize: '28px',
                fontWeight: 600,
                color: 'white',
              }}
            >
              Click to Join Meeting
            </span>
          </div>

          {/* Footer */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              display: 'flex',
              alignItems: 'center',
              color: '#6B7280',
              fontSize: '18px',
            }}
          >
            <span>Secure video conferencing by Bheem Workspace</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error('OG Image generation failed:', e);
    return new Response(`Failed to generate image: ${e.message}`, {
      status: 500,
    });
  }
}
