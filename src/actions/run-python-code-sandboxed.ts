import { createAction, Property, ActionContext } from '@activepieces/pieces-framework';
import Docker from 'dockerode';

export const runPythonCodeSandboxed = createAction({
  name: 'run-python-code-sandboxed',
  displayName: 'Run Python Code (Sandboxed)',
  description: 'Execute Python code in a Docker container for enhanced security. Requires Docker socket access (mount with -v /var/run/docker.sock:/var/run/docker.sock)',
  props: {
    code: Property.LongText({
      displayName: 'Python Code',
      description: 'The Python code to execute',
      required: true,
    }),
    requirements: Property.LongText({
      displayName: 'Requirements',
      description: 'Python packages to install (one per line)',
      required: false,
    }),
    timeout: Property.Number({
      displayName: 'Timeout (seconds)',
      description: 'Maximum execution time in seconds',
      required: false,
      defaultValue: 30,
    }),
  },
  async run(context: ActionContext) {
    const { code, requirements, timeout, pythonVersion } = context.propsValue;
    const docker = new Docker();
    
    // Create Dockerfile content
    const dockerfileContent = `
FROM python:3.11-slim
WORKDIR /app
${requirements ? `RUN pip install --no-cache-dir ${requirements.split('\n').join(' ')}` : ''}
COPY script.py .
CMD ["python", "script.py"]
`;
    
    try {
      // Create container with the code
      const container = await docker.createContainer({
        Image: 'python:3.11-slim',
        Cmd: ['python', '-c', code],
        WorkingDir: '/app',
        HostConfig: {
          AutoRemove: true,
          Memory: 512 * 1024 * 1024, // 512MB
          CpuQuota: 50000, // 50% CPU
        },
        AttachStdout: true,
        AttachStderr: true,
      });
      
      // Start container
      const stream = await container.attach({ stream: true, stdout: true, stderr: true });
      await container.start();
      
      // Collect output
      let stdout = '';
      let stderr = '';
      
      stream.on('data', (chunk: Buffer) => {
        const data = chunk.toString();
        if (chunk[0] === 1) {
          stdout += data.slice(8);
        } else if (chunk[0] === 2) {
          stderr += data.slice(8);
        }
      });
      
      // Wait for container to finish or timeout
      await Promise.race([
        container.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Execution timeout')), (timeout || 30) * 1000)
        ),
      ]);
      
      // Parse output
      let parsedOutput;
      try {
        parsedOutput = JSON.parse(stdout.trim());
      } catch {
        parsedOutput = stdout.trim();
      }
      
      return {
        success: true,
        output: parsedOutput,
        stdout,
        stderr,
        executionTime: new Date().toISOString(),
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: new Date().toISOString(),
      };
    }
  },
}); 