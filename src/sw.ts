import { defaultCache } from '@serwist/next/worker'
import { Serwist, CacheFirst, NetworkOnly, ExpirationPlugin } from 'serwist'

declare const self: EventTarget & {
  __SW_MANIFEST: (string | { url: string; revision: string | null })[]
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: /^\/api\/pwa\/icons\//,
      handler: new CacheFirst({
        cacheName: 'pwa-icons',
        plugins: [new ExpirationPlugin({ maxAgeSeconds: 86400 })],
      }),
    },
    {
      matcher: /^\/api\//,
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
})

serwist.addEventListeners()
