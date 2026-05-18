'use client'

import * as React from 'react'
import { Building2, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { getAccounts, createAccount } from '@/app/(dashboard)/accounts/actions'
import type { AccountWithCounts } from '@/lib/accounts'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AccountComboboxProps {
  value: string | null        // selected account_id (uuid) or null
  onChange: (accountId: string | null, accountName: string | null) => void
  defaultAccountName?: string // shown before async lookup resolves; optional
}

export function AccountCombobox({
  value,
  onChange,
  defaultAccountName,
}: AccountComboboxProps) {
  const [inputValue, setInputValue] = React.useState<string>(defaultAccountName ?? '')
  const [results, setResults] = React.useState<AccountWithCounts[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)
  const [showCreate, setShowCreate] = React.useState(false)
  const [createName, setCreateName] = React.useState('')
  const [isCreating, setIsCreating] = React.useState(false)

  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync inputValue when value prop is cleared externally
  React.useEffect(() => {
    if (value === null && !defaultAccountName) {
      setInputValue('')
    }
  }, [value, defaultAccountName])

  // Click-outside to close
  React.useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowCreate(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Debounced search
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!inputValue) {
      setResults([])
      setIsLoading(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await getAccounts({ q: inputValue, pageSize: 20 })
        if (res.ok) {
          setResults(res.data.rows as AccountWithCounts[])
        } else {
          setResults([])
        }
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [inputValue])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)
    setIsOpen(true)
    setShowCreate(false)
    if (!val) {
      onChange(null, null)
    }
  }

  function handleSelect(id: string, name: string) {
    onChange(id, name)
    setInputValue(name)
    setIsOpen(false)
    setShowCreate(false)
  }

  async function handleCreate() {
    if (!createName.trim()) return
    setIsCreating(true)
    try {
      const res = await createAccount({ name: createName.trim() })
      if (res.ok) {
        onChange(res.data.id, res.data.name)
        setInputValue(res.data.name)
        setIsOpen(false)
        setShowCreate(false)
        setCreateName('')
        toast.success('Company created')
      } else {
        toast.error('Failed to create company')
      }
    } catch {
      toast.error('Failed to create company')
    } finally {
      setIsCreating(false)
    }
  }

  const showDropdown = isOpen && (inputValue.length > 0 || showCreate)

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => { if (inputValue) setIsOpen(true) }}
        placeholder="Search or create company…"
        className="h-10 text-[13.5px]"
        autoComplete="off"
      />

      {showDropdown && !showCreate && (
        <div className="absolute z-50 w-full mt-1 rounded-[10px] border border-border bg-bg-secondary shadow-lg max-h-[200px] overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-text-tertiary" />
            </div>
          )}

          {!isLoading && results.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => handleSelect(account.id, account.name)}
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-bg-tertiary flex items-center gap-2"
            >
              <Building2 className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
              <span className="font-medium text-text-primary truncate">{account.name}</span>
              {account.domain && (
                <span className="ml-auto text-[11.5px] text-text-tertiary shrink-0">{account.domain}</span>
              )}
            </button>
          ))}

          {!isLoading && results.length === 0 && inputValue.length > 0 && (
            <div className="px-3 py-2 text-[12.5px] text-text-tertiary">
              No companies found
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setCreateName(inputValue)
              setShowCreate(true)
            }}
            className={cn(
              'w-full text-left px-3 py-2 text-[12.5px] text-accent hover:bg-accent/10 flex items-center gap-2',
              results.length > 0 && 'border-t border-border',
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Create new company &quot;{inputValue || '…'}&quot;
          </button>
        </div>
      )}

      {showDropdown && showCreate && (
        <div className="absolute z-50 w-full mt-1 rounded-[10px] border border-border bg-bg-secondary shadow-lg p-3 space-y-2">
          <p className="text-[12px] font-medium text-text-primary">New company</p>
          <Input
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Company name"
            autoFocus
            className="h-9 text-[13px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreate()
              }
            }}
          />
          <div className="flex items-center gap-2 justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!createName.trim() || isCreating}
              onClick={handleCreate}
            >
              {isCreating ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
