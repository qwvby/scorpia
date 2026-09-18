import "dotenv/config";
import { createApp } from "./app";

const requiredEnv = ["DATABASE_URL", "JWT_SECRET"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Відсутня обов'язкова змінна середовища: ${key}. Перевірте файл .env.`);
    process.exit(1);
  }
}

const app = createApp();
const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`Scorpia API запущено на порту ${port}`);
});
