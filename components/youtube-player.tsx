'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import Image from 'next/image'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  ExternalLink,
} from 'lucide-react'
import type { YoutubeLike } from '@/lib/db/schema'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

type YoutubePlayerState = {
  current: YoutubeLike | null
  index: number
  isPlaying: boolean
  play: (index: number) => void
  toggle: () => void
  next: () => void
  previous: () => void
  close: () => void
}

const Ctx = createContext<YoutubePlayerState | null>(null)

let apiPromise: Promise<void> | null = null
function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.YT && window.YT.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiPromise
}

export function YoutubePlayerProvider({
  likes,
  children,
}: {
  likes: YoutubeLike[]
  children: React.ReactNode
}) {
  const playerRef = useRef<any>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const pendingRef = useRef<string | null>(null)
  const likesRef = useRef(likes)
  likesRef.current = likes

  const [ready, setReady] = useState(false)
  const [index, setIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)

  const current = index >= 0 && index < likes.length ? likes[index] : null

  const createPlayer = useCallback(() => {
    if (playerRef.current || !hostRef.current || !window.YT?.Player) return
    playerRef.current = new window.YT.Player(hostRef.current, {
      width: '100%',
      height: '100%',
      playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          setReady(true)
          if (pendingRef.current) {
            playerRef.current.loadVideoById(pendingRef.current)
            pendingRef.current = null
          }
        },
        onStateChange: (e: any) => {
          const YT = window.YT
          if (e.data === YT.PlayerState.ENDED) {
            setIndex((i) => (i + 1 < likesRef.current.length ? i + 1 : -1))
          } else if (e.data === YT.PlayerState.PLAYING) {
            setIsPlaying(true)
          } else if (e.data === YT.PlayerState.PAUSED) {
            setIsPlaying(false)
          }
        },
      },
    })
  }, [])

  // Load / switch the video whenever the current selection changes.
  useEffect(() => {
    if (!current) return
    if (playerRef.current && ready) {
      playerRef.current.loadVideoById(current.videoId)
    } else {
      pendingRef.current = current.videoId
      loadYouTubeApi().then(() => {
        // Give the host node a tick to mount, then create the player.
        requestAnimationFrame(createPlayer)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.videoId, ready, createPlayer])

  const play = useCallback((i: number) => {
    setIndex(i)
    setIsPlaying(true)
  }, [])

  const toggle = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    if (isPlaying) p.pauseVideo()
    else p.playVideo()
  }, [isPlaying])

  const next = useCallback(() => {
    setIndex((i) => (i + 1 < likesRef.current.length ? i + 1 : i))
  }, [])

  const previous = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i))
  }, [])

  const close = useCallback(() => {
    playerRef.current?.stopVideo?.()
    setIsPlaying(false)
    setIndex(-1)
  }, [])

  const value: YoutubePlayerState = {
    current,
    index,
    isPlaying,
    play,
    toggle,
    next,
    previous,
    close,
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      <YoutubePlayerDock hostRef={hostRef} />
    </Ctx.Provider>
  )
}

function YoutubePlayerDock({
  hostRef,
}: {
  hostRef: React.RefObject<HTMLDivElement | null>
}) {
  const { current, isPlaying, toggle, next, previous, close } =
    useYoutubePlayer()

  return (
    <div
      className={current ? 'fixed bottom-28 right-4 z-40 w-80 max-w-[calc(100vw-2rem)]' : 'sr-only'}
      aria-hidden={!current}
    >
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* The IFrame API replaces this node with the actual player iframe. */}
        <div className="relative aspect-video w-full bg-black">
          <div ref={hostRef} className="absolute inset-0 size-full" />
        </div>
        {current && (
          <div className="flex items-center gap-2 p-3">
            <div className="relative size-9 shrink-0 overflow-hidden rounded bg-secondary">
              {current.thumbnailUrl ? (
                <Image
                  src={current.thumbnailUrl || '/placeholder.svg'}
                  alt=""
                  fill
                  sizes="36px"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {current.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {current.channelTitle}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={previous}
                aria-label="Previous"
                className="flex size-8 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <SkipBack className="size-4 fill-current" />
              </button>
              <button
                type="button"
                onClick={toggle}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform"
              >
                {isPlaying ? (
                  <Pause className="size-4 fill-current" />
                ) : (
                  <Play className="size-4 translate-x-px fill-current" />
                )}
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next"
                className="flex size-8 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <SkipForward className="size-4 fill-current" />
              </button>
              <a
                href={`https://www.youtube.com/watch?v=${current.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in YouTube"
                className="flex size-8 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="size-4" />
              </a>
              <button
                type="button"
                onClick={close}
                aria-label="Close player"
                className="flex size-8 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function useYoutubePlayer() {
  const ctx = useContext(Ctx)
  if (!ctx)
    throw new Error('useYoutubePlayer must be used within YoutubePlayerProvider')
  return ctx
}
