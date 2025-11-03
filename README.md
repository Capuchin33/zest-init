# Zest Playwright Init

Ініціалізатор для швидкого налаштування Zest Playwright.

## Встановлення/запуск

```bash
npm init zest-pw@latest
```

Це викликає пакет `create-зest-pw` і запускає інтерактивні питання. Ви можете обрати:
- встановлювати чи ні `@playwright/test` і браузери
- створювати чи ні `playwright.config.ts`
- додавати чи ні приклад тесту у `tests/`
- створювати чи ні `zest.config.ts`

Завжди перевіряються і за потреби додаються dev-залежності: `@zest-pw/test`, `typescript`, `@types/node` (вже встановлені — пропускаються). Створення `zest.config.ts` тепер також можна вимкнути.

### Неінтерактивний режим (прапори)

```bash
# Прийняти значення за замовчуванням (так для всього)
npm init zest-pw@latest -- --yes

# Вимкнути встановлення Playwright і браузерів
npm init zest-pw@latest -- --no-playwright

# Не створювати playwright.config.ts
npm init zest-pw@latest -- --no-config

# Не додавати приклад тесту
npm init zest-pw@latest -- --no-example

# Не створювати zest.config.ts
npm init zest-pw@latest -- --no-zest-config

# Комбінування прапорів
npm init zest-pw@latest -- --yes --no-example
```


Після установки запустіть тести:
```bash
npx playwright test
```

## Усунення проблем

- Переконайтесь, що встановлена Node.js >= 16
- Якщо браузери не встановились: `npx playwright install --force`
- На Windows запустіть термінал від імені адміністратора, якщо є помилки доступу

