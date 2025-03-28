import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000/api/v1'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('Request body:', body)
    console.log('Backend URL:', BACKEND_URL)

    const backendUrl = `${BACKEND_URL}/download/info`
    console.log('Full backend URL:', backendUrl)

    // Get video info
    console.log('Sending request to backend...')
    const infoResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    
    console.log('Backend response status:', infoResponse.status)
    console.log('Backend response headers:', Object.fromEntries(infoResponse.headers.entries()))

    if (!infoResponse.ok) {
      const error = await infoResponse.json()
      console.error('Backend error response:', error)
      return NextResponse.json(
        { error: error.detail || error.error || 'Failed to get video information' },
        { status: infoResponse.status }
      )
    }

    const data = await infoResponse.json()
    console.log('Backend success response:', data)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Download error:', error)
    if (error instanceof Error) {
      console.error('Error stack:', error.stack)
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 