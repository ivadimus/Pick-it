# Развёртывание Pick-it на сервере

Игра — **статический сайт** (HTML, CSS, JS, PNG). Бэкенд не нужен.

## Сборка папки для загрузки

```bash
npm run build:web
```

Или в PowerShell из корня проекта:

```powershell
.\scripts\build-web.ps1
```

Готовая копия появится в каталоге **`web/`**. Загрузите **всё содержимое** `web/` на хостинг (FTP, SFTP, панель, S3 + CloudFront и т.д.).

## Требования к серверу

- Любой статический хостинг: Apache, Nginx, IIS, GitHub Pages, Netlify, Vercel, объектное хранилище.
- Главная страница: `index.html` в корне загруженной папки.
- Пути в проекте **относительные** (`Assets/...`, `css/...`) — удобно класть игру в **корень домена** (`https://example.com/`).

### Подпапка на сервере

Если игра лежит, например, в `https://example.com/games/pick-it/`, в `<head>` файла `index.html` перед сборкой можно добавить:

```html
<base href="/games/pick-it/" />
```

Пересоберите `npm run build:web` после правки.

## Apache

В сборку входит **`web/.htaccess`** (кэш для картинок/CSS/JS, `index.html` как индекс).

## Nginx (пример)

```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/pick-it;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(png|jpg|css|js)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

## Локальная проверка перед загрузкой

```bash
npx --yes serve web -l 3000
```

Откройте `http://localhost:3000`.

## Что не включать на сервер

Не заливайте исходники разработки, если заливаете только `web/`: папки `scripts/`, `deploy/`, корневой `node_modules` не нужны на хостинге — только содержимое **`web/`**.
