/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  async redirects() {
    return [
      { source: '/sign-in', destination: '/', permanent: false },
      { source: '/sign-up', destination: '/', permanent: false },
    ]
  },
}

export default nextConfig
