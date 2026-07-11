import { type NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { buildAuthUrl } from '@/lib/youtube'

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const state = randomBytes(16).toString('hex')
  const authUrl = buildAuthUrl(origin, state)

  const response = NextResponse.redirect(authUrl)
  // Store state in a short-lived cookie for CSRF verification on callback.
  response.cookies.set('yt_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}
