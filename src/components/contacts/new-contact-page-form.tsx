'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { ContactForm } from './contact-form'
import { createContact } from '@/app/(dashboard)/contacts/actions'
import type { ContactFormInput } from '@/lib/contacts/zod-schemas'

interface NewContactPageFormProps {
  defaultValues?: Partial<ContactFormInput>
  returnTo?: string | null
}

export function NewContactPageForm({ defaultValues, returnTo }: NewContactPageFormProps) {
  const router = useRouter()

  return (
    <ContactForm
      defaultValues={defaultValues}
      submitLabel="Create contact"
      onCancel={() => router.push(returnTo ?? '/contacts')}
      onSubmit={async (values) => {
        const res = await createContact(values)
        if (res.error) return { error: res.error }
        if (res.existed) {
          toast.message('Linked existing contact', {
            description: 'A contact with this phone/email already existed in your CRM.',
          })
        } else {
          toast.success('Contact created')
        }
        router.push(returnTo ?? `/contacts`)
        router.refresh()
      }}
    />
  )
}
