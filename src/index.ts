import { createPiece } from '@activepieces/pieces-framework';
import { pythonRunnerPieceMetadata } from './piece-metadata';
import { runPythonCode } from './actions/run-python-code';
import { runPythonCodeSandboxed } from './actions/run-python-code-sandboxed';

export const pythonRunner = createPiece({
  displayName: 'Python Code Runner',
  auth: pythonRunnerPieceMetadata.auth,
  minimumSupportedRelease: pythonRunnerPieceMetadata.minimumSupportedRelease,
  logoUrl: pythonRunnerPieceMetadata.logoUrl,
  authors: pythonRunnerPieceMetadata.authors,
  categories: pythonRunnerPieceMetadata.categories,
  description: pythonRunnerPieceMetadata.description,
  actions: [runPythonCode, runPythonCodeSandboxed],
  triggers: [],
}); 