<script lang="ts">
  import type { Project, SessionMeta, SessionData } from '$lib/api'
  import { formatProjectName } from '$lib/utils'
  import {
    sortProjects,
    getDisplayTitle as coreGetDisplayTitle,
    getSessionTooltip,
    getTotalTodoCount,
    sessionHasSubItems,
    canMoveSession,
    TREE_ICONS,
    type SessionSortField,
    type SessionSortOrder,
    type TitleDisplayMode,
  } from '@claude-sessions/core'
  import { appConfig } from '$lib/stores/config'
  import DropdownMenu from './DropdownMenu.svelte'
  import FloatingTooltip from './FloatingTooltip.svelte'
  import CommandTitle from './CommandTitle.svelte'

  interface Props {
    projects: Project[]
    projectSessions: Map<string, SessionMeta[]>
    projectSessionData: Map<string, Map<string, SessionData>>
    expandedProjects: Set<string>
    selectedSession: SessionMeta | null
    loadingProject: string | null
    sortField: SessionSortField
    sortOrder: SessionSortOrder
    titleDisplayMode: TitleDisplayMode
    onToggleProject: (name: string) => void
    onSelectSession: (session: SessionMeta) => void
    onCompressSession?: (e: Event, session: SessionMeta) => void
    onDeleteSession: (e: Event, session: SessionMeta) => void
    onDeleteMultipleSessions?: (sessions: { id: string; projectName: string }[]) => void
    onMoveSession?: (session: SessionMeta, targetProject: string) => void
    onRenameSession: (e: Event, session: SessionMeta) => void
    onResumeSession?: (e: Event, session: SessionMeta) => void
    onSortChange?: (field: SessionSortField, order: SessionSortOrder) => void
    onTitleModeChange?: (mode: TitleDisplayMode) => void
  }

  let {
    projects,
    projectSessions,
    projectSessionData,
    expandedProjects,
    selectedSession,
    loadingProject,
    sortField,
    sortOrder,
    titleDisplayMode,
    onToggleProject,
    onSelectSession,
    onCompressSession,
    onDeleteSession,
    onDeleteMultipleSessions,
    onMoveSession,
    onRenameSession,
    onResumeSession,
    onSortChange,
    onTitleModeChange,
  }: Props = $props()

  // Bulk selection state (id -> projectName)
  let bulkSelectedSessions = $state<Map<string, string>>(new Map())
  let lastClickedSession = $state<{ id: string; projectName: string } | null>(null)

  const toggleBulkSelection = (session: SessionMeta, selected: boolean) => {
    const next = new Map(bulkSelectedSessions)
    if (selected) {
      next.set(session.id, session.projectName)
    } else {
      next.delete(session.id)
    }
    bulkSelectedSessions = next
  }

  const handleSessionClick = (e: MouseEvent, session: SessionMeta) => {
    const isMultiSelect = e.metaKey || e.ctrlKey
    const isRangeSelect = e.shiftKey

    if (isMultiSelect) {
      e.preventDefault()
      const currentlySelected = bulkSelectedSessions.has(session.id)
      toggleBulkSelection(session, !currentlySelected)
      lastClickedSession = { id: session.id, projectName: session.projectName }
      return
    }

    if (
      isRangeSelect &&
      lastClickedSession &&
      lastClickedSession.projectName === session.projectName
    ) {
      e.preventDefault()
      const sessions = projectSessions.get(session.projectName) ?? []
      const startIndex = sessions.findIndex((s) => s.id === lastClickedSession!.id)
      const endIndex = sessions.findIndex((s) => s.id === session.id)

      if (startIndex !== -1 && endIndex !== -1) {
        const minIdx = Math.min(startIndex, endIndex)
        const maxIdx = Math.max(startIndex, endIndex)
        const next = new Map(bulkSelectedSessions)
        for (let i = minIdx; i <= maxIdx; i++) {
          next.set(sessions[i].id, sessions[i].projectName)
        }
        bulkSelectedSessions = next
      }
      return
    }

    // Normal click without modifiers
    // We intentionally do NOT clear bulkSelectedSessions here
    // so the user can navigate between sessions while keeping their selection active.
    lastClickedSession = { id: session.id, projectName: session.projectName }
    onSelectSession(session)
  }

  const handleDeleteSelected = () => {
    if (!onDeleteMultipleSessions || bulkSelectedSessions.size === 0) return
    const sessions = Array.from(bulkSelectedSessions.entries()).map(([id, projectName]) => ({
      id,
      projectName,
    }))
    onDeleteMultipleSessions(sessions)
    // Clear selection after deletion starts
    bulkSelectedSessions = new Map()
  }

  // Sort field labels for display
  const sortFieldLabels: Record<SessionSortField, string> = {
    summary: 'Summary Time',
    modified: 'Modified',
    created: 'Created',
    updated: 'Last Message',
    messageCount: 'Messages',
    title: 'Title',
  }

  const handleSortFieldChange = (e: Event) => {
    const target = e.target as HTMLSelectElement
    onSortChange?.(target.value as SessionSortField, sortOrder)
  }

  const toggleSortOrder = () => {
    onSortChange?.(sortField, sortOrder === 'asc' ? 'desc' : 'asc')
  }

  // Get session data with summary info
  const getSessionData = (projectName: string, sessionId: string): SessionData | undefined => {
    return projectSessionData.get(projectName)?.get(sessionId)
  }

  // Get display title using core utility
  const getDisplayTitle = (session: SessionMeta): string => {
    const data = getSessionData(session.projectName, session.id)
    return coreGetDisplayTitle({
      agentName: data?.agentName,
      customTitle: data?.customTitle,
      currentSummary: data?.currentSummary,
      title: session.title,
      createdAt: session.createdAt,
      mode: titleDisplayMode,
    })
  }

  // Check if session has agents or todos (using core utilities)
  const getSessionInfo = (
    session: SessionMeta
  ): { agents: number; todos: number; summaries: number } => {
    const data = getSessionData(session.projectName, session.id)
    const todoCount = data?.todos ? getTotalTodoCount(data.todos) : 0
    return {
      agents: data?.agents.length ?? 0,
      todos: todoCount,
      summaries: data?.summaries.length ?? 0,
    }
  }

  // Check if session has sub-items (using core utility)
  const hasSessionSubItems = (session: SessionMeta): boolean => {
    const data = getSessionData(session.projectName, session.id)
    if (!data) return false
    return sessionHasSubItems(data)
  }

  // Tooltip cache - invalidated when projectSessionData changes
  const tooltipCache = new Map<string, string>()
  $effect(() => {
    // Clear cache when session data changes
    void projectSessionData.size
    tooltipCache.clear()
  })

  // Get cached tooltip text
  const getCachedTooltip = (session: SessionMeta): string => {
    const key = `${session.projectName}:${session.id}`
    let tooltip = tooltipCache.get(key)
    if (!tooltip) {
      const data = getSessionData(session.projectName, session.id)
      tooltip = getSessionTooltip({
        id: session.id,
        title: session.title,
        customTitle: data?.customTitle,
        currentSummary: data?.currentSummary,
        createdAt: data?.createdAt,
        updatedAt: data?.updatedAt,
      })
      tooltipCache.set(key, tooltip)
    }
    return tooltip
  }

  // Sort projects: current project first, then user's home paths, then others
  const sortedProjects = $derived(
    sortProjects(projects, {
      currentProjectName: $appConfig.currentProjectName,
      homeDir: $appConfig.homeDir,
    })
  )

  // Expanded sessions state (for showing summaries, todos, agents sublist)
  // Auto-expand selected session
  let expandedSessions = $state<Set<string>>(
    selectedSession ? new Set([selectedSession.id]) : new Set()
  )

  const toggleSessionExpand = (e: Event, sessionId: string) => {
    e.stopPropagation()
    if (expandedSessions.has(sessionId)) {
      expandedSessions.delete(sessionId)
    } else {
      expandedSessions.add(sessionId)
    }
    expandedSessions = new Set(expandedSessions)
  }

  // Drag and drop state
  let draggedSession = $state<SessionMeta | null>(null)
  let dropTargetProject = $state<string | null>(null)

  const handleDragStart = (e: DragEvent, session: SessionMeta) => {
    if (!e.dataTransfer) return
    draggedSession = session
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({ id: session.id, project: session.projectName })
    )
  }

  const handleDragEnd = () => {
    draggedSession = null
    dropTargetProject = null
  }

  const handleDragOver = (e: DragEvent, projectName: string) => {
    if (!draggedSession || !canMoveSession(draggedSession.projectName, projectName)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    dropTargetProject = projectName
  }

  const handleDragLeave = () => {
    dropTargetProject = null
  }

  const handleDrop = (e: DragEvent, targetProject: string) => {
    e.preventDefault()
    dropTargetProject = null
    if (!draggedSession || !canMoveSession(draggedSession.projectName, targetProject)) return
    onMoveSession?.(draggedSession, targetProject)
    draggedSession = null
  }
</script>

{#snippet resumeIcon()}
  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
    />
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
{/snippet}
{#snippet renameIcon()}
  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
    />
  </svg>
{/snippet}
{#snippet compressIcon()}
  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
    />
  </svg>
{/snippet}
{#snippet deleteIcon()}
  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
{/snippet}

<aside class="bg-gh-bg-secondary border border-gh-border rounded-lg overflow-hidden flex flex-col">
  <div class="p-4 border-b border-gh-border bg-gh-bg">
    <div class="flex justify-between items-center mb-2">
      <h2 class="text-base font-semibold">
        Projects ({sortedProjects.length})
      </h2>
      {#if bulkSelectedSessions.size > 0}
        <div class="flex items-center gap-1 bg-gh-border-subtle/30 px-2 py-1 rounded-md">
          <span class="text-xs text-gh-text-secondary mr-1"
            >{bulkSelectedSessions.size} selected</span
          >
          <button
            class="p-1 text-xs text-gh-text-secondary hover:text-gh-text hover:bg-gh-border-subtle rounded transition-colors flex items-center justify-center"
            title="Cancel selection"
            aria-label="Cancel selection"
            onclick={() => (bulkSelectedSessions = new Map())}
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
          <button
            class="p-1 text-xs text-gh-red hover:text-white hover:bg-gh-red rounded transition-colors flex items-center justify-center"
            title="Delete selected sessions"
            aria-label="Delete selected sessions"
            onclick={handleDeleteSelected}
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </button>
        </div>
      {/if}
    </div>
    <!-- Sort Options -->
    <div class="flex items-center gap-2 text-sm flex-nowrap">
      <span class="text-gh-text-secondary mr-1">Session Sort:</span>
      <select
        class="bg-gh-bg-secondary border border-gh-border rounded px-2 py-1 text-sm text-gh-text cursor-pointer hover:border-gh-accent focus:border-gh-accent focus:outline-none"
        value={sortField}
        onchange={handleSortFieldChange}
      >
        {#each Object.entries(sortFieldLabels) as [value, label]}
          <option {value}>{label}</option>
        {/each}
      </select>
      <button
        class="bg-gh-bg-secondary border border-gh-border rounded px-2 py-1 text-sm cursor-pointer hover:border-gh-accent hover:bg-gh-border-subtle"
        onclick={toggleSortOrder}
        title={sortOrder === 'desc' ? 'Descending (newest first)' : 'Ascending (oldest first)'}
      >
        {sortOrder === 'desc' ? '↓' : '↑'}
      </button>
      <span class="border-l border-gh-border h-4"></span>
      <button
        class="bg-gh-bg-secondary border border-gh-border rounded px-2 py-1 text-sm cursor-pointer hover:border-gh-accent hover:bg-gh-border-subtle {titleDisplayMode ===
        'datetime'
          ? 'border-gh-accent text-gh-accent'
          : ''}"
        onclick={() => onTitleModeChange?.(titleDisplayMode === 'message' ? 'datetime' : 'message')}
        aria-label={titleDisplayMode === 'message'
          ? 'Showing first message — click for date/time'
          : 'Showing date/time — click for first message'}
        title={titleDisplayMode === 'message'
          ? 'Showing first message — click for date/time'
          : 'Showing date/time — click for first message'}
      >
        {titleDisplayMode === 'datetime' ? '🕐' : 'Aa'}
      </button>
    </div>
  </div>

  <ul class="overflow-y-auto flex-1">
    {#each sortedProjects as project}
      {@const isDropTarget = dropTargetProject === project.name}
      <li class="border-b border-gh-border-subtle">
        <!-- Project Header -->
        <button
          class="w-full py-3 px-4 bg-transparent border-none text-gh-text cursor-pointer text-left flex items-center gap-2 font-medium hover:bg-gh-border-subtle {expandedProjects.has(
            project.name
          )
            ? 'bg-gh-accent/10'
            : ''} {isDropTarget ? 'bg-gh-green/20 ring-2 ring-gh-green ring-inset' : ''}"
          onclick={() => onToggleProject(project.name)}
          ondragover={(e) => handleDragOver(e, project.name)}
          ondragleave={handleDragLeave}
          ondrop={(e) => handleDrop(e, project.name)}
        >
          <span class="text-xs w-3 text-gh-text-secondary">
            {expandedProjects.has(project.name) ? '▼' : '▶'}
          </span>
          <span
            class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
            title={project.displayName}
          >
            {formatProjectName(project.displayName)}
          </span>
          <span class="bg-gh-border px-2 py-0.5 rounded-full text-xs font-normal">
            {project.sessionCount}
          </span>
        </button>

        <!-- Sessions List -->
        {#if expandedProjects.has(project.name)}
          <ul class="bg-gh-bg">
            {#if loadingProject === project.name}
              <li class="py-2 px-8 text-gh-text-secondary text-sm">Loading...</li>
            {:else}
              {#each projectSessions.get(project.name) ?? [] as session (session.id)}
                {@const isSelected = selectedSession?.id === session.id}
                {@const isDragging = draggedSession?.id === session.id}
                {@const sessionInfo = getSessionInfo(session)}
                {@const displayTitle = getDisplayTitle(session)}
                {@const data = getSessionData(session.projectName, session.id)}
                {@const isSummaryFallback = !data?.customTitle && !data?.currentSummary}
                {@const isExpanded = expandedSessions.has(session.id)}
                {@const hasSubItems = hasSessionSubItems(session)}
                {@const items = [
                  ...(onResumeSession
                    ? [
                        {
                          label: 'Resume',
                          icon: resumeIcon,
                          onClick: () => {
                            const ev = new MouseEvent('click')
                            ev.stopPropagation = () => {}
                            onResumeSession(ev, session)
                          },
                        },
                      ]
                    : []),
                  {
                    label: 'Rename',
                    icon: renameIcon,
                    onClick: () => {
                      const ev = new MouseEvent('click')
                      ev.stopPropagation = () => {}
                      onRenameSession(ev, session)
                    },
                  },
                  ...(onCompressSession
                    ? [
                        {
                          label: 'Compress',
                          icon: compressIcon,
                          onClick: () => {
                            const ev = new MouseEvent('click')
                            ev.stopPropagation = () => {}
                            onCompressSession(ev, session)
                          },
                        },
                      ]
                    : []),
                  {
                    label: 'Delete',
                    icon: deleteIcon,
                    onClick: () => {
                      const ev = new MouseEvent('click')
                      ev.stopPropagation = () => {}
                      onDeleteSession(ev, session)
                    },
                    variant: 'danger' as const,
                  },
                ]}
                <li
                  class="relative border-t border-gh-border-subtle group select-none {isSelected
                    ? 'bg-gh-accent/20 border-l-3 border-l-gh-accent'
                    : ''} {bulkSelectedSessions.has(session.id) ? 'bg-red-500/10' : ''} {isDragging
                    ? 'opacity-50'
                    : ''}"
                  draggable="true"
                  ondragstart={(e) => handleDragStart(e, session)}
                  ondragend={handleDragEnd}
                >
                  <!-- Session Row -->
                  <div class="flex items-center">
                    {#if hasSubItems}
                      <button
                        class="flex-shrink-0 w-5 h-8 flex items-center justify-center bg-transparent border-none cursor-pointer text-gh-text-secondary text-xs ml-1 z-10 relative"
                        onclick={(e) => toggleSessionExpand(e, session.id)}
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    {:else}
                      <span class="w-5 ml-1"></span>
                    {/if}
                    <FloatingTooltip
                      content={getCachedTooltip(session)}
                      class="flex-1 min-w-0 flex"
                    >
                      <button
                        class="w-full py-2 pr-2 bg-transparent border-none text-gh-text cursor-pointer text-left flex items-center gap-2 text-sm"
                        onclick={(e) => handleSessionClick(e, session)}
                      >
                        <span
                          class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap {isSummaryFallback
                            ? 'italic text-gh-text-secondary'
                            : ''}"
                        >
                          <CommandTitle title={displayTitle} />
                        </span>
                        <span
                          class="flex-shrink-0 flex items-center gap-2 text-xs text-gh-text-secondary"
                        >
                          <span class="flex items-center gap-0.5">
                            <span>{TREE_ICONS.session.emoji}</span><span
                              >{session.messageCount}</span
                            >
                          </span>
                          {#if sessionInfo.agents > 0}
                            <span class="flex items-center gap-0.5">
                              <span>{TREE_ICONS.agent.emoji}</span><span>{sessionInfo.agents}</span>
                            </span>
                          {/if}
                          {#if sessionInfo.todos > 0}
                            <span class="flex items-center gap-0.5">
                              <span>{TREE_ICONS['todos-group'].emoji}</span><span
                                >{sessionInfo.todos}</span
                              >
                            </span>
                          {/if}
                        </span>
                      </button>
                    </FloatingTooltip>

                    <!-- Action dropdown (always visible trigger) -->
                    <div class="flex items-center pr-1">
                      <DropdownMenu {items} ariaLabel="Session actions">
                        <svg
                          class="w-4 h-4 text-gh-text-secondary hover:text-gh-text transition-colors"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                          />
                        </svg>
                      </DropdownMenu>
                    </div>
                  </div>

                  <!-- Session Sub Items (Summaries, Todos, Agents) -->
                  {#if isExpanded && hasSubItems}
                    <ul class="bg-gh-bg-secondary/50 border-t border-gh-border-subtle text-xs">
                      <!-- Summaries (oldest first, current summary at index 0) -->
                      {#if data?.summaries && data.summaries.length > 0}
                        {#each data.summaries as summary, idx}
                          <li
                            class="py-1.5 px-4 pl-8 hover:bg-gh-border-subtle/50 flex flex-col gap-0.5 {idx ===
                            0
                              ? 'text-gh-text'
                              : 'text-gh-text-secondary'}"
                            title={summary.summary}
                          >
                            <div class="flex items-start gap-2">
                              <span class="flex-shrink-0">{TREE_ICONS.summary.emoji}</span>
                              <span class="overflow-hidden text-ellipsis line-clamp-2">
                                {summary.summary.length > 100
                                  ? summary.summary.slice(0, 97) + '...'
                                  : summary.summary}
                              </span>
                            </div>
                            {#if summary.timestamp}
                              <span class="pl-6 text-[10px] text-gh-text-secondary/70">
                                {new Date(summary.timestamp).toLocaleString()}
                              </span>
                            {/if}
                          </li>
                        {/each}
                      {/if}
                      <!-- Todos -->
                      {#if data?.todos?.sessionTodos && data.todos.sessionTodos.length > 0}
                        <li
                          class="py-1.5 px-4 pl-8 text-gh-text-secondary hover:bg-gh-border-subtle/50 flex items-start gap-2"
                        >
                          <span class="flex-shrink-0">{TREE_ICONS['todos-group'].emoji}</span>
                          <span>Session Todos ({data.todos.sessionTodos.length})</span>
                        </li>
                      {/if}
                      {#if data?.todos?.agentTodos}
                        {#each data.todos.agentTodos as agentTodo}
                          <li
                            class="py-1.5 px-4 pl-8 text-gh-text-secondary hover:bg-gh-border-subtle/50 flex items-start gap-2"
                          >
                            <span class="flex-shrink-0">{TREE_ICONS['todos-group'].emoji}</span>
                            <span>Agent Todos ({agentTodo.todos.length})</span>
                          </li>
                        {/each}
                      {/if}
                      <!-- Agents -->
                      {#if data?.agents && data.agents.length > 0}
                        {#each data.agents as agent}
                          <li
                            class="py-1.5 px-4 pl-8 text-gh-text-secondary hover:bg-gh-border-subtle/50 flex items-start gap-2"
                            title={agent.name ?? agent.id}
                          >
                            <span class="flex-shrink-0">{TREE_ICONS.agent.emoji}</span>
                            <span class="overflow-hidden text-ellipsis whitespace-nowrap">
                              {agent.name ?? agent.id.slice(0, 12) + '...'} ({agent.messageCount} msgs)
                            </span>
                          </li>
                        {/each}
                      {/if}
                    </ul>
                  {/if}
                </li>
              {/each}
            {/if}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>
</aside>
