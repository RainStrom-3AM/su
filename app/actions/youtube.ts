'use server'

import { db } from '@/lib/db'
import { youtubeConnection, youtubeLikes } from '@/lib/db/schema'
import { asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { fetchLikedVideos, refreshAccessToken } from '@/lib/youtube'
import { USER_ID } from '@/lib/user'

async function getUserId() {
  return USER_ID
}

export async function getYoutubeStatus() {
  const userId = await getUserId()
  const [conn] = await db
    .select({
      channelTitle: youtubeConnection.channelTitle,
      lastSyncedAt: youtubeConnection.lastSyncedAt,
    })
    .from(youtubeConnection)
    .where(eq(youtubeConnection.userId, userId))
  return conn
    ? {
        connected: true as const,
        channelTitle: conn.channelTitle,
        lastSyncedAt: conn.lastSyncedAt,
      }
    : { connected: false as const }
}

export async function getYoutubeLikes() {
  const userId = await getUserId()
  return db
    .select()
    .from(youtubeLikes)
    .where(eq(youtubeLikes.userId, userId))
    .orderBy(asc(youtubeLikes.position))
}

// Return a valid access token, refreshing it if it has expired.
async function getValidAccessToken(userId: string) {
  const [conn] = await db
    .select()
    .from(youtubeConnection)
    .where(eq(youtubeConnection.userId, userId))
  if (!conn) throw new Error('YouTube not connected')

  const expired =
    !conn.expiresAt || conn.expiresAt.getTime() < Date.now() + 60_000
  if (!expired) return conn.accessToken

  if (!conn.refreshToken) {
    throw new Error(
      'YouTube session expired. Please reconnect your account.',
    )
  }
  const refreshed = await refreshAccessToken(conn.refreshToken)
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000)
  await db
    .update(youtubeConnection)
    .set({ accessToken: refreshed.access_token, expiresAt })
    .where(eq(youtubeConnection.userId, userId))
  return refreshed.access_token
}

export async function syncYoutubeLikes() {
  const userId = await getUserId()
  const accessToken = await getValidAccessToken(userId)

  const videos = await fetchLikedVideos(accessToken)

  // Replace the stored set with the freshly fetched liked videos.
  await db.delete(youtubeLikes).where(eq(youtubeLikes.userId, userId))
  if (videos.length > 0) {
    await db.insert(youtubeLikes).values(
      videos.map((v, i) => ({
        userId,
        videoId: v.videoId,
        title: v.title,
        channelTitle: v.channelTitle,
        thumbnailUrl: v.thumbnailUrl,
        durationMs: v.durationMs,
        position: i,
      })),
    )
  }

  await db
    .update(youtubeConnection)
    .set({ lastSyncedAt: new Date() })
    .where(eq(youtubeConnection.userId, userId))

  revalidatePath('/')
  return { count: videos.length }
}

export async function disconnectYoutube() {
  const userId = await getUserId()
  await db.delete(youtubeLikes).where(eq(youtubeLikes.userId, userId))
  await db
    .delete(youtubeConnection)
    .where(eq(youtubeConnection.userId, userId))
  revalidatePath('/')
}
