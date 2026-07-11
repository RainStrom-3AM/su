'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { addTrack } from '@/app/actions/tracks'

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src)
      resolve(Math.round((audio.duration || 0) * 1000))
    }
    audio.onerror = () => resolve(0)
    audio.src = URL.createObjectURL(file)
  })
}

// Best-effort metadata from the filename: "Artist - Title.mp3"
function parseNameParts(filename: string) {
  const base = filename.replace(/\.[^/.]+$/, '')
  const parts = base.split(' - ')
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() }
  }
  return { artist: 'Unknown Artist', title: base.trim() }
}

export function UploadDialog() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  })

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const audioFiles = Array.from(files).filter((f) => f.type.startsWith('audio/'))
    if (audioFiles.length === 0) {
      toast.error('Please choose audio files.')
      return
    }

    setBusy(true)
    setProgress({ done: 0, total: audioFiles.length })

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i]
      try {
        const durationMs = await readAudioDuration(file)
        const blob = await upload(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/blob/upload',
        })
        const { artist, title } = parseNameParts(file.name)
        await addTrack({
          title,
          artist,
          album: 'Unknown Album',
          durationMs,
          fileUrl: blob.url,
        })
        setProgress({ done: i + 1, total: audioFiles.length })
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    setBusy(false)
    setOpen(false)
    toast.success(
      `Added ${audioFiles.length} track${audioFiles.length > 1 ? 's' : ''} to your library`,
    )
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload data-icon="inline-start" />
          Upload
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload music</DialogTitle>
          <DialogDescription>
            Add audio files to your library. Name files as {'"Artist - Title"'} for
            automatic tagging.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-secondary/40 px-6 py-10 text-center transition-colors hover:bg-secondary disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="size-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Uploading {progress.done} / {progress.total}...
              </span>
            </>
          ) : (
            <>
              <Upload className="size-8 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                Click to choose audio files
              </span>
              <span className="text-xs text-muted-foreground">
                MP3, FLAC, WAV, M4A — up to 100MB each
              </span>
            </>
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </DialogContent>
    </Dialog>
  )
}
