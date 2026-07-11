import 'server-only'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const YT_API = 'https://www.googleapis.com/youtube/v3'

export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'

export function getRedirectUri(origin: string) {
  return `${origin}/api/youtube/callback`
}

export function buildAuthUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: getRedirectUri(origin),
    response_type: 'code',
    scope: YOUTUBE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export async function exchangeCodeForTokens(code: string, origin: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: getRedirectUri(origin),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${await res.text()}`)
  }
  return (await res.json()) as TokenResponse
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${await res.text()}`)
  }
  return (await res.json()) as TokenResponse
}

// Parse an ISO 8601 duration (e.g. "PT1H2M3S") into milliseconds.
export function parseIsoDuration(iso: string): number {
  const match = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso)
  if (!match) return 0
  const [, h, m, s] = match
  return (
    (Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0)) * 1000
  )
}

export type FetchedVideo = {
  videoId: string
  title: string
  channelTitle: string
  thumbnailUrl: string | null
  durationMs: number
}

// Fetch the current user's liked videos (paginated, capped for safety).
export async function fetchLikedVideos(
  accessToken: string,
  maxItems = 200,
): Promise<FetchedVideo[]> {
  const out: FetchedVideo[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      myRating: 'like',
      maxResults: '50',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(`${YT_API}/videos?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      throw new Error(`YouTube API error: ${res.status} ${await res.text()}`)
    }
    const data = await res.json()
    for (const item of data.items ?? []) {
      const thumbs = item.snippet?.thumbnails ?? {}
      const thumb =
        thumbs.medium?.url ?? thumbs.default?.url ?? thumbs.high?.url ?? null
      out.push({
        videoId: item.id,
        title: item.snippet?.title ?? 'Untitled',
        channelTitle: item.snippet?.channelTitle ?? '',
        thumbnailUrl: thumb,
        durationMs: parseIsoDuration(item.contentDetails?.duration ?? ''),
      })
      if (out.length >= maxItems) return out
    }
    pageToken = data.nextPageToken
  } while (pageToken)
  return out
}

export async function fetchChannelTitle(
  accessToken: string,
): Promise<string | null> {
  const res = await fetch(
    `${YT_API}/channels?part=snippet&mine=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.items?.[0]?.snippet?.title ?? null
}
