import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          access: 'public',
          allowedContentTypes: ['audio/*', 'image/*'],
          maximumSizeInBytes: 1024 * 1024 * 100, // 100MB
          addRandomSuffix: true,
        }
      },
      onUploadCompleted: async () => {
        // no-op; the client persists metadata via a server action
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    )
  }
}
