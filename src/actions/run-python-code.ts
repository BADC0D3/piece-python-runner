import { createAction, Property } from '@activepieces/pieces-framework';
import { exec } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const runPythonCode = createAction({
  name: 'run-python-code',
  displayName: 'Run Python Code',
  description: 'Execute Python code with imports and return the output',
  props: {
    code: Property.LongText({
      displayName: 'Python Code',
      description: 'The Python code to execute',
      required: true,
      defaultValue: `import json
import requests

# Your Python code here
data = {"message": "Hello from Python!"}
print(json.dumps(data, indent=2))
`,
    }),
    requirements: Property.LongText({
      displayName: 'Requirements',
      description: 'Python packages to install (one per line, like requirements.txt)',
      required: false,
      defaultValue: 'requests\nnumpy\npandas',
    }),
    timeout: Property.Number({
      displayName: 'Timeout (seconds)',
      description: 'Maximum execution time in seconds',
      required: false,
      defaultValue: 30,
    }),
    pythonVersion: Property.StaticDropdown({
      displayName: 'Python Version',
      description: 'Python version to use',
      required: false,
      defaultValue: 'python3',
      options: {
        options: [
          { label: 'Python 3 (Default)', value: 'python3' },
          { label: 'Python 3.9', value: 'python3.9' },
          { label: 'Python 3.10', value: 'python3.10' },
          { label: 'Python 3.11', value: 'python3.11' },
        ],
      },
    }),
    captureOutput: Property.Checkbox({
      displayName: 'Capture Output',
      description: 'Capture stdout and stderr separately',
      required: false,
      defaultValue: true,
    }),
  },
  async run(context) {
    const { code, requirements, timeout, pythonVersion, captureOutput } = context.propsValue;
    
    // Create a temporary directory for this execution
    const tempDir = join('/tmp', `python-exec-${randomBytes(8).toString('hex')}`);
    const scriptPath = join(tempDir, 'script.py');
    const requirementsPath = join(tempDir, 'requirements.txt');
    const venvPath = join(tempDir, 'venv');
    
    try {
      // Create temporary directory
      mkdirSync(tempDir, { recursive: true });
      
      // Write the Python script
      writeFileSync(scriptPath, code);
      
      // Create virtual environment
      await execAsync(`${pythonVersion} -m venv ${venvPath}`, {
        timeout: 10000,
      });
      
      // Determine pip path based on OS
      const pipPath = process.platform === 'win32' 
        ? join(venvPath, 'Scripts', 'pip')
        : join(venvPath, 'bin', 'pip');
      
      const pythonPath = process.platform === 'win32'
        ? join(venvPath, 'Scripts', 'python')
        : join(venvPath, 'bin', 'python');
      
      // Install requirements if provided
      if (requirements && requirements.trim()) {
        writeFileSync(requirementsPath, requirements);
        
        try {
          await execAsync(`${pipPath} install -r ${requirementsPath}`, {
            timeout: 60000, // 60 seconds for pip install
          });
        } catch (pipError: any) {
          console.warn('Some packages failed to install:', pipError.message);
          // Continue execution even if some packages fail
        }
      }
      
      // Execute the Python script
      const { stdout, stderr } = await execAsync(
        `${pythonPath} ${scriptPath}`,
        {
          timeout: (timeout || 30) * 1000,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        }
      );
      
      // Parse output if it's JSON
      let parsedOutput;
      try {
        parsedOutput = JSON.parse(stdout.trim());
      } catch {
        parsedOutput = stdout.trim();
      }
      
      return {
        success: true,
        output: parsedOutput,
        stdout: captureOutput ? stdout : undefined,
        stderr: captureOutput ? stderr : undefined,
        executionTime: new Date().toISOString(),
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        code: error.code,
        executionTime: new Date().toISOString(),
      };
    } finally {
      // Cleanup temporary files
      try {
        rmdirSync(tempDir, { recursive: true });
      } catch (cleanupError) {
        console.error('Failed to cleanup temp directory:', cleanupError);
      }
    }
  },
}); 