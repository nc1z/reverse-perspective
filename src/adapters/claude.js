/**
 * Adapter for Claude Code CLI  (`claude --print`)
 * https://claude.ai/code
 */
export default {
  id: 'claude',
  label: 'Claude',
  hint: 'claude --print',
  binary: 'claude',

  args() {
    return ['--print', '--output-format', 'text'];
  },

  /** Prompt is written to stdin */
  promptMode: 'stdin',

  /** stdout is plain text — pass through as-is */
  transformOutput(output) {
    return output.trim();
  },
};
