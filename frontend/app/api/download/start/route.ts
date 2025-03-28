import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000/api/v1'

interface RequestOptions extends RequestInit {
  duplex?: 'half';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('Starting download request:', body)

    const backendUrl = `${BACKEND_URL}/download/start`
    console.log('Fetching from backend URL:', backendUrl)
    
    // Use properly typed options with streaming enabled
    const fetchOptions: RequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      duplex: 'half',
    }

    console.log('Sending request to backend with options:', fetchOptions)
    const response = await fetch(backendUrl, fetchOptions)
    console.log('Received backend response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Backend error:', error)
      return NextResponse.json(
        { error: error.detail || error.error || 'Failed to start download' },
        { status: response.status }
      )
    }

    // Get headers from backend response
    const headers = new Headers(response.headers)

    // Ensure proper headers for video streaming
    headers.set('Content-Type', response.headers.get('content-type') || 'video/mp4')
    headers.set('Content-Disposition', response.headers.get('content-disposition') || 'attachment; filename="video.mp4"')
    
    // Don't modify transfer-encoding or content-length, let the runtime handle it
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    headers.set('Pragma', 'no-cache')
    headers.set('Expires', '0')

    console.log('Streaming response with headers:', Object.fromEntries(headers.entries()))

    // Return the response with minimal modification
    return new NextResponse(response.body, {
      status: 200,
      headers,
      statusText: 'OK'
    })

  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 