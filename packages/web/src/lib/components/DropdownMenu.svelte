<script lang="ts">
  import type { Snippet } from 'svelte'

  interface DropdownItem {
    label: string
    icon: Snippet
    onClick: () => void
    variant?: 'default' | 'danger'
    disabled?: boolean
  }

  interface Props {
    items: DropdownItem[]
    children: Snippet
    align?: 'left' | 'right'
    ariaLabel?: string
  }

  let { items, children, align = 'right', ariaLabel = 'Actions menu' }: Props = $props()

  let open = $state(false)
  let wrapperRef = $state<HTMLDivElement | null>(null)
  let focusedIndex = $state(-1)

  const toggle = () => {
    open = !open
    if (open) focusedIndex = 0
  }

  const close = () => {
    open = false
    focusedIndex = -1
  }

  const handleClickOutside = (event: MouseEvent) => {
    if (wrapperRef && !wrapperRef.contains(event.target as Node)) {
      close()
    }
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (!open) return
    switch (event.key) {
      case 'Escape':
        close()
        ;(wrapperRef?.querySelector('.trigger-btn') as HTMLElement)?.focus()
        event.preventDefault()
        break
      case 'ArrowDown':
        focusedIndex = (focusedIndex + 1) % items.length
        event.preventDefault()
        break
      case 'ArrowUp':
        focusedIndex = (focusedIndex - 1 + items.length) % items.length
        event.preventDefault()
        break
      case 'Enter':
      case ' ':
        if (focusedIndex >= 0) {
          const item = items[focusedIndex]
          if (!item.disabled) {
            item.onClick()
            close()
          }
        }
        event.preventDefault()
        break
    }
  }

  $effect(() => {
    if (open && focusedIndex >= 0) {
      const itemEls = wrapperRef?.querySelectorAll('[role="menuitem"]')
      ;(itemEls?.[focusedIndex] as HTMLElement)?.focus()
    }
  })

  $effect(() => {
    if (open) {
      document.addEventListener('click', handleClickOutside, true)
      return () => document.removeEventListener('click', handleClickOutside, true)
    }
  })
</script>

<div class="dropdown-wrapper" bind:this={wrapperRef}>
  <button
    type="button"
    class="trigger-btn"
    onclick={toggle}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={ariaLabel}
  >
    {@render children()}
  </button>

  {#if open}
    <div
      class="dropdown-menu {align === 'right' ? 'dropdown-right' : 'dropdown-left'}"
      role="menu"
      aria-label={ariaLabel}
      tabindex="-1"
      onkeydown={handleKeydown}
    >
      {#each items as item, i}
        <button
          type="button"
          class="dropdown-item"
          class:focused={i === focusedIndex}
          class:disabled={item.disabled}
          class:variant-danger={item.variant === 'danger'}
          role="menuitem"
          tabindex={i === focusedIndex ? 0 : -1}
          disabled={item.disabled}
          onclick={() => {
            if (!item.disabled) {
              item.onClick()
              close()
            }
          }}
        >
          <span class="dropdown-icon">{@render item.icon()}</span>
          <span>{item.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dropdown-wrapper {
    position: relative;
  }
  .trigger-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    color: inherit;
  }
  .dropdown-menu {
    position: absolute;
    top: calc(100% + 0.25rem);
    min-width: 9rem;
    border-radius: 0.5rem;
    background-color: #1c2128;
    border: 1px solid #30363d;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    z-index: 50;
    overflow: hidden;
    padding: 0.25rem;
  }
  .dropdown-right {
    right: 0;
  }
  .dropdown-left {
    left: 0;
  }
  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.375rem 0.5rem;
    font-size: 0.8125rem;
    color: #c9d1d9;
    background: none;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    transition: background-color 100ms;
  }
  .dropdown-item:hover,
  .dropdown-item.focused {
    background-color: #30363d;
  }
  .dropdown-item:focus {
    outline: none;
    background-color: #30363d;
  }
  .dropdown-item.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .dropdown-item.variant-danger:hover,
  .dropdown-item.variant-danger.focused {
    background-color: #da3633;
    color: #ffffff;
  }
  .dropdown-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }
</style>
