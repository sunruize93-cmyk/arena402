/**
 * Production Arena AgentTasks are claimed and submitted over stateless MCP.
 * Runtime execution remains a separate explicit opt-in.
 *
 * @param {'codex' | 'claude_code' | string} runtimeKind
 * @returns {string}
 */
export function connectorTaskRunFlags(runtimeKind) {
  const runtimeOptIn = runtimeKind === 'claude_code'
    ? '--unsafe-enable-claude-tasks'
    : '--enable-codex-tasks';
  return `--task-transport mcp ${runtimeOptIn}`;
}
