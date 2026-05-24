<script lang="ts">
  interface Props {
    content: string
    maxLines?: number
    lang?: string // syntax highlighting language (e.g., 'json', 'typescript', 'bash')
  }

  let { content, maxLines = 10, lang }: Props = $props()

  let expanded = $state(false)
  let isHovering = $state(false)
  let copied = $state(false)

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(content)
    copied = true
    setTimeout(() => (copied = false), 2000)
  }

  const lines = $derived(content.split('\n'))
  const needsExpand = $derived(lines.length > maxLines)
  const displayContent = $derived(
    needsExpand && !expanded ? lines.slice(0, maxLines).join('\n') : content
  )
</script>

<div
  class="relative group"
  onmouseenter={() => (isHovering = true)}
  onmouseleave={() => (isHovering = false)}
>
  <button
    class="absolute top-1 right-1 px-2 py-0.5 text-xs bg-gh-border hover:bg-gh-border-muted rounded transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer border-none text-gh-text-secondary"
    onclick={copyToClipboard}
    title="Copy to clipboard"
  >
    {copied ? 'Copied' : 'Copy'}
  </button>

  {#if needsExpand}
    {#if lang}
      <pre
        class="{lang === 'json' ? 'whitespace-pre' : 'whitespace-pre-wrap'} font-mono text-xs text-gh-text-secondary overflow-x-auto {lang === 'json' ? '' : 'max-h-96 overflow-y-auto'}"><code
          class="language-{lang}">{displayContent}</code
        ></pre>
    {:else}
      <pre
        class="whitespace-pre-wrap font-mono text-xs text-gh-text-secondary overflow-x-auto max-h-96 overflow-y-auto">{displayContent}</pre>
    {/if}
    {#if !expanded}
      <div
        class="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gh-canvas to-transparent pointer-events-none"
      ></div>
      {#if isHovering}
        <button
          class="absolute bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 text-xs bg-gh-border hover:bg-gh-border-muted rounded-full cursor-pointer border-none text-gh-text-secondary transition-all"
          onclick={() => (expanded = true)}
        >
          Click to expand ({lines.length - maxLines} more lines)
        </button>
      {/if}
    {:else}
      <button
        class="mt-2 px-3 py-1 text-xs bg-gh-border hover:bg-gh-border-muted rounded-full cursor-pointer border-none text-gh-text-secondary"
        onclick={() => (expanded = false)}
      >
        Collapse
      </button>
    {/if}
  {:else if lang}
    <pre
      class="{lang === 'json' ? 'whitespace-pre' : 'whitespace-pre-wrap'} font-mono text-xs text-gh-text-secondary overflow-x-auto {lang === 'json' ? '' : 'max-h-96 overflow-y-auto'}"><code
        class="language-{lang}">{content}</code
      ></pre>
  {:else}
    <pre
      class="whitespace-pre-wrap font-mono text-xs text-gh-text-secondary overflow-x-auto max-h-96 overflow-y-auto">{content}</pre>
  {/if}
</div>
