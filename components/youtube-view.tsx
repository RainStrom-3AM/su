'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  MonitorPlay,
  RefreshCw,
  ExternalLink,
  Unplug,
  ThumbsUp,
} from 'lucide-react'
import { toast } from 'sonner'
import type { YoutubeLike } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/format'
import {
  syncYoutubeLikes,
  disconnectYoutube,
} from '@/app/actions/youtube'

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

  function handleConnect() {
    setPending(true)
    window.location.href = '/api/youtube/connect'
  }

  function handleSync() {
    startSync(async () => {
      try {
        const { count } = await syncYoutubeLikes()
        toast.success(`Synced ${count} liked video${count === 1 ? '' : 's'}`)
        router.refresh()
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'Failed to sync liked videos',
        )
      }
    })
  }

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
            Import your liked videos into Resonance. Tracks open directly in
            YouTube for playback.
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
            onClick={handleSync}
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
            No liked videos imported yet. Hit &quot;Sync likes&quot; to pull them
            in.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {likes.map((like) => (
            <li key={like.id}>
              <a
                href={`https://www.youtube.com/watch?v=${like.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-secondary/60"
              >
                <div className="relative aspect-video h-12 shrink-0 overflow-hidden rounded bg-muted">
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
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {like.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {like.channelTitle}
                  </p>
                </div>
                {like.durationMs > 0 && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatDuration(like.durationMs)}
                  </span>
                )}
                <ExternalLink className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
