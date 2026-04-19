/**
 * Adapter for OpenAI Codex CLI  (`codex exec`)
 * https://github.com/openai/codex
 */
export default {
  id: 'codex',
  label: 'Codex',
  hint: 'codex exec',
  binary: 'codex',

  models: [
    { id: 'gpt-4.5',   label: 'GPT-4.5 (default)' },
    { id: 'o4-mini',   label: 'o4-mini' },
    { id: 'o3',        label: 'o3' },
    { id: 'gpt-4.1',   label: 'GPT-4.1' },
  ],
  defaultModel: 'gpt-4.5',

  args(model) {
    return ['exec', '--model', model];
  },

  promptMode: 'stdin',

  transformOutput(output) {
    return output.trim();
  },
};
