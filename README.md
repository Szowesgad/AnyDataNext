# AnyDataNext 🚀

AnyDataNext is a platform designed for flexible processing and preparation of various data types (text, audio, video) for AI model training. It features a web interface for managing uploads, configuring processing pipelines, and generating structured datasets. This project evolved from the original AnyDataset with enhanced features, improved architecture, and better support for different data modalities.

## ✨ Key Features

*   **Text Processing Pipeline (Existing/Mature):**
    *   Handles various document formats (PDF, DOCX, TXT, etc.).
    *   Intelligent chunking and context-aware processing.
    *   Integration with LLMs for summarization, keyword extraction, Q&A generation.
    *   Configurable processing options.
    *   Batch processing capabilities.
*   **Audio/Video Processing Pipeline (In Progress):**
    *   Accepts various audio/video input formats via web UI.
    *   Uses `ffmpeg` for audio extraction and standardization (target: 16kHz mono WAV).
    *   Aims to use `mlx-whisper` (on Apple Silicon with MLX) for transcription with word-level timestamps (planned: `large-v3` model).
    *   Future: Semantic segmentation, precise audio chunk cutting.
    *   Future: Generates a dataset package (ZIP) with audio chunks and metadata.
*   **Web Interface (Next.js / React / TypeScript):**
    *   File upload (drag & drop).
    *   Configuration of processing parameters (UI implemented).
    *   Real-time progress tracking via WebSockets (partially implemented).
    *   Viewing and downloading processed datasets (basic functionality).
*   **Backend (FastAPI / Python):**
    *   Asynchronous processing using background tasks.
    *   WebSocket support for real-time communication.
    *   Modular processing utilities (structure in place).

## 🛠️ Technology Stack

*   **Backend:** Python 3.11+, FastAPI, Uvicorn, MLX (planned), `mlx-whisper` (planned), `ffmpeg` (external dependency)
*   **Frontend:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
*   **Communication:** WebSockets
*   **Package Management:** `uv` (preferred for Python backend), `pip` (fallback), `npm` (for frontend)
*   **Python Version Management:** `pyenv` (recommended)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

1.  **Python 3.11.x:** We strongly recommend managing Python versions using `pyenv`.
    ```bash
    # Example using pyenv
    pyenv install 3.11.9 
    pyenv global 3.11.9 # Or set locally in the backend directory
    ```
