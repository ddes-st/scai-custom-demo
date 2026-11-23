/**
 * Side-effect import for unit tests that assert mutating TSX/definition fixups.
 * Codegen defaults to prompt-first (no mutations); restore the mutating path.
 *
 * Do **not** import this from prompt-first tests.
 */
import { setCodegenV2Fixups } from './ai-source-fixup.mjs';

setCodegenV2Fixups(true);
