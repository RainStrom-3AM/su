import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { youtubeConnection } from '@/lib/db/schema'
import {
  exchangeCodeForTokens,
  fetchChannelTitle,
} from '@/lib/youtube'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const storedState = request.cookies.get('yt_oauth_state')?.value

  const home = new URL('/', request.url)

  if (error) {
    home.searchParams.set('youtube', 'error')
    return NextResponse.redirect(home)
  }
  if (!code || !state || state !== storedState) {
    home.searchParams.set('youtube', 'error')
    return NextResponse.redirect(home)
  }

  try {
    const tokens = await exchangeCodeForTokens(code, url.origin)
    const channelTitle = await fetchChannelTitle(tokens.access_token)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    await db
      .insert(youtubeConnection)
      .values({
        userId: session.user.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        channelTitle,
      })
      .onConflictDoUpdate({
        target: youtubeConnection.userId,
        set: {
          accessToken: tokens.access_token,
          // Google only returns a refresh_token on first consent; keep existing otherwise.
          ...(tokens.refresh_token
            ? { refreshToken: tokens.refresh_token }
            : {}),
          expiresAt,
          channelTitle,
        },
      })

    home.searchParams.set('youtube', 'connected')
  } catch (e) {
    console.error('[v0] YouTube callback error:', e)
    home.searchParams.set('youtube', 'error')
  }

  const response = NextResponse.redirect(home)
  response.cookies.delete('yt_oauth_state')
  return response
}
