import { PieceAuth, Property } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';

export const pythonRunnerAuth = PieceAuth.None();

export const pythonRunnerPieceMetadata = {
  displayName: 'Python Code Runner',
  description: 'Execute Python code with support for imports and external libraries',
  minimumSupportedRelease: '0.20.0',
  logoUrl: 'https://cdn.activepieces.com/pieces/python-runner.png',
  categories: [PieceCategory.DEVELOPER_TOOLS],
  authors: ['Your Name'],
  auth: pythonRunnerAuth,
}; 