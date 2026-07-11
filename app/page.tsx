import { getTracks } from '@/app/actions/tracks'
import { getPlaylists } from '@/app/actions/playlists'
import { getYoutubeStatus, getYoutubeLikes } from '@/app/actions/youtube'
import { MusicApp } from '@/components/music-app'

export default async function HomePage() {
  const [tracks, playlists, youtubeStatus, youtubeLikes] = await Promise.all([
    getTracks(),
    getPlaylists(),
    getYoutubeStatus(),
    getYoutubeLikes(),
  ])

  return (
    <MusicApp
      tracks={tracks}
      playlists={playlists}
      youtubeStatus={youtubeStatus}
      youtubeLikes={youtubeLikes}
    />
  )
}
