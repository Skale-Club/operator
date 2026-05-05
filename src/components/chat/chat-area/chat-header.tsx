'use client'

import { useState } from 'react'
import { ArrowLeft, Archive, ArchiveRestore, MoreVertical, Pause, Play, Trash2 } from 'lucide-react'

import { ConversationSummary } from '@/types/chat'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ChannelIcon, channelLabel } from '@/components/chat/channel-icon'

interface ChatHeaderProps {
  conversation: ConversationSummary
  onBack: () => void
  onStatusChange: (status: 'open' | 'closed') => void
  onDelete: () => void
  onBotStatusToggle: (id: string, currentStatus: string) => void
  isBotToggling: boolean
  showDebug: boolean
  onShowDebugChange: (next: boolean) => void
}

export function ChatHeader({ conversation, onBack, onStatusChange, onDelete, onBotStatusToggle, isBotToggling, showDebug, onShowDebugChange }: ChatHeaderProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const displayName = conversation.visitorName ?? conversation.visitorEmail ?? 'Anonymous'
  const avatarInitial = displayName.charAt(0).toUpperCase()
  const isBotActive = conversation.botStatus === 'active'
  const isOpen = conversation.status === 'open'

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 shrink-0">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden shrink-0 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors rounded-full" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="relative">
          <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background shadow-sm">
            <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-indigo-500 to-purple-600 text-white">{avatarInitial}</AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full"></span>
        </div>
        <div className="flex flex-col min-w-0 justify-center gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <ChannelIcon channel={conversation.channel} className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold tracking-tight leading-tight">{channelLabel(conversation.channel)}</span>
            {conversation.channelAccountName && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-xs text-muted-foreground font-medium truncate max-w-[140px]">{conversation.channelAccountName}</span>
              </>
            )}
            <span className="text-muted-foreground text-xs">·</span>
            <Badge variant="outline" className={isBotActive ? 'text-[10px] px-1.5 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50' : 'text-[10px] px-1.5 py-0 h-4 bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700/50'}>
              {isBotActive ? 'Bot active' : 'Bot paused'}
            </Badge>
          </div>
          {displayName !== 'Anonymous' && <p className="text-xs text-muted-foreground truncate">{displayName}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 z-20 shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors rounded-full" onClick={() => onBotStatusToggle(conversation.id, conversation.botStatus)} disabled={isBotToggling} aria-label={isBotActive ? 'Pause bot' : 'Resume bot'}>
                {isBotActive ? <Pause className="h-4 w-4 text-muted-foreground" /> : <Play className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isBotActive ? 'Pause bot' : 'Resume bot'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <label className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100/80 hover:bg-neutral-200/80 dark:bg-neutral-800/80 dark:hover:bg-neutral-700/80 text-xs font-medium cursor-pointer transition-colors shadow-sm">
          <input type="checkbox" checked={showDebug} onChange={(e) => onShowDebugChange(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" />
          <span>Debug</span>
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors rounded-full focus:ring-2 focus:ring-indigo-500/20 z-20 pointer-events-auto">
              <MoreVertical className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onStatusChange(isOpen ? 'closed' : 'open')}>
              {isOpen ? <><Archive className="h-4 w-4 mr-2" />Archive conversation</> : <><ArchiveRestore className="h-4 w-4 mr-2" />Reopen conversation</>}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the conversation with <strong>{displayName}</strong> and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { setShowDeleteDialog(false); onDelete() }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
