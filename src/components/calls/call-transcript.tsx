'use client'

import { CheckCircle, XCircle } from 'lucide-react'
import type { TranscriptItem } from '@/lib/calls/timeline'

interface CallTranscriptProps {
  timeline: TranscriptItem[]
}

export function CallTranscript({ timeline }: CallTranscriptProps) {
  if (timeline.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No transcript available.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {timeline.map((item, index) => {
        if (item.kind === 'turn') {
          if (item.role === 'user') {
            return (
              <div key={index} className="flex justify-end mb-3">
                <div className="max-w-[75%] rounded-2xl px-4 py-2 bg-primary text-primary-foreground text-sm">
                  {item.message}
                </div>
              </div>
            )
          }
          if (item.role === 'assistant') {
            return (
              <div key={index} className="flex justify-start mb-3">
                <div className="max-w-[75%] rounded-2xl px-4 py-2 bg-muted text-sm">
                  {item.message}
                </div>
              </div>
            )
          }
          return null
        }

        if (item.kind === 'tool') {
          const isSuccess = item.status === 'success'
          const isTimeout = item.status === 'timeout'

          return (
            <div key={index} className="flex justify-center my-2">
              <div className="inline-flex flex-col items-center gap-1 px-3 py-2 rounded-lg border bg-card text-xs max-w-[90%]">
                <div className="flex items-center gap-2">
                  {isSuccess ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isTimeout ? 'text-yellow-500' : 'text-red-500'
                      }`}
                    />
                  )}
                  <span className="font-medium">{item.toolName}</span>
                  <span className="text-muted-foreground">{item.executionMs}ms</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      isSuccess
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : isTimeout
                        ? 'bg-yellow-500/15 text-yellow-600'
                        : 'bg-red-500/15 text-red-600'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                {item.errorDetail && (
                  <p className="italic text-muted-foreground text-[11px] mt-0.5 text-center">
                    {item.errorDetail}
                  </p>
                )}
              </div>
            </div>
          )
        }

        return null
      })}
    </div>
  )
}
