import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core'

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- App tables ------------------------------------------------------------

export const tracks = pgTable('tracks', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  title: text('title').notNull(),
  artist: text('artist').notNull().default('Unknown Artist'),
  album: text('album').notNull().default('Unknown Album'),
  genre: text('genre'),
  durationMs: integer('durationMs').notNull().default(0),
  fileUrl: text('fileUrl').notNull(),
  coverUrl: text('coverUrl'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const playlists = pgTable('playlists', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const playlistTracks = pgTable('playlist_tracks', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  playlistId: integer('playlistId').notNull(),
  trackId: integer('trackId').notNull(),
  position: integer('position').notNull().default(0),
})

export const playbackState = pgTable('playback_state', {
  userId: text('userId').primaryKey(),
  currentTrackId: integer('currentTrackId'),
  positionMs: integer('positionMs').notNull().default(0),
  isPlaying: boolean('isPlaying').notNull().default(false),
  queue: jsonb('queue').notNull().default([]),
  queueIndex: integer('queueIndex').notNull().default(0),
  shuffle: boolean('shuffle').notNull().default(false),
  repeat: text('repeat').notNull().default('off'),
  updatedBy: text('updatedBy'),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const youtubeConnection = pgTable('youtube_connection', {
  userId: text('userId').primaryKey(),
  accessToken: text('accessToken').notNull(),
  refreshToken: text('refreshToken'),
  expiresAt: timestamp('expiresAt'),
  channelTitle: text('channelTitle'),
  lastSyncedAt: timestamp('lastSyncedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const youtubeLikes = pgTable('youtube_likes', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  videoId: text('videoId').notNull(),
  title: text('title').notNull(),
  channelTitle: text('channelTitle'),
  thumbnailUrl: text('thumbnailUrl'),
  durationMs: integer('durationMs').notNull().default(0),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export type Track = typeof tracks.$inferSelect
export type Playlist = typeof playlists.$inferSelect
export type PlaybackState = typeof playbackState.$inferSelect
export type YoutubeConnection = typeof youtubeConnection.$inferSelect
export type YoutubeLike = typeof youtubeLikes.$inferSelect
