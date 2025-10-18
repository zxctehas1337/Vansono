# Настройка Google и Yandex OAuth для мессенджера Sontha

## Обзор изменений

✅ **Удалено:**
- VK ID SDK и все связанные компоненты
- VK авторизация из клиента и сервера
- Тестовый файл vk-settings-test.html

✅ **Добавлено:**
- Google OAuth интеграция
- Yandex OAuth интеграция
- Новые кнопки входа в UI
- API endpoints для OAuth callbacks

## Настройка Google OAuth

### 1. Создание Google OAuth приложения

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите Google+ API
4. Перейдите в "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Выберите "Web application"
6. Добавьте авторизованные URI перенаправления:
   - `http://localhost:3000` (для разработки)
   - `https://yourdomain.com` (для продакшена)

### 2. Обновление конфигурации

Замените в файле `config.env`:
```env
GOOGLE_CLIENT_ID=ваш_google_client_id
GOOGLE_CLIENT_SECRET=ваш_google_client_secret
```

Замените в файле `src/js/social-auth.js`:
```javascript
const GOOGLE_CONFIG = {
  clientId: 'ваш_google_client_id',
  redirectUri: window.location.origin
};
```

## Настройка Yandex OAuth

### 1. Создание Yandex OAuth приложения

1. Перейдите в [Yandex OAuth](https://oauth.yandex.ru/)
2. Нажмите "Создать приложение"
3. Заполните форму:
   - Название: Sontha Messenger
   - Описание: Secure messaging application
   - Платформы: Web services
   - Callback URI: `http://localhost:3000` (для разработки)
4. Получите Client ID и Client Secret

### 2. Обновление конфигурации

Замените в файле `config.env`:
```env
YANDEX_CLIENT_ID=ваш_yandex_client_id
YANDEX_CLIENT_SECRET=ваш_yandex_client_secret
```

Замените в файле `src/js/social-auth.js`:
```javascript
const YANDEX_CONFIG = {
  clientId: 'ваш_yandex_client_id',
  redirectUri: window.location.origin
};
```

## Запуск приложения

1. Установите зависимости:
```bash
npm install
```

2. Запустите сервер:
```bash
npm start
```

3. Откройте браузер и перейдите на `http://localhost:3000`

## Тестирование

### Google OAuth
- Нажмите кнопку "Continue with Google"
- Должно открыться окно авторизации Google
- После успешной авторизации пользователь должен войти в систему

### Yandex OAuth
- Нажмите кнопку "Continue with Yandex"
- Должно открыться popup окно с авторизацией Yandex
- После успешной авторизации пользователь должен войти в систему

## Структура файлов

```
src/
├── js/
│   └── social-auth.js     # Новая логика Google/Yandex OAuth
├── css/
│   └── auth.css           # Стили для новых кнопок
└── index.html             # Обновленный HTML с новыми кнопками

server/
└── server.js              # Обновленный сервер с поддержкой новых OAuth

config.env                  # Конфигурация OAuth
```

## Возможные проблемы

1. **CORS ошибки**: Убедитесь, что callback URI правильно настроены в OAuth приложениях
2. **Popup блокировка**: Некоторые браузеры могут блокировать popup окна
3. **HTTPS**: В продакшене обязательно используйте HTTPS для OAuth

## Безопасность

- Никогда не коммитьте реальные Client ID и Client Secret в репозиторий
- Используйте переменные окружения для продакшена
- Регулярно обновляйте секретные ключи
