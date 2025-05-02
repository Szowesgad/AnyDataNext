# Instrukcja uruchomienia produkcyjnego backendu AnyDataset
(c)2025 by M&K

## Wymagania systemowe dla Dragon

- Python 3.10+
- Nginx (dla obsługi HTTPS i przekazywania żądań)
- Certbot (Let's Encrypt dla certyfikatów SSL)
- Supervisor (zarządzanie procesami)

## Optymalna konfiguracja dla zespołu podróżującego

Dla hiper mocnej maszyny Dragon ze stałym IP i domeną anydata.libraxis.cloud, z której zespół będzie korzystać w podróży:

1. **Architektura produkcyjna:**
   - Backend na Dragon pod adresem `https://api.anydata.libraxis.cloud`
   - Frontend na Dragon pod adresem `https://anydata.libraxis.cloud`
   - Wspólne konta LLM (OpenAI, Anthropic) na backendzie

2. **Dostęp zdalny:**
   - Frontend dostępny przez przeglądarkę z dowolnego miejsca
   - Zabezpieczenie dostępu przez system logowania
   - VPN dla dodatkowej warstwy zabezpieczeń przy dostępie administracyjnym

3. **Konfiguracja użytkowników:**
   - System użytkowników z rolami (admin, członek zespołu)
   - Każdy z własnym kontem, ale współdzielącymi zasoby API

4. **Optymalizacja pod kątem podróży:**
   - Responsive UI działający na urządzeniach mobilnych
   - Cachowanie wyników między sesjami
   - Offline mode dla wcześniej przetworzonych danych

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

Zawartość pliku dla optymalnej konfiguracji z osobnymi subdomenami dla API i frontendu:

```nginx
# Konfiguracja dla API (backend)
server {
    listen 80;
    server_name api.anydata.libraxis.cloud;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.anydata.libraxis.cloud;

    ssl_certificate /etc/letsencrypt/live/api.anydata.libraxis.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.anydata.libraxis.cloud/privkey.pem;
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

# Konfiguracja dla frontendu
server {
    listen 80;
    server_name anydata.libraxis.cloud;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name anydata.libraxis.cloud;
    
    ssl_certificate /etc/letsencrypt/live/anydata.libraxis.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/anydata.libraxis.cloud/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    
    # Dla Next.js statycznej eksportowanej wersji
    root /opt/anydataset/frontend-next/out;
    
    location / {
        try_files $uri $uri.html $uri/index.html /index.html;
    }
    
    # Zabezpieczenia
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

## 5. Uzyskaj certyfikaty SSL z Let's Encrypt

```bash
sudo certbot --nginx -d api.anydata.libraxis.cloud -d anydata.libraxis.cloud
```

## 6. Przeładuj Nginx

```bash
sudo systemctl reload nginx
```

## 7. Instalacja i konfiguracja frontendu

Zainstaluj i zbuduj frontend:

```bash
cd /opt/anydataset
npx create-next-app@latest frontend-next --ts --eslint --tailwind --app --src-dir --use-npm

cd frontend-next

# Instalacja zależności zgodnie z instrukcją w FRONTEND_REWRITE.md
npm install @radix-ui/react-select @radix-ui/react-slot @radix-ui/react-progress @radix-ui/react-context-menu @radix-ui/react-dialog class-variance-authority clsx tailwind-merge lucide-react tailwindcss-animate next-themes axios react-dropzone
npm install -D @shadcn/ui

# Inicjalizacja shadcn/ui
npx shadcn-ui@latest init

# Instalacja komponentów UI
npx shadcn-ui@latest add button card dialog dropdown-menu input label select table tabs toast progress

# Utworzenie pliku .env.local
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=https://api.anydata.libraxis.cloud
EOF

# Zbuduj statyczną wersję dla produkcji
npm run build
```

## 8. Dodanie uwierzytelniania (opcjonalnie)

Aby zabezpieczyć dostęp do aplikacji dla członków zespołu, możesz dodać prostą warstwę uwierzytelniania. 

### Opcja 1: Proste uwierzytelnianie HTTP Basic Auth w Nginx

Dodaj do konfiguracji Nginx:

```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd admin
```

Następnie dodaj w konfiguracji frontendu w Nginx:

```nginx
location / {
    auth_basic "Restricted Area";
    auth_basic_user_file /etc/nginx/.htpasswd;
    try_files $uri $uri.html $uri/index.html /index.html;
}
```

### Opcja 2: Pełne uwierzytelnianie użytkowników

Dla pełnego systemu uwierzytelniania, zintegruj z backendendem API logowania i dodaj do frontendu Auth0 lub Firebase Auth.

## 9. Skrypt automatyzujący aktualizację backendu i frontendu

Utwórz plik `/opt/anydataset/update.sh`:

```bash
#!/bin/bash
# Skrypt do aktualizacji AnyDataset

cd /opt/anydataset
git pull

# Aktualizacja backendu
source venv/bin/activate
pip install --upgrade -r backend/requirements.txt
sudo supervisorctl restart anydataset

# Aktualizacja frontendu
cd frontend-next
npm install
npm run build

echo "AnyDataset zaktualizowany i zrestartowany."
```

Nadaj uprawnienia wykonywania:

```bash
chmod +x /opt/anydataset/update.sh
```

## 10. Konfiguracja CORS w backendu

Otwórz plik `/opt/anydataset/backend/app/app.py` i upewnij się, że ustawienia CORS są odpowiednio skonfigurowane:

```python
# Upewnij się, że są te importy
from fastapi.middleware.cors import CORSMiddleware

# Dodaj w konfiguracji aplikacji
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://anydata.libraxis.cloud"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 11. Konfiguracja VPN dla bezpiecznego dostępu zdalnego (opcjonalnie)

Dla dodatkowego zabezpieczenia dostępu administracyjnego, rozważ instalację WireGuard VPN:

```bash
sudo apt install wireguard

# Generowanie kluczy
wg genkey | sudo tee /etc/wireguard/privatekey | wg pubkey | sudo tee /etc/wireguard/publickey

# Konfiguracja interfejsu WireGuard
sudo nano /etc/wireguard/wg0.conf
```

Zawartość pliku wg0.conf:

```
[Interface]
PrivateKey = <zawartość pliku /etc/wireguard/privatekey>
Address = 10.0.0.1/24
ListenPort = 51820
SaveConfig = true

# Dla każdego użytkownika zespołu
[Peer]
PublicKey = <klucz publiczny pierwszego użytkownika>
AllowedIPs = 10.0.0.2/32

[Peer]
PublicKey = <klucz publiczny drugiego użytkownika>
AllowedIPs = 10.0.0.3/32

[Peer]
PublicKey = <klucz publiczny trzeciego użytkownika>
AllowedIPs = 10.0.0.4/32
```

Uruchom WireGuard:

```bash
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
```

## 12. Monitoring i logi

Sprawdzanie statusu:

```bash
sudo supervisorctl status anydataset
```

Sprawdzanie logów:

```bash
sudo tail -f /var/log/anydataset/out.log
sudo tail -f /var/log/anydataset/err.log
```

## 13. Automatyczne kopie zapasowe

Dodaj skrypt kopii zapasowej w `/opt/anydataset/backup.sh`:

```bash
#!/bin/bash
# Skrypt tworzenia kopii zapasowej

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/anydataset"
BACKUP_FILE="$BACKUP_DIR/anydataset_$TIMESTAMP.tar.gz"

# Upewnij się, że folder kopii zapasowych istnieje
mkdir -p $BACKUP_DIR

# Tworzenie kopii zapasowej
tar -czf $BACKUP_FILE /opt/anydataset/backend/uploads /opt/anydataset/backend/ready

# Usuwanie starych kopii (starszych niż 30 dni)
find $BACKUP_DIR -name "anydataset_*.tar.gz" -type f -mtime +30 -delete

echo "Kopia zapasowa utworzona: $BACKUP_FILE"
```

Dodaj zadanie cron:

```bash
sudo crontab -e
```

Dodaj linię:

```
0 2 * * * /opt/anydataset/backup.sh > /var/log/anydataset/backup.log 2>&1
```

## 14. Automatyczny restart usługi w przypadku awarii

Supervisor jest skonfigurowany tak, aby automatycznie uruchamiać backend po awarii, dzięki opcji `autorestart=true`.

## 15. Zabezpieczenia dodatkowe

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
sudo ufw allow 51820/udp  # Dla WireGuard VPN
sudo ufw enable
```

## 16. Optymalizacja wydajności

### Konfiguracja cache dla Nginx

Dodaj do konfiguracji Nginx (w bloku http):

```nginx
http {
    # Dodaj na początku sekcji http
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=anydataset_cache:10m max_size=1g inactive=60m;
    proxy_temp_path /var/cache/nginx/temp;
    
    # Reszta konfiguracji...
}
```

W bloku lokalizacji API:

```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    # Pozostałe ustawienia proxy...
    
    # Dodaj cache dla odpowiedzi GET, które nie zmieniają się często
    proxy_cache anydataset_cache;
    proxy_cache_valid 200 10m;
    proxy_cache_methods GET;
    proxy_cache_bypass $http_pragma $http_authorization;
    add_header X-Cache-Status $upstream_cache_status;
}
```

## Uwagi dotyczące UI/UX w instrukcji rewrite

Instrukcja rewrite frontend w FRONTEND_REWRITE.md zawiera kompletne informacje na temat:

1. Struktury komponentów UI/UX
2. Zgodności z designem shadcn/ui
3. Responsywności dla wszystkich urządzeń (ważne dla zespołu w podróży)
4. Dostępności (accessibility)
5. Obsługi WebSocketów do aktualizacji statusu w czasie rzeczywistym
6. Interakcji z API backendu

Dodatkowo należy zwrócić uwagę na:

1. Zmianę adresu API z `http://localhost:8000` na `https://api.anydata.libraxis.cloud` w pliku `.env.local` frontendu
2. Konfigurację WebSocket do używania bezpiecznego protokołu WSS zamiast WS
3. Zdefiniowanie limitu wielkości plików (obecnie 100MB w konfiguracji Nginx)
4. Komunikaty ładowania/błędów są zaimplementowane we wszystkich komponentach

## Podsumowanie konfiguracji dla zespołu w podróży

1. **Szybki dostęp z dowolnego miejsca**:
   - Frontend i backend dostępne przez HTTPS pod adresami anydata.libraxis.cloud i api.anydata.libraxis.cloud
   - Zoptymalizowane ładowanie frontendu dzięki statycznemu eksportowi Next.js
   - Responsywny UI działający na laptopach, tabletach i telefonach

2. **Bezpieczeństwo**:
   - Szyfrowanie SSL dla całej komunikacji
   - Opcjonalne uwierzytelnianie użytkowników
   - VPN dla dostępu administracyjnego
   - Fail2ban i firewall dla ochrony przed atakami

3. **Współdzielenie zasobów**:
   - Wspólne klucze API dla modeli LLM na backendzie
   - Współdzielony system plików dla przesłanych i przetworzonych danych
   - Centralne repozytorium przetworzonych wyników

4. **Zarządzanie zdalne**:
   - Skrypty aktualizacji uruchamiane przez SSH
   - Automatyczne kopie zapasowe
   - Monitoring stanu i logów przez zabezpieczony interfejs

(c)2025 by M&K