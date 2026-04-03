'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { ToolConfigWithIntegration } from '@/app/(dashboard)/tools/actions'
import type { IntegrationForDisplay } from '@/app/(dashboard)/integrations/actions'
import { createToolConfig, updateToolConfig } from '@/app/(dashboard)/tools/actions'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const toolConfigSchema = z.object({
  toolName: z
    .string()
    .min(1, 'Tool name is required')
    .max(100, 'Tool name must be 100 characters or fewer'),
  actionType: z.enum([
    'create_contact',
    'get_availability',
    'create_appointment',
    'send_sms',
    'knowledge_base',
    'custom_webhook',
  ]),
  integrationId: z.string().uuid('Please select an integration'),
  fallbackMessage: z
    .string()
    .min(1, 'Fallback message is required')
    .max(500, 'Fallback message must be 500 characters or fewer'),
})

type ToolConfigFormValues = z.infer<typeof toolConfigSchema>

const ACTION_TYPE_OPTIONS = [
  { value: 'create_contact', label: 'Create Contact' },
  { value: 'get_availability', label: 'Check Availability' },
  { value: 'create_appointment', label: 'Book Appointment' },
  { value: 'send_sms', label: 'Send SMS' },
  { value: 'knowledge_base', label: 'Knowledge Base' },
  { value: 'custom_webhook', label: 'Custom Webhook' },
] as const

interface ToolConfigFormProps {
  mode: 'create' | 'edit'
  toolConfig?: ToolConfigWithIntegration
  integrations: IntegrationForDisplay[]
  onSuccess: () => void
}

export function ToolConfigForm({ mode, toolConfig, integrations, onSuccess }: ToolConfigFormProps) {
  const [isPending, setIsPending] = useState(false)

  const form = useForm<ToolConfigFormValues>({
    resolver: zodResolver(toolConfigSchema),
    mode: 'onSubmit',
    defaultValues: {
      toolName: toolConfig?.tool_name ?? '',
      actionType: toolConfig?.action_type ?? 'create_contact',
      integrationId: toolConfig?.integration_id ?? '',
      fallbackMessage: toolConfig?.fallback_message ?? '',
    },
  })

  async function onSubmit(values: ToolConfigFormValues) {
    setIsPending(true)
    try {
      let result: { error?: string } | void = undefined

      if (mode === 'create') {
        result = await createToolConfig({
          toolName: values.toolName,
          actionType: values.actionType,
          integrationId: values.integrationId,
          fallbackMessage: values.fallbackMessage,
        })
      } else if (toolConfig) {
        result = await updateToolConfig(toolConfig.id, {
          toolName: values.toolName,
          actionType: values.actionType,
          integrationId: values.integrationId,
          fallbackMessage: values.fallbackMessage,
        })
      }

      if (result && 'error' in result && result.error) {
        if (result.error.includes('already exists')) {
          toast.error(result.error)
        } else {
          toast.error('Failed to save. Try again.')
        }
        return
      }

      toast.success('Tool configuration saved.')
      onSuccess()
    } catch {
      toast.error('Failed to save. Try again.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-xl font-semibold">
          {mode === 'create' ? 'New Tool Configuration' : 'Edit Tool Configuration'}
        </h2>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="toolName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tool Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. create_contact"
                    disabled={isPending}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Must match the tool name exactly as configured in Vapi
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="actionType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Action Type</FormLabel>
                <Select
                  disabled={isPending}
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an action type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ACTION_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="integrationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Integration</FormLabel>
                <Select
                  disabled={isPending}
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an integration" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {integrations.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No integrations available
                      </SelectItem>
                    ) : (
                      integrations.map((integration) => (
                        <SelectItem key={integration.id} value={integration.id}>
                          {integration.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fallbackMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fallback Message</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="e.g. I'm sorry, I wasn't able to complete that action right now."
                    disabled={isPending}
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Vapi speaks this if the action fails
                </FormDescription>
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
                'Add Tool'
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
              {mode === 'create' ? 'Back to Tools' : 'Discard Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