2.  **Node.js:** A recent LTS version (e.g., 18.x or 20.x). Download from [nodejs.org](https://nodejs.org/) or use a version manager like `nvm`.
3.  **npm:** Usually comes with Node.js.
4.  **ffmpeg:** Required for audio/video processing.
    ```bash
    # On macOS (using Homebrew)
    brew install ffmpeg
    # On Debian/Ubuntu
    sudo apt update && sudo apt install ffmpeg
    # On Fedora
    sudo dnf install ffmpeg
    ```
5.  **uv (Recommended):** The fast Python package installer/resolver.
    ```bash
    # Example installation using pip (if you have it)
    pip install uv 
    # Or follow instructions at https://github.com/astral-sh/uv
    # The backend startup script will attempt to use uv if available.
    ```

## 🚀 Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Szowesgad/AnyDataNext.git
    cd AnyDataNext
    ```

2.  **Backend Environment Setup (if not using start scripts initially):**
    ```bash
    cd backend
    # Ensure correct Python version (e.g., using pyenv local 3.11.9)
    # Create virtual environment (uv is faster if installed)
    # python -m venv .venv 
    # OR
    uv venv .venv
    # Activate
    source .venv/bin/activate
    # Install dependencies (uv preferred)
    # uv pip install -r requirements.txt 
    # OR
    # pip install -r requirements.txt
    # Deactivate (optional)
    # deactivate
    cd ..
    ```

3.  **Frontend Environment Setup (if not using start scripts initially):**
    ```bash
    cd frontend
    # Install dependencies
    npm install
    # Create environment file for local development
    # Ensure you have a .env.local file. You might copy from .env.local.example
    # Example: cp .env.local.example .env.local
    # !! IMPORTANT !!: Verify the NEXT_PUBLIC_BACKEND_URL in .env.local 
    # It should point to your running backend (default: http://localhost:8000)
    # Example .env.local contents:
    # NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
    cd ..
    ```

## ▶️ Running the Application (Development)

We now use dedicated scripts for starting the backend and frontend.

1.  **Make Scripts Executable (only needed once):**
    ```bash
    chmod +x backend-start.sh frontend-start.sh
    ```

2.  **Start the Backend Server:**
    *   Open a terminal in the project root directory.
    *   Run: `./backend-start.sh`
    *   This script handles activating the virtual environment, installing dependencies (using `uv` if available), and starting the Uvicorn server.
    *   **Keep this terminal open.** It will show backend logs.

3.  **Start the Frontend Server:**
    *   Open a **new** terminal window/tab in the project root directory.
    *   Run: `./frontend-start.sh`
    *   This script first checks if the backend is responding, then installs frontend dependencies (if needed), and starts the Next.js development server.
    *   **Keep this terminal open.** It will show frontend logs.

4.  **Access the Application:** Open your web browser and navigate to `http://localhost:3000` (or the port specified by the frontend script).

## 🌐 Accessing on LAN (Local Network)

The backend now automatically detects your local IP address and configures CORS to allow connections from both localhost and your local network:

1. Start both the backend and frontend servers as described above.
2. Check the backend startup logs to find your local IP address:
   ```
   Detected local IP address: 192.168.1.200
   ```
3. You can now access the application from other devices on your network:
   - Backend API: `http://YOUR_LOCAL_IP:8000`
   - Frontend UI: `http://YOUR_LOCAL_IP:3000`

4. To manually find your IP address:
   ```bash
   # On macOS/Linux
   ifconfig | grep inet
   # On Windows
   ipconfig
   ```

## 📂 Project Structure

```
AnyDataNext/
├── backend/            # FastAPI application (Python)
│   ├── app/            # Core application logic, endpoints, utils
│   │   ├── scripts/    # Processing scripts for different formats
│   │   ├── utils/      # Utility modules and helper functions
│   │   └── ...         # Templates, static files, etc.
│   ├── .venv/          # Virtual environment (created by script/user)
│   ├── data/           # Example data files for testing
│   ├── requirements.txt # Python dependencies
│   └── ...
├── frontend/           # Next.js application (TypeScript)
│   ├── src/            # Source code (pages, components)
│   │   ├── app/        # Next.js app router
│   │   ├── components/ # React components
│   │   └── ...         # Types, lib utilities, etc.
│   ├── public/         # Static assets
│   ├── node_modules/   # Node.js dependencies (created by script/user)
│   ├── .env.local      # Local environment variables (created by user)
│   ├── package.json    # Frontend dependencies and scripts
│   └── ...
├── docs/               # Documentation files
│   ├── audit-20250404.md # Project audit document
│   ├── refactor-20250404.md # Refactoring report
│   └── ...
├── .github/            # GitHub workflows for CI/CD
│   ├── workflows/      # GitHub Actions workflows
│   │   ├── build.yml   # Build and test workflow
│   │   └── server-build.yml # Deployment workflow
├── backend-start.sh    # Script to start the backend server
├── frontend-start.sh   # Script to start the frontend server
├── devstage.md         # Summary of the current development stage
├── nextsteps.md        # Original planning document
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## 📍 Development Status

For a detailed summary of the current development stage, recent progress, and immediate next steps, please refer to the `devstage.md` file.

## 🗺️ Roadmap

See `roadmapnext.md` for longer-term plans (consider merging key points into this README or `devstage.md`).

## 🤝 Contributing

Guidelines for contributing to this project:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature-name`)
3. Commit your changes (`git commit -m 'feat(component): add new feature' (c) M&K`)
4. Push to the branch (`git push origin feature/your-feature-name`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

🤖 Developed with the ultimate help of [Claude Code](https://claude.ai/code) and [MCP Tools](https://modelcontextprotocol.io)