'use server'

import { db } from '@/lib/db'
import { tracks } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { del } from '@vercel/blob'
import { USER_ID } from '@/lib/user'

async function getUserId() {
  return USER_ID
}

export async function getTracks() {
  const userId = await getUserId()
  return db
    .select()
    .from(tracks)
    .where(eq(tracks.userId, userId))
    .orderBy(desc(tracks.createdAt))
}

export async function addTrack(input: {
  title: string
  artist: string
  album: string
  genre?: string
  durationMs: number
  fileUrl: string
  coverUrl?: string
}) {
  const userId = await getUserId()
  const [row] = await db
    .insert(tracks)
    .values({
      userId,
      title: input.title,
      artist: input.artist || 'Unknown Artist',
      album: input.album || 'Unknown Album',
      genre: input.genre,
      durationMs: input.durationMs,
      fileUrl: input.fileUrl,
      coverUrl: input.coverUrl,
    })
    .returning()
  revalidatePath('/')
  return row
}

export async function deleteTrack(id: number) {
  const userId = await getUserId()
  const [row] = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)))
  if (row?.fileUrl) {
    try {
      await del(row.fileUrl)
    } catch {
      // ignore blob deletion failures
    }
  }
  await db.delete(tracks).where(and(eq(tracks.id, id), eq(tracks.userId, userId)))
  revalidatePath('/')
}
