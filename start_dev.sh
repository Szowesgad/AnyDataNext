#!/bin/bash

# AnyDataset Development Startup Script
# Interactive-inspired version

# set -e # Removed for more interactive feel

PYTHON_VERSION="3.11.9" # Specify the desired Python version - NOTE: pyenv usage removed
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
BACKEND_VENV=".venv"
FRONTEND_ENV_FILE=".env.local"
FRONTEND_ENV_EXAMPLE=".env.local.example"
DEFAULT_BACKEND_URL="http://localhost:8000"
BACKEND_LOG_FILE="../backend_server.log"
BACKEND_PID_FILE="../backend_server.pid"

# --- Color Settings --- 
RED=' 33[0;31m'
GREEN=' 33[0;32m'
YELLOW=' 33[1;33m'
BLUE=' 33[0;34m'
NC=' 33[0m' # No Color

# --- Helper Functions --- 

print_info() {
    echo -e "${BLUE}INFO:${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ SUCCESS:${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
}

print_error() {
    echo -e "${RED}❌ ERROR:${NC} $1" >&2
}

# Function to handle script exit, ensuring cleanup
cleanup_and_exit() {
    print_info "Initiating cleanup..."
    # Check if PID file exists and contains a valid PID
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if [ -n "$BACKEND_PID" ] && ps -p $BACKEND_PID > /dev/null; then
            print_info "Stopping background backend server (PID: $BACKEND_PID)..."
            kill $BACKEND_PID
            rm -f "$BACKEND_PID_FILE"
            print_success "Backend server stopped."
        else
            print_warn "Backend server process (PID: $BACKEND_PID) not found or PID file empty. It might have stopped already."
            rm -f "$BACKEND_PID_FILE" # Clean up PID file anyway
        fi
    else
         print_info "No backend PID file found, assuming server is not running or was stopped manually."
    fi
    echo -e "${BLUE}-------------------------------------------------${NC}"
    echo -e "${BLUE} AnyDataset Development Environment stopped. ${NC}"
    echo -e "${BLUE}-------------------------------------------------${NC}"
    exit ${1:-0} # Exit with provided code or 0 if none
}

# Trap SIGINT (Ctrl+C) and SIGTERM to run cleanup function
trap cleanup_and_exit SIGINT SIGTERM

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "Command not found: $1. Please install it and ensure it's in your PATH."
        if [ "$1" == "uv" ]; then
             echo "See: https://github.com/astral-sh/uv (e.g., pip install uv)"
        elif [ "$1" == "npm" ]; then
            echo "Usually installed with Node.js. See: https://nodejs.org/"
        fi
        # Since set -e is removed, we explicitly exit here as these are hard requirements
        exit 1 
    fi
}

# --- Main Script --- 

clear # Clear screen for better visibility
echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}🚀 Starting AnyDataset Development Environment 🚀${NC}"
echo -e "${BLUE}=================================================${NC}"

# Check prerequisites
print_info "Checking prerequisites (uv, npm)..."
# check_command pyenv # Removed pyenv check
check_command uv
check_command npm
print_success "Prerequisites met."
echo

# --- Backend Setup --- 

print_info "Setting up Backend ($BACKEND_DIR)..."
if [ ! -d "$BACKEND_DIR" ]; then
    print_error "Backend directory '$BACKEND_DIR' not found!"
    cleanup_and_exit 1
fi
cd "$BACKEND_DIR"

# Removed pyenv version check, install prompt, and pyenv local command

# Check if venv exists, create if not
if [ ! -d "$BACKEND_VENV" ]; then
    print_info "Virtual environment ($BACKEND_VENV) not found. Creating using uv..."
    # Use uv venv for speed - removed explicit python version
    if ! uv venv "$BACKEND_VENV"; then 
        print_error "Failed to create virtual environment using uv venv. Ensure a compatible Python is available."
        # Offer fallback? For now, just exit.
        cleanup_and_exit 1
    fi
    print_success "Virtual environment created using uv."
else
    print_info "Virtual environment ($BACKEND_VENV) found."
fi

# Activate venv
if ! source "$BACKEND_VENV/bin/activate"; then
     print_error "Failed to activate backend virtual environment."
     cleanup_and_exit 1
fi
print_info "Activated backend virtual environment."

# Install/update dependencies
print_info "Installing/updating backend dependencies using uv... (This may take a moment)"
if uv pip install -r requirements.txt; then
    print_success "Backend dependencies installed successfully."
else
    print_error "Failed to install backend dependencies."
    deactivate
    cleanup_and_exit 1
