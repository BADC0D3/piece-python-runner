# Python Code Runner for Activepieces

A powerful Activepieces piece that allows you to execute Python code with support for external libraries and imports.

## Features

- **Execute Python Code**: Run any Python code within your Activepieces workflows
- **Library Support**: Install and use any Python package from PyPI
- **Multiple Python Versions**: Support for Python 3.9, 3.10, 3.11
- **Virtual Environment**: Each execution runs in an isolated virtual environment
- **JSON Output Support**: Automatically parse JSON output from your Python scripts
- **Sandboxed Execution**: Optional Docker-based execution for enhanced security
- **Error Handling**: Comprehensive error reporting with stdout/stderr capture

## Installation

1. Clone this repository to your Activepieces pieces directory:
```bash
cd piece-python-runner
```

2. Install dependencies:
```bash
npm install
```

3. Build the piece:
```bash
npm run build
```

4. Deploy to your Activepieces instance (follow your instance's deployment guide)

## Usage

### Basic Example

```python
import json

# Simple calculation
result = 2 + 2
data = {"result": result, "message": "Hello from Python!"}
print(json.dumps(data))
```

### Using External Libraries

In the "Requirements" field, list the packages you need (one per line):
```
requests
pandas
numpy
matplotlib
```

Then use them in your code:
```python
import requests
import pandas as pd
import numpy as np
import json

# Fetch data from an API
response = requests.get('https://api.example.com/data')
data = response.json()

# Process with pandas
df = pd.DataFrame(data)
mean_value = df['value'].mean()

# Use numpy for calculations
values = np.array(df['value'])
std_dev = np.std(values)

result = {
    "mean": mean_value,
    "std_dev": std_dev,
    "count": len(df)
}

print(json.dumps(result))
```

### Data Processing Example

```python
import pandas as pd
import json
from datetime import datetime

# Create sample data
sales_data = {
    'date': ['2024-01-01', '2024-01-02', '2024-01-03'],
    'product': ['A', 'B', 'A'],
    'quantity': [10, 15, 20],
    'price': [100, 200, 100]
}

# Process with pandas
df = pd.DataFrame(sales_data)
df['total'] = df['quantity'] * df['price']
df['date'] = pd.to_datetime(df['date'])

# Calculate summary statistics
summary = {
    'total_revenue': float(df['total'].sum()),
    'average_quantity': float(df['quantity'].mean()),
    'products_sold': df['product'].nunique(),
    'date_range': {
        'start': df['date'].min().strftime('%Y-%m-%d'),
        'end': df['date'].max().strftime('%Y-%m-%d')
    }
}

print(json.dumps(summary, indent=2))
```

### Web Scraping Example

```python
import requests
from bs4 import BeautifulSoup
import json

# Scrape a website
url = 'https://example.com'
response = requests.get(url)
soup = BeautifulSoup(response.content, 'html.parser')

# Extract data
title = soup.find('title').text if soup.find('title') else 'No title'
links = [a.get('href') for a in soup.find_all('a', href=True)]

result = {
    'title': title,
    'link_count': len(links),
    'first_5_links': links[:5]
}

print(json.dumps(result, indent=2))
```

## Configuration Options

### Python Code
The main Python code to execute. Supports all standard Python features including imports, functions, classes, etc.

### Requirements
List of Python packages to install before execution. Format:
- One package per line
- Supports version specifications (e.g., `requests==2.28.0`)
- Supports git URLs for custom packages

### Timeout
Maximum execution time in seconds (default: 30). Prevents infinite loops and long-running processes.

### Python Version
Choose from:
- Python 3 (Default) - Uses system default Python 3
- Python 3.9
- Python 3.10
- Python 3.11

### Capture Output
When enabled, returns separate stdout and stderr in the result object.

## Output Format

The action returns an object with the following structure:

```json
{
  "success": true,
  "output": {
    // Your parsed JSON output or string output
  },
  "stdout": "Full stdout content (if capture output is enabled)",
  "stderr": "Full stderr content (if capture output is enabled)",
  "executionTime": "2024-01-01T12:00:00.000Z"
}
```

On error:
```json
{
  "success": false,
  "error": "Error message",
  "stdout": "Stdout before error",
  "stderr": "Stderr content",
  "code": "Error code",
  "executionTime": "2024-01-01T12:00:00.000Z"
}
```

## Security Considerations

### Standard Version
- Runs in isolated virtual environments
- Each execution gets a fresh environment
- Temporary files are cleaned up after execution
- Resource limits enforced by timeout

### Sandboxed Version
- Runs in Docker containers
- Memory limited to 512MB
- CPU limited to 50% of one core
- Network access can be restricted
- Complete isolation from host system

## Best Practices

1. **Always use virtual environments**: This piece automatically creates one for each execution
2. **Return JSON when possible**: Makes it easier to use output in subsequent workflow steps
3. **Handle errors gracefully**: Use try-except blocks in your Python code
4. **Be mindful of timeouts**: Long-running operations should be broken into smaller steps
5. **Clean up resources**: The piece automatically cleans up, but close files/connections in your code
6. **Use specific package versions**: Pin versions in requirements for reproducibility

## Docker Deployment

### Running in Docker

When deploying Activepieces in Docker, the Python Code Runner adapts to the container environment:

1. **Automatic Detection**: The piece detects Docker environments and skips virtual environment creation
2. **System Python**: Uses the container's Python installation directly
3. **Package Installation**: Installs packages with `--user` flag when pip is available

### Docker Setup Requirements

For the **standard Python Code Runner** to work in Docker, ensure your container has:

```dockerfile
# Example Dockerfile additions
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*
```

### Recommended: Use Sandboxed Version

For Docker deployments, we **strongly recommend** using the **"Run Python Code (Sandboxed)"** action instead because:

- It runs Python in a separate container with all dependencies pre-installed
- No need to modify your Activepieces Docker image
- Better isolation and security
- Consistent environment across all executions

### Minimal Docker Image

If you're using a minimal Docker image without pip:

1. **Option 1**: Install pip in your Dockerfile (shown above)
2. **Option 2**: Use the sandboxed version
3. **Option 3**: Only use Python standard library (no external packages)

## Troubleshooting

### Common Issues

1. **Import Error**: Package not found
   - Make sure to list the package in the Requirements field
   - Check the package name is correct (case-sensitive)

2. **Timeout Error**: Execution exceeded timeout
   - Increase the timeout value
   - Optimize your code for better performance
   - Consider breaking into smaller steps

3. **Memory Error**: Out of memory
   - Use the sandboxed version with memory limits
   - Process data in chunks
   - Clear large variables when done

4. **JSON Parse Error**: Output is not valid JSON
   - Ensure you're using `json.dumps()` for output
   - Check for print statements that might interfere

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Build the piece
npm run build

# Run tests (if available)
npm test
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This piece is distributed under the same license as Activepieces.

## Support

For issues and feature requests, please open an issue in the repository or contact the Activepieces community. 