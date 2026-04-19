/**
 * Adapter for Claude Code CLI  (`claude --print`)
 * https://claude.ai/code
 */
export default {
  id: 'claude',
  label: 'Claude',
  hint: 'claude --print',
  binary: 'claude',

  models: [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (default)' },
    { id: 'claude-opus-4-6',   label: 'Claude Opus 4.6' },
    { id: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5' },
  ],
  defaultModel: 'claude-sonnet-4-6',

  args(model) {
    return ['--print', '--output-format', 'text', '--model', model];
  },

  promptMode: 'stdin',

  transformOutput(output) {
    return output.trim();
  },
};
