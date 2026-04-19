/**
 * Adapter for GitHub Copilot CLI  (`copilot -p`)
 * https://githubnext.com/projects/copilot-cli
 */
export default {
  id: 'copilot',
  label: 'Copilot',
  hint: 'copilot -p',
  binary: 'copilot',

  defaultModel: 'claude-sonnet-4-6',

  args(model) {
    return ['-p', '--model', model];
  },

  promptMode: 'stdin',

  transformOutput(output) {
    return output.trim();
  },
};
