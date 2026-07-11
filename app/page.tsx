import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getTracks } from '@/app/actions/tracks'
import { getPlaylists } from '@/app/actions/playlists'
import { MusicApp } from '@/components/music-app'

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const [tracks, playlists] = await Promise.all([getTracks(), getPlaylists()])

  return (
    <MusicApp
      tracks={tracks}
      playlists={playlists}
      userName={session.user.name || session.user.email}
    />
  )
}
