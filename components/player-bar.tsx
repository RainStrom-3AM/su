'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Music2,
  MonitorSmartphone,
} from 'lucide-react'
import { usePlayer } from '@/components/player-provider'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

export function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    positionMs,
    durationMs,
    shuffle,
    repeat,
    syncedFromOtherDevice,
    togglePlay,
    next,
    previous,
    seek,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer()

  const [scrubbing, setScrubbing] = useState<number | null>(null)
  const displayMs = scrubbing ?? positionMs
  const progress = durationMs > 0 ? (displayMs / durationMs) * 100 : 0

  return (
    <footer className="border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      {syncedFromOtherDevice && (
        <div className="flex items-center justify-center gap-2 bg-primary/15 py-1 text-xs text-primary">
          <MonitorSmartphone className="size-3.5" />
          Synced from another device
        </div>
      )}
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        {/* Track info */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
            {currentTrack?.coverUrl ? (
              <Image
                src={currentTrack.coverUrl || '/placeholder.svg'}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <Music2 className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {currentTrack?.title ?? 'Nothing playing'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {currentTrack?.artist ?? 'Select a track to start'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-[2] flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggleShuffle}
              aria-label="Toggle shuffle"
              className={cn(
                'text-muted-foreground transition-colors hover:text-foreground',
                shuffle && 'text-primary',
              )}
            >
              <Shuffle className="size-4" />
            </button>
            <button
              type="button"
              onClick={previous}
              aria-label="Previous track"
              className="text-foreground transition-transform hover:scale-110"
            >
              <SkipBack className="size-5 fill-current" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              disabled={!currentTrack}
              className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-40"
            >
              {isPlaying ? (
                <Pause className="size-5 fill-current" />
              ) : (
                <Play className="size-5 translate-x-px fill-current" />
              )}
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next track"
              className="text-foreground transition-transform hover:scale-110"
            >
              <SkipForward className="size-5 fill-current" />
            </button>
            <button
              type="button"
              onClick={cycleRepeat}
              aria-label="Cycle repeat mode"
              className={cn(
                'text-muted-foreground transition-colors hover:text-foreground',
                repeat !== 'off' && 'text-primary',
              )}
            >
              {repeat === 'one' ? (
                <Repeat1 className="size-4" />
              ) : (
                <Repeat className="size-4" />
              )}
            </button>
          </div>

          {/* Seek bar */}
          <div className="flex w-full max-w-xl items-center gap-2">
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {formatDuration(displayMs)}
            </span>
            <input
              type="range"
              min={0}
              max={durationMs || 0}
              value={displayMs}
              onChange={(e) => setScrubbing(Number(e.target.value))}
              onMouseUp={(e) => {
                seek(Number((e.target as HTMLInputElement).value))
                setScrubbing(null)
              }}
              onTouchEnd={(e) => {
                seek(Number((e.target as HTMLInputElement).value))
                setScrubbing(null)
              }}
              disabled={!currentTrack}
              aria-label="Seek"
              className="range-slider flex-1"
              style={{
                background: `linear-gradient(to right, var(--primary) ${progress}%, var(--secondary) ${progress}%)`,
              }}
            />
            <span className="w-10 text-xs tabular-nums text-muted-foreground">
              {formatDuration(durationMs)}
            </span>
          </div>
        </div>

        {/* Right spacer to balance layout on desktop */}
        <div className="hidden flex-1 md:block" aria-hidden />
      </div>
    </footer>
  )
}
