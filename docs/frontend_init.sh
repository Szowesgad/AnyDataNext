#!/bin/bash
# frontend_init.sh - Initializes the Next.js frontend for AnyDataset
# (c)2025 by M&K

# ---------------------
# Color settings for messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ---------------------
# Message functions
error_exit() {
    echo -e "${RED}❌ Error: $1${NC}" >&2
    exit 1
}

warn_msg() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

success_msg() {
    echo -e "${GREEN}✅ $1${NC}"
}

# ---------------------
# Function to check if a command exists
check_command() {
    command -v "$1" >/dev/null 2>&1 || error_exit "$1 is required but not installed."
}

# ---------------------
# Main execution
echo "🔍 Checking prerequisites..."
check_command node
check_command npm

# Create Next.js app with TypeScript, ESLint, and Tailwind CSS
echo "🚀 Creating Next.js application..."
npx create-next-app@latest frontend-next --ts --eslint --tailwind --app --src-dir --use-npm || error_exit "Failed to create Next.js application"
success_msg "Next.js application created"

# Navigate to the new project
cd frontend-next || error_exit "Failed to navigate to frontend-next directory"

# Install additional dependencies
echo "📦 Installing additional dependencies..."
npm install @radix-ui/react-select @radix-ui/react-slot @radix-ui/react-progress \
  @radix-ui/react-context-menu @radix-ui/react-dialog class-variance-authority clsx \
  tailwind-merge lucide-react tailwindcss-animate next-themes axios react-dropzone \
  || error_exit "Failed to install additional dependencies"
success_msg "Additional dependencies installed"

# Install shadcn/ui CLI for component installation
npm install -D @shadcn/ui || error_exit "Failed to install shadcn/ui CLI"

# Initialize shadcn/ui
echo "🎨 Initializing shadcn/ui..."
npx shadcn-ui@latest init || error_exit "Failed to initialize shadcn/ui"
success_msg "shadcn/ui initialized"

# Install specific UI components
echo "🧩 Installing UI components..."
npx shadcn-ui@latest add button card dialog dropdown-menu input label select table tabs toast progress || error_exit "Failed to install UI components"
success_msg "UI components installed"

# Create folder structure
echo "📁 Creating folder structure..."
mkdir -p src/app/api
mkdir -p src/components/{ui,forms,layout,data-display}
mkdir -p src/lib/{api,hooks,utils}
mkdir -p src/types
mkdir -p public/icons
success_msg "Folder structure created"

# Copy existing public assets if available
if [ -d "../frontend/public" ]; then
  echo "🖼️ Copying existing public assets..."
  cp -r ../frontend/public/* public/ || warn_msg "Failed to copy some public assets"
  success_msg "Public assets copied"
fi

echo "✨ Next.js frontend initialization complete!"