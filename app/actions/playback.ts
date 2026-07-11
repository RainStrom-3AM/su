'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { playbackState } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export type PlaybackSnapshot = {
  currentTrackId: number | null
  positionMs: number
  isPlaying: boolean
  queue: number[]
  queueIndex: number
  shuffle: boolean
  repeat: 'off' | 'all' | 'one'
  updatedBy: string | null
  updatedAt: string
}

export async function getPlayback(): Promise<PlaybackSnapshot | null> {
  const userId = await getUserId()
  const [row] = await db
    .select()
    .from(playbackState)
    .where(eq(playbackState.userId, userId))
  if (!row) return null
  return {
    currentTrackId: row.currentTrackId ?? null,
    positionMs: row.positionMs,
    isPlaying: row.isPlaying,
    queue: (row.queue as number[]) ?? [],
    queueIndex: row.queueIndex,
    shuffle: row.shuffle,
    repeat: row.repeat as 'off' | 'all' | 'one',
    updatedBy: row.updatedBy ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function savePlayback(input: {
  deviceId: string
  currentTrackId: number | null
  positionMs: number
  isPlaying: boolean
  queue: number[]
  queueIndex: number
  shuffle: boolean
  repeat: 'off' | 'all' | 'one'
}) {
  const userId = await getUserId()
  const now = new Date()
  await db
    .insert(playbackState)
    .values({
      userId,
      currentTrackId: input.currentTrackId,
      positionMs: input.positionMs,
      isPlaying: input.isPlaying,
      queue: input.queue,
      queueIndex: input.queueIndex,
      shuffle: input.shuffle,
      repeat: input.repeat,
      updatedBy: input.deviceId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: playbackState.userId,
      set: {
        currentTrackId: input.currentTrackId,
        positionMs: input.positionMs,
        isPlaying: input.isPlaying,
        queue: input.queue,
        queueIndex: input.queueIndex,
        shuffle: input.shuffle,
        repeat: input.repeat,
        updatedBy: input.deviceId,
        updatedAt: now,
      },
    })
  return { updatedAt: now.toISOString() }
}
