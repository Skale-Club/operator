import { type NextRequest, NextResponse } from 'next/server'
import { unstable_noStore } from 'next/cache'
import sharp from 'sharp'
import { getFaviconUrl } from '@/lib/seo'
import { APP_NAME } from '@/lib/config'

const BRAND_INITIAL = APP_NAME.charAt(0).toUpperCase()

function fallbackSvg(size: number): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="url(#g)"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
        font-family="system-ui, sans-serif" font-weight="700"
        font-size="${Math.round(size * 0.5)}" fill="white">${BRAND_INITIAL}</text>
</svg>`
  return Buffer.from(svg)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ size: string }> }
) {
  unstable_noStore()

  const { size: sizeParam } = await params
  const size = Math.min(Math.max(parseInt(sizeParam, 10) || 192, 16), 1024)
  const maskable = request.nextUrl.searchParams.has('maskable')

  try {
    const faviconUrl = await getFaviconUrl()
    let inputBuffer: Buffer

    if (faviconUrl) {
      const res = await fetch(faviconUrl, { next: { revalidate: 3600 } })
      if (!res.ok) throw new Error('fetch failed')
      inputBuffer = Buffer.from(await res.arrayBuffer())
    } else {
      inputBuffer = fallbackSvg(size)
    }

    let pipeline = sharp(inputBuffer).resize(
      maskable ? Math.round(size * 0.8) : size,
      maskable ? Math.round(size * 0.8) : size,
      { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
    )

    if (maskable) {
      pipeline = sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 99, g: 102, b: 241, alpha: 1 },
        },
      }).composite([{ input: await pipeline.png().toBuffer(), gravity: 'center' }])
    }

    const png = await pipeline.png().toBuffer()

    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    })
  } catch {
    const fallback = await sharp(fallbackSvg(size)).resize(size, size).png().toBuffer()
    return new NextResponse(new Uint8Array(fallback), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }
}
