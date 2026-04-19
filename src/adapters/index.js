/**
 * Adapter registry — add a new provider by importing it here.
 *
 * Each adapter must export a default object satisfying this shape:
 *
 *   id:              string   — unique key
 *   label:           string   — display name shown in the CLI menu
 *   hint:            string   — command hint shown alongside the label
 *   binary:          string   — executable name checked with `which`
 *   args():          string[] — spawn arguments passed to the binary
 *   promptMode:      'stdin'  — how the prompt is delivered (only stdin for now)
 *   transformOutput: (string) => string — post-process stdout before parsing
 */
import claude  from './claude.js';
import codex   from './codex.js';
import copilot from './copilot.js';

export const adapters = [claude, codex, copilot];

export { claude, codex, copilot };
