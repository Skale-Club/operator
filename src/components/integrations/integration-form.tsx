'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { IntegrationForDisplay } from '@/app/(dashboard)/integrations/actions'
import { createIntegration, updateIntegration } from '@/app/(dashboard)/integrations/actions'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const integrationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  provider: z.enum(['gohighlevel', 'twilio', 'calcom', 'custom_webhook']),
  apiKey: z.string().min(1, 'API key is required'),
  locationId: z.string().min(1, 'Location ID is required'),
})

const integrationEditSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  provider: z.enum(['gohighlevel', 'twilio', 'calcom', 'custom_webhook']),
  // In edit mode apiKey is optional — only re-encrypt if provided
  apiKey: z.string(),
  locationId: z.string().min(1, 'Location ID is required'),
})

type IntegrationFormValues = {
  name: string
  provider: 'gohighlevel' | 'twilio' | 'calcom' | 'custom_webhook'
  apiKey: string
  locationId: string
}

interface IntegrationFormProps {
  mode: 'create' | 'edit'
  integration?: IntegrationForDisplay
  onSuccess: () => void
}

export function IntegrationForm({ mode, integration, onSuccess }: IntegrationFormProps) {
  const [isPending, setIsPending] = useState(false)

  const schema = mode === 'create' ? integrationSchema : integrationEditSchema

  const form = useForm<IntegrationFormValues>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    defaultValues: {
      name: integration?.name ?? '',
      provider: integration?.provider ?? 'gohighlevel',
      apiKey: '', // Never pre-fill API key for security — not even in edit mode
      locationId: integration?.location_id ?? '',
    },
  })

  async function onSubmit(values: IntegrationFormValues) {
    setIsPending(true)
    try {
      let result: { error?: string } | void = undefined

      if (mode === 'create') {
        result = await createIntegration({
          name: values.name,
          provider: values.provider,
          apiKey: values.apiKey,
          locationId: values.locationId,
        })
      } else if (integration) {
        result = await updateIntegration(integration.id, {
          name: values.name,
          locationId: values.locationId,
          // Only pass apiKey if user entered a new one
          apiKey: values.apiKey.trim().length > 0 ? values.apiKey : undefined,
        })
      }

      if (result && 'error' in result && result.error) {
        toast.error('Failed to save integration. Try again.')
        return
      }

      toast.success('Integration saved.')
      onSuccess()
    } catch {
      toast.error('Failed to save integration. Try again.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-xl font-semibold">
          {mode === 'create' ? 'New Integration' : 'Edit Integration'}
        </h2>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Alpha Home Improvements GHL"
                    disabled={isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="provider"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provider</FormLabel>
                <Select
                  disabled={isPending || mode === 'edit'}
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="gohighlevel">GoHighLevel</SelectItem>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="calcom">Cal.com</SelectItem>
                    <SelectItem value="custom_webhook">Custom Webhook</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="apiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  API Key{mode === 'edit' && ' (leave blank to keep existing)'}
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={mode === 'edit' ? '••••••••••••••••' : 'Enter API key'}
                    disabled={isPending}
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="locationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location ID</FormLabel>
                <FormControl>
                  <Input
                    placeholder="GHL Location ID"
                    disabled={isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : mode === 'create' ? (
                'Add Integration'
              ) : (
                'Save Changes'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={onSuccess}
            >
              {mode === 'create' ? 'Back to Integrations' : 'Discard Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
