/**
 * Adapter for Claude Code CLI  (`claude --print`)
 * https://claude.ai/code
 */
export default {
  id: 'claude',
  label: 'Claude',
  hint: 'claude --print',
  binary: 'claude',

  defaultModel: 'claude-sonnet-4-6',

  args(model) {
    return ['--print', '--output-format', 'text', '--model', model];
  },

  promptMode: 'stdin',

  transformOutput(output) {
    return output.trim();
  },
};
