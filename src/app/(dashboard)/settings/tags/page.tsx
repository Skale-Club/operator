import { Tag } from 'lucide-react'

import { PageContainer, PageHeader } from '@/components/layout/page-header'
import { TagsManager } from '@/components/tags/tags-manager'
import { listTags } from './actions'

export default async function TagsSettingsPage() {
  const tags = await listTags()

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Settings"
        eyebrowIcon={Tag}
        title="Tags"
        description="Manage the tags used across contacts and deals. Tags can have custom colors for easy visual identification."
      />
      <TagsManager initialTags={tags} />
    </PageContainer>
  )
}
