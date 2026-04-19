/**
 * Adapter for OpenAI Codex CLI  (`codex exec`)
 * https://github.com/openai/codex
 */
export default {
  id: 'codex',
  label: 'Codex',
  hint: 'codex exec',
  binary: 'codex',

  defaultModel: 'gpt-5.4',

  args(model) {
    return ['exec', '--model', model];
  },

  promptMode: 'stdin',

  transformOutput(output) {
    return output.trim();
  },
};
