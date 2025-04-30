# Instrukcja uruchomienia produkcyjnego backendu AnyDataset
(c)2025 by M&K

## Wymagania systemowe dla Dragon

- Python 3.10+
- Nginx (dla obsługi HTTPS i przekazywania żądań)
- Certbot (Let's Encrypt dla certyfikatów SSL)
- Supervisor (zarządzanie procesami)

## 1. Instalacja backendu

Przejdź do katalogu, w którym chcesz zainstalować backend:

```bash
cd /opt
sudo git clone https://github.com/Szowesgad/AnyDataNext.git anydataset
sudo chown -R $USER:$USER /opt/anydataset
cd /opt/anydataset
```

## 2. Utwórz wirtualne środowisko Python

```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

## 3. Konfiguracja Supervisor

Utwórz plik konfiguracyjny dla Supervisora:

```bash
sudo nano /etc/supervisor/conf.d/anydataset.conf
```

Zawartość pliku:

```ini
[program:anydataset]
directory=/opt/anydataset/backend
command=/opt/anydataset/venv/bin/uvicorn app.app:app --host 127.0.0.1 --port 8000 --workers 4
autostart=true
autorestart=true
stderr_logfile=/var/log/anydataset/err.log
stdout_logfile=/var/log/anydataset/out.log
user=admin
group=admin
environment=
    PYTHONPATH="/opt/anydataset",
    OPENAI_API_KEY="twój_klucz",
    ANTHROPIC_API_KEY="twój_klucz",
    MISTRAL_API_KEY="twój_klucz",
    DEEPSEEK_API_KEY="twój_klucz",
    LIBRAXIS_API_KEY="twój_klucz",
    LIBRAXIS_API_URL="https://libraxis.cloud/v1"
```

Utwórz katalog logów:

```bash
sudo mkdir -p /var/log/anydataset
sudo chown -R admin:admin /var/log/anydataset
```

Przeładuj i uruchom Supervisora:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start anydataset
```

## 4. Konfiguracja Nginx dla HTTPS

Zainstaluj Nginx i Certbot:

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

Utwórz konfigurację Nginx:

```bash
sudo nano /etc/nginx/sites-available/anydataset
```

Zawartość pliku:

```nginx
server {
    listen 80;
    server_name api.anydataset.example.com;  # Zmień na właściwą domenę

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name api.anydataset.example.com;  # Zmień na właściwą domenę

    ssl_certificate /etc/letsencrypt/live/api.anydataset.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.anydataset.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # Obsługa WebSocket dla statusu postępu
    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Standardowe proxy dla API
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Zwiększone limity dla przesyłania plików
        client_max_body_size 100M;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Katalogi dla plików tymczasowych i przesłanych
    location /uploads {
        alias /opt/anydataset/backend/uploads;
        autoindex off;
    }

    location /ready {
        alias /opt/anydataset/backend/ready;
        autoindex off;
    }

    # Podstawowe zabezpieczenia
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

Utwórz link symboliczny i przetestuj konfigurację:

```bash
sudo ln -s /etc/nginx/sites-available/anydataset /etc/nginx/sites-enabled/
sudo nginx -t
```

## 5. Uzyskaj certyfikat SSL z Let's Encrypt

```bash
sudo certbot --nginx -d api.anydataset.example.com
```

## 6. Przeładuj Nginx

```bash
sudo systemctl reload nginx
```

## 7. Skrypt automatyzujący aktualizację backendu

Utwórz plik `/opt/anydataset/update_backend.sh`:

```bash
#!/bin/bash
# Skrypt do aktualizacji backendu AnyDataset

cd /opt/anydataset
git pull

source venv/bin/activate
pip install --upgrade -r backend/requirements.txt

sudo supervisorctl restart anydataset
echo "Backend zaktualizowany i zrestartowany."
```

Nadaj uprawnienia wykonywania:

```bash
chmod +x /opt/anydataset/update_backend.sh
```

## 8. Konfiguracja CORS w backendu

Otwórz plik `/opt/anydataset/backend/app/app.py` i upewnij się, że ustawienia CORS są odpowiednio skonfigurowane:

```python
# Upewnij się, że są te importy
from fastapi.middleware.cors import CORSMiddleware

# Dodaj w konfiguracji aplikacji
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://anydataset.example.com"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 9. Monitoring i logi

Sprawdzanie statusu:

```bash
sudo supervisorctl status anydataset
```

Sprawdzanie logów:

```bash
sudo tail -f /var/log/anydataset/out.log
sudo tail -f /var/log/anydataset/err.log
```

## 10. Uruchomienie backendu i frontendu jako usług systemowych

Aby usługi startowały automatycznie po ponownym uruchomieniu systemu:

```bash
sudo systemctl enable nginx
sudo systemctl enable supervisor
```

## 11. Dostosowanie konfiguracji w frontend-next

W pliku `.env.local` w katalogu `frontend-next` należy ustawić:

```
NEXT_PUBLIC_API_URL=https://api.anydataset.example.com
```

## 12. Automatyczny restart usługi w przypadku awarii

Supervisor jest skonfigurowany tak, aby automatycznie uruchamiać backend po awarii, dzięki opcji `autorestart=true`.

## 13. Zabezpieczenia dodatkowe (opcjonalnie)

### Fail2ban dla ochrony przed atakami

```bash
sudo apt install fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
```

Dodaj konfigurację dla Nginx:

```
[nginx-http-auth]
enabled = true
port    = http,https
filter  = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
```

Uruchom fail2ban:

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Firewall (UFW)

```bash
sudo apt install ufw
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Uwagi dotyczące UI/UX w instrukcji rewrite

Instrukcja rewrite frontend w FRONTEND_REWRITE.md zawiera kompletne informacje na temat:

1. Struktury komponentów UI/UX
2. Zgodności z designem shadcn/ui
3. Responsywności dla wszystkich urządzeń
4. Dostępności (accessibility)
5. Obsługi WebSocketów do aktualizacji statusu w czasie rzeczywistym
6. Interakcji z API backendu

Dodatkowo należy zwrócić uwagę na:

1. Zmianę adresu API z `http://localhost:8000` na `https://api.anydataset.example.com` w pliku `.env.local` frontendu
2. Konfigurację WebSocket do używania bezpiecznego protokołu WSS zamiast WS
3. Zdefiniowanie limitu wielkości plików (obecnie 100MB w konfiguracji Nginx)
4. Komunikaty ładowania/błędów są zaimplementowane we wszystkich komponentach

(c)2025 by M&K