'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Play,
  Pause,
  MoreHorizontal,
  ListPlus,
  ListEnd,
  Trash2,
  Music2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Track, Playlist } from '@/lib/db/schema'
import { usePlayer } from '@/components/player-provider'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { deleteTrack } from '@/app/actions/tracks'
import { addTrackToPlaylist } from '@/app/actions/playlists'

export function TrackList({
  tracks,
  playlists,
  onRemoveFromPlaylist,
}: {
  tracks: Track[]
  playlists: Playlist[]
  onRemoveFromPlaylist?: (trackId: number) => void
}) {
  const router = useRouter()
  const { currentTrackId, isPlaying, playQueue, togglePlay, addToQueue, playNext } =
    usePlayer()

  const queueIds = tracks.map((t) => t.id)

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <Music2 className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No tracks here yet.</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col">
      {tracks.map((track, index) => {
        const isCurrent = track.id === currentTrackId
        return (
          <li
            key={track.id}
            className={cn(
              'group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-secondary/60',
              isCurrent && 'bg-secondary/60',
            )}
          >
            <button
              type="button"
              onClick={() =>
                isCurrent ? togglePlay() : playQueue(queueIds, index)
              }
              className="flex size-9 shrink-0 items-center justify-center"
              aria-label={isCurrent && isPlaying ? 'Pause' : `Play ${track.title}`}
            >
              <span className="relative flex size-9 items-center justify-center overflow-hidden rounded bg-secondary">
                {track.coverUrl ? (
                  <Image
                    src={track.coverUrl || '/placeholder.svg'}
                    alt=""
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  <span className="text-xs tabular-nums text-muted-foreground group-hover:opacity-0">
                    {index + 1}
                  </span>
                )}
                <span
                  className={cn(
                    'absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100',
                    isCurrent && 'opacity-100',
                  )}
                >
                  {isCurrent && isPlaying ? (
                    <Pause className="size-4 fill-current text-primary" />
                  ) : (
                    <Play className="size-4 translate-x-px fill-current text-foreground" />
                  )}
                </span>
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'truncate text-sm font-medium',
                  isCurrent ? 'text-primary' : 'text-foreground',
                )}
              >
                {track.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {track.artist}
              </p>
            </div>

            <span className="hidden truncate text-sm text-muted-foreground sm:block sm:w-40">
              {track.album}
            </span>

            <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
              {formatDuration(track.durationMs)}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Track options"
                  className="flex size-8 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => playNext(track.id)}>
                    <ListPlus className="size-4" />
                    Play next
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addToQueue(track.id)}>
                    <ListEnd className="size-4" />
                    Add to queue
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                {playlists.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        Add to playlist
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {playlists.map((pl) => (
                          <DropdownMenuItem
                            key={pl.id}
                            onClick={async () => {
                              await addTrackToPlaylist(pl.id, track.id)
                              toast.success(`Added to ${pl.name}`)
                              router.refresh()
                            }}
                          >
                            {pl.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
                <DropdownMenuSeparator />
                {onRemoveFromPlaylist ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onRemoveFromPlaylist(track.id)}
                  >
                    <Trash2 className="size-4" />
                    Remove from playlist
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={async () => {
                      await deleteTrack(track.id)
                      toast.success('Track deleted')
                      router.refresh()
                    }}
                  >
                    <Trash2 className="size-4" />
                    Delete from library
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        )
      })}
    </ul>
  )
}