fi

deactivate # Deactivate for now, will be activated again for server start
cd ..
echo

# --- Frontend Setup --- 

print_info "Setting up Frontend ($FRONTEND_DIR)..."
if [ ! -d "$FRONTEND_DIR" ]; then
    print_error "Frontend directory '$FRONTEND_DIR' not found!"
    cleanup_and_exit 1
fi
cd "$FRONTEND_DIR"

# Install/update dependencies
print_info "Installing/updating frontend dependencies using npm... (This may take a while)"
if npm install; then
    print_success "Frontend dependencies installed successfully."
else
    print_error "Failed to install frontend dependencies."
    cleanup_and_exit 1
fi

# Check/Create .env.local
if [ ! -f "$FRONTEND_ENV_FILE" ]; then
    print_warn "$FRONTEND_ENV_FILE not found."
    if [ -f "$FRONTEND_ENV_EXAMPLE" ]; then
        print_info "Found $FRONTEND_ENV_EXAMPLE."
        # Automatically copy example if found, as interactive prompts might not work well here.
        print_info "Copying $FRONTEND_ENV_EXAMPLE to $FRONTEND_ENV_FILE..."
        cp "$FRONTEND_ENV_EXAMPLE" "$FRONTEND_ENV_FILE"
        print_success "Copied example to $FRONTEND_ENV_FILE."
        print_warn "Please verify its contents, especially NEXT_PUBLIC_BACKEND_URL."
        # Removed interactive prompt
    else
        print_warn "$FRONTEND_ENV_EXAMPLE not found."
        # Automatically create default if example not found
        print_info "Creating a default $FRONTEND_ENV_FILE with backend URL $DEFAULT_BACKEND_URL..."
        echo "NEXT_PUBLIC_BACKEND_URL=$DEFAULT_BACKEND_URL" > "$FRONTEND_ENV_FILE"
        print_success "Created default $FRONTEND_ENV_FILE."
        print_warn "Verify if the default backend URL is correct."
        # Removed interactive prompt
    fi
else
    print_info "$FRONTEND_ENV_FILE found."
fi

cd ..
echo

# --- Start Servers --- 

print_info "Starting Backend server in the background..."
if [ ! -d "$BACKEND_DIR" ]; then # Double check just in case
    print_error "Backend directory '$BACKEND_DIR' not found!"
    cleanup_and_exit 1
fi
cd "$BACKEND_DIR"
if ! source "$BACKEND_VENV/bin/activate"; then
     print_error "Failed to activate backend virtual environment for server start."
     cleanup_and_exit 1
fi

# Check if port 8000 is already in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    print_warn "Port 8000 seems to be in use. Backend server might fail to start or another instance is already running."
    # Removed interactive prompt - attempt to start anyway
    print_info "Proceeding with backend server start attempt..."
fi

# Start Uvicorn in background, log output to backend_server.log
print_info "Executing: uvicorn app.app:app --host 0.0.0.0 --port 8000 --reload > $BACKEND_LOG_FILE 2>&1 &"
uvicorn app.app:app --host 0.0.0.0 --port 8000 --reload > "$BACKEND_LOG_FILE" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$BACKEND_PID_FILE" # Store PID for cleanup
sleep 3 # Give server a moment longer to potentially fail

# Check if backend process started successfully
if ps -p $BACKEND_PID > /dev/null; then
   print_success "Backend server started in background (PID: $BACKEND_PID). Logs redirected to $BACKEND_LOG_FILE"
else
   print_error "Failed to start backend server. Check $BACKEND_LOG_FILE for errors."
   rm -f "$BACKEND_PID_FILE"
   deactivate
   cleanup_and_exit 1
fi
deactivate # Deactivate backend venv after starting server
cd ..
echo

print_info "Starting Frontend server in the foreground..."
if [ ! -d "$FRONTEND_DIR" ]; then
    print_error "Frontend directory '$FRONTEND_DIR' not found!"
    cleanup_and_exit 1
fi
cd "$FRONTEND_DIR"

# npm run dev will run in the foreground and capture Ctrl+C
print_info "Executing: npm run dev (Press Ctrl+C to stop both servers)"
npm run dev

# --- Cleanup (This part is now handled by the trap) --- 
# If npm run dev exits normally (which it usually doesn't without Ctrl+C),
# the trap should still catch the script exit and clean up.
# We add a final explicit call just in case the trap mechanism has issues.
print_info "Frontend process finished or interrupted."
cleanup_and_exit 0
