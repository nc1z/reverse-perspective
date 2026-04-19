/**
 * Adapter for OpenAI Codex CLI  (`codex exec`)
 * https://github.com/openai/codex
 */
export default {
  id: 'codex',
  label: 'Codex',
  hint: 'codex exec',
  binary: 'codex',

  args() {
    return ['exec'];
  },

  /** Prompt is written to stdin */
  promptMode: 'stdin',

  /** stdout is plain text — pass through as-is */
  transformOutput(output) {
    return output.trim();
  },
};
