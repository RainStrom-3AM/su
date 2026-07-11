'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playlists, playlistTracks, tracks } from '@/lib/db/schema'
import { and, asc, desc, eq, max } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getPlaylists() {
  const userId = await getUserId()
  return db
    .select()
    .from(playlists)
    .where(eq(playlists.userId, userId))
    .orderBy(desc(playlists.createdAt))
}

export async function createPlaylist(name: string) {
  const userId = await getUserId()
  const [row] = await db
    .insert(playlists)
    .values({ userId, name: name.trim() || 'New Playlist' })
    .returning()
  revalidatePath('/')
  return row
}

export async function deletePlaylist(id: number) {
  const userId = await getUserId()
  await db
    .delete(playlistTracks)
    .where(and(eq(playlistTracks.playlistId, id), eq(playlistTracks.userId, userId)))
  await db
    .delete(playlists)
    .where(and(eq(playlists.id, id), eq(playlists.userId, userId)))
  revalidatePath('/')
}

export async function getPlaylistTracks(playlistId: number) {
  const userId = await getUserId()
  const rows = await db
    .select({
      track: tracks,
      position: playlistTracks.position,
      linkId: playlistTracks.id,
    })
    .from(playlistTracks)
    .innerJoin(tracks, eq(playlistTracks.trackId, tracks.id))
    .where(
      and(
        eq(playlistTracks.playlistId, playlistId),
        eq(playlistTracks.userId, userId),
      ),
    )
    .orderBy(asc(playlistTracks.position))
  return rows
}

export async function addTrackToPlaylist(playlistId: number, trackId: number) {
  const userId = await getUserId()
  const [{ value: currentMax }] = await db
    .select({ value: max(playlistTracks.position) })
    .from(playlistTracks)
    .where(
      and(
        eq(playlistTracks.playlistId, playlistId),
        eq(playlistTracks.userId, userId),
      ),
    )
  await db.insert(playlistTracks).values({
    userId,
    playlistId,
    trackId,
    position: (currentMax ?? -1) + 1,
  })
  revalidatePath('/')
}

export async function removeTrackFromPlaylist(linkId: number) {
  const userId = await getUserId()
  await db
    .delete(playlistTracks)
    .where(and(eq(playlistTracks.id, linkId), eq(playlistTracks.userId, userId)))
  revalidatePath('/')
}
