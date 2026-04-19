/**
 * Adapter for GitHub Copilot CLI  (`copilot -p`)
 * https://githubnext.com/projects/copilot-cli
 */
export default {
  id: 'copilot',
  label: 'Copilot',
  hint: 'copilot -p',
  binary: 'copilot',

  models: [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (default)' },
    { id: 'claude-opus-4-6',   label: 'Claude Opus 4.6' },
    { id: 'gpt-4.1',           label: 'GPT-4.1' },
    { id: 'o3',                label: 'o3' },
  ],
  defaultModel: 'claude-sonnet-4-6',

  args(model) {
    return ['-p', '--model', model];
  },

  promptMode: 'stdin',

  transformOutput(output) {
    return output.trim();
  },
};
