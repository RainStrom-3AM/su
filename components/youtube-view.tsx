'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  MonitorPlay,
  RefreshCw,
  ExternalLink,
  Unplug,
  ThumbsUp,
  Play,
  Pause,
} from 'lucide-react'
import { toast } from 'sonner'
import type { YoutubeLike } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  YoutubePlayerProvider,
  useYoutubePlayer,
} from '@/components/youtube-player'
import { syncYoutubeLikes, disconnectYoutube } from '@/app/actions/youtube'

type Status =
  | { connected: true; channelTitle: string | null; lastSyncedAt: Date | null }
  | { connected: false }

export function YoutubeView({
  status,
  likes,
}: {
  status: Status
  likes: YoutubeLike[]
}) {
  const router = useRouter()
  const [isSyncing, startSync] = useTransition()
  const [isDisconnecting, startDisconnect] = useTransition()
  const [pending, setPending] = useState(false)
  const autoSyncedRef = useRef(false)

  function handleConnect() {
    setPending(true)
    window.location.href = '/api/youtube/connect'
  }

  function handleSync(silent = false) {
    startSync(async () => {
      try {
        const { count } = await syncYoutubeLikes()
        if (!silent) {
          toast.success(`Synced ${count} liked video${count === 1 ? '' : 's'}`)
        }
        router.refresh()
      } catch (e) {
        if (!silent) {
          toast.error(
            e instanceof Error ? e.message : 'Failed to sync liked videos',
          )
        }
      }
    })
  }

  // Auto-sync once when the tab opens if we've never synced or it's stale (>15 min).
  useEffect(() => {
    if (!status.connected || autoSyncedRef.current) return
    autoSyncedRef.current = true
    const last = status.lastSyncedAt ? new Date(status.lastSyncedAt).getTime() : 0
    const stale = Date.now() - last > 15 * 60 * 1000
    if (stale) handleSync(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDisconnect() {
    startDisconnect(async () => {
      await disconnectYoutube()
      toast.success('YouTube disconnected')
      router.refresh()
    })
  }

  if (!status.connected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
          <MonitorPlay className="size-7 text-primary" />
        </div>
        <div className="max-w-sm">
          <h2 className="text-lg font-semibold text-foreground">
            Connect your YouTube account
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Import your liked videos into Resonance and play them right here in
            an embedded player.
          </p>
        </div>
        <Button onClick={handleConnect} disabled={pending}>
          <MonitorPlay data-icon="inline-start" />
          {pending ? 'Redirecting...' : 'Connect YouTube'}
        </Button>
      </div>
    )
  }

  return (
    <YoutubePlayerProvider likes={likes}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/40 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-secondary">
              <MonitorPlay className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {status.channelTitle ?? 'YouTube connected'}
              </p>
              <p className="text-xs text-muted-foreground">
                {status.lastSyncedAt
                  ? `Last synced ${new Date(status.lastSyncedAt).toLocaleString()}`
                  : 'Not synced yet'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSync(false)}
              disabled={isSyncing}
            >
              <RefreshCw
                data-icon="inline-start"
                className={isSyncing ? 'animate-spin' : undefined}
              />
              {isSyncing ? 'Syncing...' : 'Sync likes'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              <Unplug data-icon="inline-start" />
              Disconnect
            </Button>
          </div>
        </div>

        {likes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ThumbsUp className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No liked videos imported yet. Hit &quot;Sync likes&quot; to pull
              them in.
            </p>
          </div>
        ) : (
          <LikesList likes={likes} />
        )}
      </div>
    </YoutubePlayerProvider>
  )
}

function LikesList({ likes }: { likes: YoutubeLike[] }) {
  const { current, isPlaying, play, toggle } = useYoutubePlayer()

  return (
    <ul className="flex flex-col gap-1">
      {likes.map((like, i) => {
        const active = current?.id === like.id
        return (
          <li key={like.id}>
            <div
              className={cn(
                'group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-secondary/60',
                active && 'bg-secondary/70',
              )}
            >
              <button
                type="button"
                onClick={() => (active ? toggle() : play(i))}
                aria-label={active && isPlaying ? 'Pause' : 'Play'}
                className="relative aspect-video h-12 shrink-0 overflow-hidden rounded bg-muted"
              >
                {like.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={like.thumbnailUrl || '/placeholder.svg'}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <MonitorPlay className="size-4 text-muted-foreground" />
                  </div>
                )}
                <span
                  className={cn(
                    'absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity',
                    active && isPlaying
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100',
                  )}
                >
                  {active && isPlaying ? (
                    <Pause className="size-4 fill-current" />
                  ) : (
                    <Play className="size-4 translate-x-px fill-current" />
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => (active ? toggle() : play(i))}
                className="min-w-0 flex-1 text-left"
              >
                <p
                  className={cn(
                    'truncate text-sm font-medium',
                    active ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {like.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {like.channelTitle}
                </p>
              </button>
              {like.durationMs > 0 && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatDuration(like.durationMs)}
                </span>
              )}
              <a
                href={`https://www.youtube.com/watch?v=${like.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in YouTube"
                className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              >
                <ExternalLink className="size-4" />
              </a>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
