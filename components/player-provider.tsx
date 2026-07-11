'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Track } from '@/lib/db/schema'
import { getPlayback, savePlayback } from '@/app/actions/playback'

type RepeatMode = 'off' | 'all' | 'one'

type PlayerState = {
  tracks: Track[]
  currentTrack: Track | null
  currentTrackId: number | null
  isPlaying: boolean
  positionMs: number
  durationMs: number
  queue: number[]
  queueIndex: number
  shuffle: boolean
  repeat: RepeatMode
  syncedFromOtherDevice: boolean
  playTrack: (trackId: number, queue?: number[]) => void
  playQueue: (trackIds: number[], startIndex?: number) => void
  togglePlay: () => void
  next: () => void
  previous: () => void
  seek: (ms: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  addToQueue: (trackId: number) => void
  playNext: (trackId: number) => void
}

const PlayerContext = createContext<PlayerState | null>(null)

// A stable per-tab/device id so we know which device last changed state.
function getDeviceId() {
  if (typeof window === 'undefined') return 'server'
  let id = window.sessionStorage.getItem('resonance-device-id')
  if (!id) {
    id = `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
    window.sessionStorage.setItem('resonance-device-id', id)
  }
  return id
}

export function PlayerProvider({
  tracks,
  children,
}: {
  tracks: Track[]
  children: React.ReactNode
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const deviceIdRef = useRef<string>('')
  const lastSyncedRef = useRef<string>('') // updatedAt we last applied
  const suppressSaveRef = useRef(false) // avoid echoing remote updates back

  const [currentTrackId, setCurrentTrackId] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [queue, setQueue] = useState<number[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [syncedFromOtherDevice, setSyncedFromOtherDevice] = useState(false)

  const trackMap = useMemo(() => {
    const m = new Map<number, Track>()
    for (const t of tracks) m.set(t.id, t)
    return m
  }, [tracks])

  const currentTrack = currentTrackId ? trackMap.get(currentTrackId) ?? null : null

  useEffect(() => {
    deviceIdRef.current = getDeviceId()
    audioRef.current = new Audio()
    audioRef.current.preload = 'metadata'
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  // Persist current playback to the server (debounced by callers).
  const persist = useCallback(
    (override?: Partial<{
      currentTrackId: number | null
      positionMs: number
      isPlaying: boolean
      queue: number[]
      queueIndex: number
      shuffle: boolean
      repeat: RepeatMode
    }>) => {
      if (suppressSaveRef.current) return
      const payload = {
        deviceId: deviceIdRef.current,
        currentTrackId: override?.currentTrackId ?? currentTrackId,
        positionMs: Math.round(override?.positionMs ?? positionMs),
        isPlaying: override?.isPlaying ?? isPlaying,
        queue: override?.queue ?? queue,
        queueIndex: override?.queueIndex ?? queueIndex,
        shuffle: override?.shuffle ?? shuffle,
        repeat: override?.repeat ?? repeat,
      }
      savePlayback(payload).then((res) => {
        if (res?.updatedAt) lastSyncedRef.current = res.updatedAt
      }).catch(() => {})
    },
    [currentTrackId, positionMs, isPlaying, queue, queueIndex, shuffle, repeat],
  )

  const loadAndPlay = useCallback(
    (trackId: number, autoplay: boolean, startMs = 0) => {
      const track = trackMap.get(trackId)
      const audio = audioRef.current
      if (!track || !audio) return
      if (audio.src !== track.fileUrl) {
        audio.src = track.fileUrl
        audio.load()
      }
      if (startMs > 0) {
        audio.currentTime = startMs / 1000
      }
      if (autoplay) {
        audio.play().catch(() => setIsPlaying(false))
      }
    },
    [trackMap],
  )

  const playQueueInternal = useCallback(
    (trackIds: number[], startIndex: number, autoplay = true) => {
      if (trackIds.length === 0) return
      const idx = Math.max(0, Math.min(startIndex, trackIds.length - 1))
      const trackId = trackIds[idx]
      setQueue(trackIds)
      setQueueIndex(idx)
      setCurrentTrackId(trackId)
      setPositionMs(0)
      setIsPlaying(autoplay)
      loadAndPlay(trackId, autoplay, 0)
      persist({
        currentTrackId: trackId,
        queue: trackIds,
        queueIndex: idx,
        positionMs: 0,
        isPlaying: autoplay,
      })
    },
    [loadAndPlay, persist],
  )

  const playTrack = useCallback(
    (trackId: number, q?: number[]) => {
      const nextQueue = q ?? [trackId]
      const idx = nextQueue.indexOf(trackId)
      playQueueInternal(nextQueue, idx === -1 ? 0 : idx)
    },
    [playQueueInternal],
  )

  const playQueue = useCallback(
    (trackIds: number[], startIndex = 0) => {
      playQueueInternal(trackIds, startIndex)
    },
    [playQueueInternal],
  )

  const next = useCallback(() => {
    if (queue.length === 0) return
    let nextIdx = queueIndex + 1
    if (shuffle && queue.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * queue.length)
      } while (nextIdx === queueIndex)
    }
    if (nextIdx >= queue.length) {
      if (repeat === 'all') nextIdx = 0
      else {
        setIsPlaying(false)
        persist({ isPlaying: false })
        return
      }
    }
    const trackId = queue[nextIdx]
    setQueueIndex(nextIdx)
    setCurrentTrackId(trackId)
    setPositionMs(0)
    setIsPlaying(true)
    loadAndPlay(trackId, true, 0)
    persist({ currentTrackId: trackId, queueIndex: nextIdx, positionMs: 0, isPlaying: true })
  }, [queue, queueIndex, shuffle, repeat, loadAndPlay, persist])

  const previous = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      setPositionMs(0)
      return
    }
    if (queue.length === 0) return
    const prevIdx = Math.max(0, queueIndex - 1)
    const trackId = queue[prevIdx]
    setQueueIndex(prevIdx)
    setCurrentTrackId(trackId)
    setPositionMs(0)
    setIsPlaying(true)
    loadAndPlay(trackId, true, 0)
    persist({ currentTrackId: trackId, queueIndex: prevIdx, positionMs: 0, isPlaying: true })
  }, [queue, queueIndex, loadAndPlay, persist])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentTrackId) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      persist({ isPlaying: false })
    } else {
      audio.play().catch(() => {})
      setIsPlaying(true)
      persist({ isPlaying: true })
    }
  }, [isPlaying, currentTrackId, persist])

  const seek = useCallback(
    (ms: number) => {
      const audio = audioRef.current
      if (!audio) return
      audio.currentTime = ms / 1000
      setPositionMs(ms)
      persist({ positionMs: ms })
    },
    [persist],
  )

  const toggleShuffle = useCallback(() => {
    setShuffle((s) => {
      const v = !s
      persist({ shuffle: v })
      return v
    })
  }, [persist])

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => {
      const order: RepeatMode[] = ['off', 'all', 'one']
      const v = order[(order.indexOf(r) + 1) % order.length]
      persist({ repeat: v })
      return v
    })
  }, [persist])

  const addToQueue = useCallback(
    (trackId: number) => {
      setQueue((q) => {
        const nq = [...q, trackId]
        persist({ queue: nq })
        return nq
      })
    },
    [persist],
  )

  const playNext = useCallback(
    (trackId: number) => {
      setQueue((q) => {
        const nq = [...q]
        nq.splice(queueIndex + 1, 0, trackId)
        persist({ queue: nq })
        return nq
      })
    },
    [queueIndex, persist],
  )

  // Wire audio element events.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setPositionMs(audio.currentTime * 1000)
    const onDuration = () => setDurationMs((audio.duration || 0) * 1000)
    const onEnded = () => {
      if (repeat === 'one') {
        audio.currentTime = 0
        audio.play().catch(() => {})
        return
      }
      next()
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onDuration)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onDuration)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [repeat, next])

  // Media Session API (lock screen / hardware keys).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    if (!currentTrack) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: currentTrack.coverUrl
        ? [{ src: currentTrack.coverUrl, sizes: '512x512', type: 'image/png' }]
        : undefined,
    })
    navigator.mediaSession.setActionHandler('play', () => togglePlay())
    navigator.mediaSession.setActionHandler('pause', () => togglePlay())
    navigator.mediaSession.setActionHandler('nexttrack', () => next())
    navigator.mediaSession.setActionHandler('previoustrack', () => previous())
  }, [currentTrack, togglePlay, next, previous])

  // Persist position periodically while playing.
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      persist()
    }, 5000)
    return () => clearInterval(interval)
  }, [isPlaying, persist])

  // --- Cross-device sync: poll the server for remote changes ---------------
  useEffect(() => {
    // Load initial state once.
    let cancelled = false
    getPlayback().then((snap) => {
      if (cancelled || !snap) return
      lastSyncedRef.current = snap.updatedAt
      suppressSaveRef.current = true
      setQueue(snap.queue)
      setQueueIndex(snap.queueIndex)
      setShuffle(snap.shuffle)
      setRepeat(snap.repeat)
      if (snap.currentTrackId) {
        setCurrentTrackId(snap.currentTrackId)
        setPositionMs(snap.positionMs)
        // Load but do not autoplay on first load (browser autoplay policy).
        loadAndPlay(snap.currentTrackId, false, snap.positionMs)
      }
      setTimeout(() => {
        suppressSaveRef.current = false
      }, 500)
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [loadAndPlay])

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const snap = await getPlayback()
        if (!snap) return
        // Ignore our own writes and stale updates.
        if (snap.updatedBy === deviceIdRef.current) {
          lastSyncedRef.current = snap.updatedAt
          return
        }
        if (snap.updatedAt === lastSyncedRef.current) return
        lastSyncedRef.current = snap.updatedAt

        // Apply the remote state without echoing it back.
        suppressSaveRef.current = true
        setSyncedFromOtherDevice(true)
        setTimeout(() => setSyncedFromOtherDevice(false), 2500)

        setQueue(snap.queue)
        setQueueIndex(snap.queueIndex)
        setShuffle(snap.shuffle)
        setRepeat(snap.repeat)

        if (snap.currentTrackId !== currentTrackId) {
          setCurrentTrackId(snap.currentTrackId)
          setPositionMs(snap.positionMs)
          loadAndPlay(snap.currentTrackId ?? 0, snap.isPlaying, snap.positionMs)
        } else {
          const audio = audioRef.current
          if (audio && Math.abs(audio.currentTime * 1000 - snap.positionMs) > 2500) {
            audio.currentTime = snap.positionMs / 1000
          }
          if (snap.isPlaying && !isPlaying) {
            audioRef.current?.play().catch(() => {})
          } else if (!snap.isPlaying && isPlaying) {
            audioRef.current?.pause()
          }
        }
        setIsPlaying(snap.isPlaying)
        setTimeout(() => {
          suppressSaveRef.current = false
        }, 500)
      } catch {
        // ignore poll errors
      }
    }, 3000)
    return () => clearInterval(poll)
  }, [currentTrackId, isPlaying, loadAndPlay])

  const value: PlayerState = {
    tracks,
    currentTrack,
    currentTrackId,
    isPlaying,
    positionMs,
    durationMs: durationMs || (currentTrack?.durationMs ?? 0),
    queue,
    queueIndex,
    shuffle,
    repeat,
    syncedFromOtherDevice,
    playTrack,
    playQueue,
    togglePlay,
    next,
    previous,
    seek,
    toggleShuffle,
    cycleRepeat,
    addToQueue,
    playNext,
  }

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
