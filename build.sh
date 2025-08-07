#!/bin/bash

echo "🔧 Building Python Code Runner for Activepieces..."
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "🏗️  Building the piece..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully"
    echo ""
    echo "📁 Build output is in the 'dist' directory"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Copy the piece to your Activepieces pieces directory"
    echo "   2. Restart your Activepieces instance"
    echo "   3. The Python Code Runner will be available in your flows"
else
    echo "❌ Build failed"
    exit 1
fi 