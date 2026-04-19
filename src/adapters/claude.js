/**
 * Adapter for Claude Code CLI  (`claude -p`)
 * https://claude.ai/code
 */
export default {
  id: 'claude',
  label: 'Claude',
  hint: 'claude -p',
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
