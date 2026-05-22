<script lang="ts">
  import type { Message } from '$lib/api'
  import MessageItem from './MessageItem.svelte'

  interface Props {
    sessionId: string
    messages: Message[]
    onDeleteMessage: (msg: Message) => void
    onDeleteMessages?: (msgs: Message[]) => void
    onEditTitle?: (msg: Message) => void
    onSplitSession?: (msg: Message) => void
    enableScroll?: boolean
    fullWidth?: boolean
    currentMsgId?: string | null
  }

  let {
    sessionId,
    messages,
    onDeleteMessage,
    onDeleteMessages,
    onEditTitle,
    onSplitSession,
    enableScroll = true,
    fullWidth = false,
    currentMsgId = null,
  }: Props = $props()

  // Selection state
  let selectedUuids = $state<Set<string>>(new Set())

  const isSelectionMode = $derived(onDeleteMessages !== undefined)

  const handleToggleSelect = (msg: Message, selected: boolean) => {
    const id = msg.uuid || msg.messageId || msg.leafUuid
    if (!id) return

    const next = new Set(selectedUuids)
    if (selected) {
      next.add(id)
    } else {
      next.delete(id)
    }
    selectedUuids = next
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      selectedUuids = new Set(
        messages.map((m) => m.uuid || m.messageId || m.leafUuid).filter(Boolean) as string[]
      )
    } else {
      selectedUuids = new Set()
    }
  }

  const handleDeleteSelected = () => {
    if (!onDeleteMessages || selectedUuids.size === 0) return
    const msgsToDelete = messages.filter((m) => {
      const id = m.uuid || m.messageId || m.leafUuid
      return id && selectedUuids.has(id)
    })
    onDeleteMessages(msgsToDelete)
    selectedUuids = new Set()
  }

  // Clear selection if messages array changes completely
  $effect(() => {
    // Just tracking messages to trigger effect
    const _ = messages
    selectedUuids = new Set()
  })

  // Find index of first meaningful message (user/assistant, not metadata)
  const firstMeaningfulIndex = $derived(
    messages.findIndex((m) => m.type === 'user' || m.type === 'assistant' || m.type === 'human')
  )
</script>

<section
  class="bg-gh-bg-secondary overflow-hidden flex flex-col {fullWidth
    ? ''
    : 'border border-gh-border rounded-lg'}"
>
  {#if isSelectionMode}
    <div class="px-4 py-2 border-b border-gh-border flex justify-between items-center bg-gh-bg/50">
      <div class="flex items-center gap-2">
        <input
          type="checkbox"
          class="rounded border-gh-border bg-gh-bg cursor-pointer"
          checked={messages.length > 0 && selectedUuids.size === messages.length}
          indeterminate={selectedUuids.size > 0 && selectedUuids.size < messages.length}
          onchange={(e) => handleSelectAll(e.currentTarget.checked)}
        />
        <span class="text-sm text-gh-text-secondary">
          {selectedUuids.size > 0 ? `${selectedUuids.size} selected` : 'Select messages'}
        </span>
      </div>
      {#if selectedUuids.size > 0}
        <button
          class="px-3 py-1 text-sm bg-gh-red/10 text-gh-red hover:bg-gh-red/20 rounded transition-colors flex items-center gap-1"
          onclick={handleDeleteSelected}
        >
          <span>🗑️</span> Delete Selected
        </button>
      {/if}
    </div>
  {/if}

  <div class="{enableScroll ? 'overflow-y-auto' : ''} flex-1 p-4 flex flex-col gap-4">
    {#each messages as msg, i (msg.uuid ?? `idx-${i}`)}
      {@const id = msg.uuid || (msg as unknown as { messageId?: string }).messageId || msg.leafUuid}
      <MessageItem
        {msg}
        {sessionId}
        isFirst={i === 0 || i === firstMeaningfulIndex}
        selectable={isSelectionMode}
        selected={id ? selectedUuids.has(id) : false}
        onToggleSelect={handleToggleSelect}
        onDelete={onDeleteMessage}
        {onEditTitle}
        onSplit={onSplitSession}
        isActive={currentMsgId !== null && (msg.uuid ?? `idx-${i}`) === currentMsgId}
      />
    {/each}
  </div>
</section>
