from fastapi import FastAPI, Request
import sys
import os

# Dodaj ścieżkę do katalogu backend, aby można było importować moduły
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Importuj właściwą aplikację FastAPI
from backend.app.app import app as backend_app

# Stwórz aplikację FastAPI dla Vercel
app = FastAPI()

@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

# Przekieruj wszystkie zapytania do głównej aplikacji backendu
@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def proxy_to_app(request: Request, full_path: str):
    # W Vercel musimy ręcznie przekazać całe żądanie do aplikacji backendu
    return await backend_app(request.scope, request.receive, request.send)

# Vercel szuka funkcji handler
from mangum import Mangum
handler = Mangum(app)