/**
 * Adapter for GitHub Copilot CLI  (`copilot -p`)
 * https://githubnext.com/projects/copilot-cli
 */
export default {
  id: 'copilot',
  label: 'Copilot',
  hint: 'copilot -p',
  binary: 'copilot',

  args() {
    return ['-p'];
  },

  /** Prompt is written to stdin */
  promptMode: 'stdin',

  /** stdout is plain text — pass through as-is */
  transformOutput(output) {
    return output.trim();
  },
};
