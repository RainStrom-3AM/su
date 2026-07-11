'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Library,
  ListMusic,
  Plus,
  Search,
  Play,
  Trash2,
  Music4,
  X,
  MonitorPlay,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Track, Playlist, YoutubeLike } from '@/lib/db/schema'
import { PlayerProvider, usePlayer } from '@/components/player-provider'
import { PlayerBar } from '@/components/player-bar'
import { TrackList } from '@/components/track-list'
import { UploadDialog } from '@/components/upload-dialog'
import { YoutubeView } from '@/components/youtube-view'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  createPlaylist,
  deletePlaylist,
  getPlaylistTracks,
  removeTrackFromPlaylist,
} from '@/app/actions/playlists'

type View =
  | { type: 'library' }
  | { type: 'playlist'; id: number }
  | { type: 'youtube' }

type YoutubeStatus =
  | { connected: true; channelTitle: string | null; lastSyncedAt: Date | null }
  | { connected: false }

export function MusicApp({
  tracks,
  playlists,
  youtubeStatus,
  youtubeLikes,
}: {
  tracks: Track[]
  playlists: Playlist[]
  youtubeStatus: YoutubeStatus
  youtubeLikes: YoutubeLike[]
}) {
  return (
    <PlayerProvider tracks={tracks}>
      <Shell
        tracks={tracks}
        playlists={playlists}
        youtubeStatus={youtubeStatus}
        youtubeLikes={youtubeLikes}
      />
    </PlayerProvider>
  )
}

function Shell({
  tracks,
  playlists,
  youtubeStatus,
  youtubeLikes,
}: {
  tracks: Track[]
  playlists: Playlist[]
  youtubeStatus: YoutubeStatus
  youtubeLikes: YoutubeLike[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { playQueue } = usePlayer()
  const [view, setView] = useState<View>({ type: 'library' })
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([])
  const [playlistLinks, setPlaylistLinks] = useState<Map<number, number>>(new Map())
  const [loadingView, setLoadingView] = useState(false)

  const filteredLibrary = useMemo(() => {
    if (!query.trim()) return tracks
    const q = query.toLowerCase()
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q),
    )
  }, [tracks, query])

  // Show a toast after returning from the YouTube OAuth redirect.
  useEffect(() => {
    const yt = searchParams.get('youtube')
    if (!yt) return
    if (yt === 'connected') {
      toast.success('YouTube connected')
      setView({ type: 'youtube' })
    } else if (yt === 'error') {
      toast.error('Could not connect YouTube. Please try again.')
    }
    router.replace('/')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const activePlaylist =
    view.type === 'playlist' ? playlists.find((p) => p.id === view.id) : null

  async function openPlaylist(id: number) {
    setLoadingView(true)
    setView({ type: 'playlist', id })
    try {
      const rows = await getPlaylistTracks(id)
      setPlaylistTracks(rows.map((r) => r.track))
      setPlaylistLinks(new Map(rows.map((r) => [r.track.id, r.linkId])))
    } finally {
      setLoadingView(false)
    }
  }

  async function handleCreatePlaylist() {
    if (!newName.trim()) return
    await createPlaylist(newName)
    setNewName('')
    setCreating(false)
    toast.success('Playlist created')
    router.refresh()
  }

  const displayedTracks =
    view.type === 'library' ? filteredLibrary : playlistTracks

  return (
    <div className="flex h-svh flex-col bg-background">
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
          <div className="flex items-center gap-2 px-5 py-5">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Music4 className="size-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Resonance</span>
          </div>

          <nav className="flex flex-col gap-1 px-3">
            <button
              type="button"
              onClick={() => setView({ type: 'library' })}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                view.type === 'library'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Library className="size-4" />
              Library
            </button>
            <button
              type="button"
              onClick={() => setView({ type: 'youtube' })}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                view.type === 'youtube'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <MonitorPlay className="size-4" />
              YouTube
            </button>
          </nav>

          <div className="mt-6 flex items-center justify-between px-5 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Playlists
            </span>
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              aria-label="Create playlist"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="size-4" />
            </button>
          </div>

          {creating && (
            <div className="flex items-center gap-2 px-3 pb-2">
              <Input
                value={newName}
                autoFocus
                placeholder="Playlist name"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    handleCreatePlaylist()
                  }
                  if (e.key === 'Escape') setCreating(false)
                }}
                className="h-8"
              />
            </div>
          )}

          <ScrollArea className="flex-1 px-3">
            <div className="flex flex-col gap-1 pb-4">
              {playlists.map((pl) => (
                <div
                  key={pl.id}
                  className={cn(
                    'group flex items-center gap-2 rounded-md pr-1 transition-colors',
                    view.type === 'playlist' && view.id === pl.id
                      ? 'bg-secondary'
                      : 'hover:bg-secondary/50',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openPlaylist(pl.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left text-sm"
                  >
                    <ListMusic className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-foreground">{pl.name}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${pl.name}`}
                    onClick={async () => {
                      await deletePlaylist(pl.id)
                      if (view.type === 'playlist' && view.id === pl.id) {
                        setView({ type: 'library' })
                      }
                      toast.success('Playlist deleted')
                      router.refresh()
                    }}
                    className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              {playlists.length === 0 && !creating && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No playlists yet.
                </p>
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-border px-3 py-3">
            <div className="flex items-center gap-2 px-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                <Music4 className="size-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  Resonance
                </p>
                <p className="text-xs text-muted-foreground">
                  Synced across your devices
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-6">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (view.type !== 'library') setView({ type: 'library' })
                }}
                placeholder="Search your library"
                className="pl-9"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="ml-auto">
              <UploadDialog />
            </div>
          </header>

          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
              {view.type === 'youtube' ? (
                <>
                  <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Connected Account
                    </p>
                    <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground">
                      YouTube Likes
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your liked videos, synced from YouTube.
                    </p>
                  </div>
                  <YoutubeView status={youtubeStatus} likes={youtubeLikes} />
                </>
              ) : (
                <>
                  {/* Header block */}
                  <div className="mb-6 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        {view.type === 'library' ? 'Your Library' : 'Playlist'}
                      </p>
                      <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground">
                        {view.type === 'library'
                          ? query
                            ? `Results for "${query}"`
                            : 'All Tracks'
                          : (activePlaylist?.name ?? 'Playlist')}
                      </h1>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {displayedTracks.length} track
                        {displayedTracks.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    {displayedTracks.length > 0 && (
                      <Button
                        onClick={() =>
                          playQueue(displayedTracks.map((t) => t.id), 0)
                        }
                      >
                        <Play data-icon="inline-start" className="fill-current" />
                        Play all
                      </Button>
                    )}
                  </div>

                  {loadingView ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      Loading...
                    </p>
                  ) : (
                    <TrackList
                      tracks={displayedTracks}
                      playlists={playlists}
                      onRemoveFromPlaylist={
                        view.type === 'playlist'
                          ? async (trackId) => {
                              const linkId = playlistLinks.get(trackId)
                              if (linkId) {
                                await removeTrackFromPlaylist(linkId)
                                await openPlaylist(view.id)
                                toast.success('Removed from playlist')
                              }
                            }
                          : undefined
                      }
                    />
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>

      <PlayerBar />
    </div>
  )
}
