import { createAction, Property, ActionContext } from '@activepieces/pieces-framework';
import { exec } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync, existsSync, readFileSync } from 'fs';
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
  async run(context: ActionContext) {
    const { code, requirements, timeout, pythonVersion, captureOutput } = context.propsValue;
    
    // Create a temporary directory for this execution
    const tempDir = join('/tmp', `python-exec-${randomBytes(8).toString('hex')}`);
    const scriptPath = join(tempDir, 'script.py');
    const venvPath = join(tempDir, 'venv');
    const requirementsPath = join(tempDir, 'requirements.txt');
    
    let useVenv = true;
    let pipCommand = '';
    let pythonCommand = '';
    
    // Check if running in Docker
    const isDocker = process.env.DOCKER_CONTAINER === 'true' || 
                     existsSync('/.dockerenv') || 
                     (existsSync('/proc/1/cgroup') && readFileSync('/proc/1/cgroup', 'utf8').includes('docker'));
    
    if (isDocker) {
      console.log('Detected Docker environment - skipping virtual environment creation');
      useVenv = false;
    }
    
    try {
      // Create temporary directory
      mkdirSync(tempDir, { recursive: true });
      
      // Write the Python script
      writeFileSync(scriptPath, code);
      
      // Create virtual environment only if not in Docker and useVenv is true
      if (useVenv) {
        try {
          // First check if Python is available and get version info
          const pythonCheck = await execAsync(`${pythonVersion} --version`, {
            timeout: 5000,
          });
          console.log(`Python version check: ${pythonCheck.stdout}`);
          
          // Check if venv module is available
          const venvCheck = await execAsync(`${pythonVersion} -m venv --help`, {
            timeout: 5000,
          }).catch(err => {
            throw new Error(`Python venv module not available. Please ensure python3-venv is installed. Error: ${err.message}`);
          });
          
          // Try creating venv with symlinks first
          await execAsync(`${pythonVersion} -m venv ${venvPath}`, {
            timeout: 10000,
          });
        } catch (error: any) {
          console.log('Primary venv creation failed:', error.message);
          
          // If symlink fails, try without symlinks
          try {
            console.log('Trying venv creation with --copies flag...');
            await execAsync(`${pythonVersion} -m venv --copies ${venvPath}`, {
              timeout: 10000,
            });
          } catch (fallbackError: any) {
            // If both methods fail, try using the system Python directly
            console.log('Venv creation failed. Error details:', fallbackError.message);
            console.log('Falling back to system Python without virtual environment...');
            useVenv = false;
          }
        }
      }
      
      if (useVenv) {
        // Determine pip path based on OS
        const pipPath = process.platform === 'win32' 
          ? join(venvPath, 'Scripts', 'pip')
          : join(venvPath, 'bin', 'pip');
        
        const pythonPath = process.platform === 'win32' 
          ? join(venvPath, 'Scripts', 'python')
          : join(venvPath, 'bin', 'python');
          
        pipCommand = pipPath;
        pythonCommand = pythonPath;
      } else {
        // Use system Python and pip
        pipCommand = `${pythonVersion} -m pip`;
        pythonCommand = pythonVersion;
      }
      
      // Install requirements if provided
      if (requirements && requirements.trim()) {
        writeFileSync(requirementsPath, requirements);
        
        try {
          // First check if pip is available
          const pipCheckCmd = useVenv ? `${pipCommand} --version` : `${pythonVersion} -m pip --version`;
          await execAsync(pipCheckCmd, { timeout: 5000 }).catch(err => {
            throw new Error(
              `pip is not installed. Please ensure pip is available in your Python environment. ` +
              `For Debian/Ubuntu: apt-get install python3-pip. ` +
              `For other systems, please install pip for ${pythonVersion}.`
            );
          });
          
          const pipInstallCmd = useVenv 
            ? `${pipCommand} install -r ${requirementsPath}`
            : `${pipCommand} install --user -r ${requirementsPath}`;
            
          const { stdout: pipStdout, stderr: pipStderr } = await execAsync(pipInstallCmd, {
            timeout: timeout * 1000,
          });
          
          console.log('Pip install output:', pipStdout);
          if (pipStderr) console.error('Pip install errors:', pipStderr);
        } catch (pipError: any) {
          // If pip is not available, provide a helpful error message
          if (pipError.message.includes('No module named pip') || pipError.message.includes('pip is not installed')) {
            throw new Error(
              `Cannot install Python packages: pip is not available. ` +
              `To use packages, please ensure pip is installed in your environment. ` +
              `For the sandboxed version, use the "Run Python Code (Sandboxed)" action instead.`
            );
          }
          throw pipError;
        }
      }
      
      // Execute the Python script
      const execOptions = {
        timeout: (timeout || 30) * 1000,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
      };
      
      const { stdout, stderr } = await execAsync(
        `${pythonCommand} ${scriptPath}`,
        execOptions
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