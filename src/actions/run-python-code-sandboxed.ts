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
      defaultValue: `# Example with external package
import requests
import json

# Get external IP
response = requests.get('https://api.ipify.org?format=json')
data = response.json()
print(json.dumps(data, indent=2))`,
    }),
    requirements: Property.LongText({
      displayName: 'Requirements',
      description: 'Python packages to install (one per line)',
      required: false,
      defaultValue: 'requests',
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
    
    const imageName = 'python:slim';
    
    try {
      // Check if image exists locally
      console.log(`Checking for Docker image ${imageName}...`);
      try {
        await docker.getImage(imageName).inspect();
        console.log(`Image ${imageName} found locally`);
      } catch (error) {
        // Image doesn't exist locally, pull it
        console.log(`Image ${imageName} not found locally, pulling...`);
        
        const stream = await docker.pull(imageName);
        
        // Wait for pull to complete and show progress
        await new Promise((resolve, reject) => {
          docker.modem.followProgress(stream, (err: any, res: any) => {
            if (err) {
              reject(err);
            } else {
              console.log(`Successfully pulled ${imageName}`);
              resolve(res);
            }
          }, (event: any) => {
            // Log pull progress
            if (event.status) {
              console.log(`${event.status}${event.progress ? ': ' + event.progress : ''}`);
            }
          });
        });
      }
      
      // Create container with the code
      let cmd: string[];
      
      if (requirements && requirements.trim()) {
        // If requirements are specified, install them silently first then run the code
        const requirementsList = requirements.trim().split('\n').filter((r: string) => r.trim()).join(' ');
        
        // Base64 encode the code to avoid shell escaping issues
        const encodedCode = Buffer.from(code).toString('base64');
        
        // Create a script that sets up a non-root user and runs the code
        const setupScript = `
# Create a non-root user (Debian/Ubuntu syntax)
useradd -m -d /home/pyuser -s /bin/bash pyuser 2>/dev/null || true

# First ensure pip is installed (suppress output)
python3 -m ensurepip --upgrade >/dev/null 2>&1 || true

# Install packages as root (suppress all output)
python3 -m pip install --quiet --no-cache-dir --root-user-action=ignore ${requirementsList} >/dev/null 2>&1

# Switch to non-root user and run the Python code
su - pyuser -c "
cd /home/pyuser
export PATH=/usr/local/bin:/usr/bin:/bin:/home/pyuser/.local/bin:\$PATH
export PYTHONPATH=/usr/local/lib/python3.13/site-packages:/usr/local/lib/python3.12/site-packages:/usr/local/lib/python3.11/site-packages:/usr/local/lib/python3.10/site-packages:\$PYTHONPATH
echo '${encodedCode}' | base64 -d | python3
"
`;
        
        cmd = ['sh', '-c', setupScript];
      } else {
        // No requirements, create user and run the code
        const encodedCode = Buffer.from(code).toString('base64');
        
        const setupScript = `
# Create a non-root user (Debian/Ubuntu syntax)
useradd -m -d /home/pyuser -s /bin/bash pyuser 2>/dev/null || true

# Switch to non-root user and run the Python code
su - pyuser -c "
export PATH=/usr/local/bin:/usr/bin:/bin:/home/pyuser/.local/bin:\$PATH
echo '${encodedCode}' | base64 -d | python3
"
`;
        
        cmd = ['sh', '-c', setupScript];
      }
      
      const container = await docker.createContainer({
        Image: imageName,
        Cmd: cmd,
        WorkingDir: '/home/pyuser',
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
      
      // Set a timeout for container execution
      const executionTimeout = (timeout || 30) * 1000;
      const timeoutHandle = setTimeout(async () => {
        try {
          await container.kill();
        } catch (e) {
          // Container might have already stopped
        }
      }, executionTimeout);
      
      // Wait for container to finish
      try {
        await container.wait();
      } finally {
        clearTimeout(timeoutHandle);
      }
      
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
      console.error('Docker execution error:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('connect ENOENT')) {
        throw new Error(
          'Docker socket not found. Please ensure Docker is running and the socket is mounted with -v /var/run/docker.sock:/var/run/docker.sock'
        );
      } else if (error.statusCode === 404) {
        throw new Error(
          `Docker image ${imageName} not found and could not be pulled. Please check your internet connection.`
        );
      } else {
        throw error;
      }
    }
  },
}); 