import fs from 'fs';
import path from 'path';

// Простейший генератор текстовых запросов для Global AI.
// Идея: есть шаблоны с плейсхолдерами и списки значений.
// На выходе получаем файл global_ai_queries.txt с большим числом вариантов.

const periods = [
  'сегодня',
  'вчера',
  'текущий месяц',
  'прошлый месяц',
  'последние 7 дней',
  'последние 30 дней',
  'этот год',
  'прошлый год',
  'первый квартал 2025 года',
  'второй квартал 2025 года',
  'третий квартал 2025 года',
  'четвёртый квартал 2025 года',
];

const drivers = ['Иванов', 'Петров', 'Сидоров', 'Алиев', 'Беков'];
const managers = ['Айжан', 'Кайрат', 'Анна', 'Марина', 'Дмитрий'];
const clients = ['ООО «Ромашка»', 'ТОО «Вектор»', 'ИП «СтройСклад»', 'ООО «МеталлПро»'];
const products = ['цемент М500', 'арматура 12мм', 'кирпич красный', 'шпаклёвка', 'гипсокартон'];

const templates: string[] = [
  // Общие накладные по периодам
  'Глобалснаб, сделай отчёт по накладным за {PERIOD}',
  'Глобалснаб, сколько накладных за {PERIOD} и на какую сумму?',
  'Глобалснаб, какой доход по накладным за {PERIOD}?',
  'Глобалснаб, сделай краткий отчёт по накладным за {PERIOD}',

  // Водители
  'Глобалснаб, сколько накладных сделал водитель {DRIVER} за {PERIOD}?',
  'Глобалснаб, какой оборот по накладным водителя {DRIVER} за {PERIOD}?',
  'Глобалснаб, какой доход по накладным водителя {DRIVER} за {PERIOD}?',
  'Глобалснаб, сравни водителей {DRIVER} и {DRIVER2} по количеству накладных за {PERIOD}',

  // Менеджеры
  'Глобалснаб, сколько накладных создал менеджер {MANAGER} за {PERIOD}?',
  'Глобалснаб, какой оборот по накладным менеджера {MANAGER} за {PERIOD}?',
  'Глобалснаб, какой доход по накладным менеджера {MANAGER} за {PERIOD}?',
  'Глобалснаб, сравни менеджеров {MANAGER} и {MANAGER2} по сумме накладных за {PERIOD}',

  // Клиенты
  'Глобалснаб, сколько накладных по клиенту {CLIENT} за {PERIOD}?',
  'Глобалснаб, какой оборот по клиенту {CLIENT} за {PERIOD}?',
  'Глобалснаб, какой доход по клиенту {CLIENT} за {PERIOD}?',
  'Глобалснаб, сравни клиентов {CLIENT} и {CLIENT2} по обороту за {PERIOD}',

  // Товары / склад
  'Глобалснаб, сколько продано товара {PRODUCT} за {PERIOD}?',
  'Глобалснаб, какой оборот по товару {PRODUCT} за {PERIOD}?',
  'Глобалснаб, какой доход по товару {PRODUCT} за {PERIOD}?',
  'Глобалснаб, сравни продажи товаров {PRODUCT} и {PRODUCT2} за {PERIOD}',

  // Финансы
  'Глобалснаб, сделай отчёт по прибыли и расходам за {PERIOD}',
  'Глобалснаб, какой общий доход по всем накладным за {PERIOD}?',
  'Глобалснаб, какой средний доход на одну накладную за {PERIOD}?',
];

function generateQueries(): string[] {
  const out: string[] = [];

  for (const t of templates) {
    for (const p of periods) {
      if (t.includes('{DRIVER2}')) {
        for (let i = 0; i < drivers.length; i++) {
          for (let j = 0; j < drivers.length; j++) {
            if (i === j) continue;
            const q = t
              .replace('{PERIOD}', p)
              .replace('{DRIVER}', drivers[i])
              .replace('{DRIVER2}', drivers[j]);
            out.push(q);
          }
        }
      } else if (t.includes('{DRIVER}')) {
        for (const d of drivers) {
          const q = t.replace('{PERIOD}', p).replace('{DRIVER}', d);
          out.push(q);
        }
      } else if (t.includes('{MANAGER2}')) {
        for (let i = 0; i < managers.length; i++) {
          for (let j = 0; j < managers.length; j++) {
            if (i === j) continue;
            const q = t
              .replace('{PERIOD}', p)
              .replace('{MANAGER}', managers[i])
              .replace('{MANAGER2}', managers[j]);
            out.push(q);
          }
        }
      } else if (t.includes('{MANAGER}')) {
        for (const m of managers) {
          const q = t.replace('{PERIOD}', p).replace('{MANAGER}', m);
          out.push(q);
        }
      } else if (t.includes('{CLIENT2}')) {
        for (let i = 0; i < clients.length; i++) {
          for (let j = 0; j < clients.length; j++) {
            if (i === j) continue;
            const q = t
              .replace('{PERIOD}', p)
              .replace('{CLIENT}', clients[i])
              .replace('{CLIENT2}', clients[j]);
            out.push(q);
          }
        }
      } else if (t.includes('{CLIENT}')) {
        for (const c of clients) {
          const q = t.replace('{PERIOD}', p).replace('{CLIENT}', c);
          out.push(q);
        }
      } else if (t.includes('{PRODUCT2}')) {
        for (let i = 0; i < products.length; i++) {
          for (let j = 0; j < products.length; j++) {
            if (i === j) continue;
            const q = t
              .replace('{PERIOD}', p)
              .replace('{PRODUCT}', products[i])
              .replace('{PRODUCT2}', products[j]);
            out.push(q);
          }
        }
      } else if (t.includes('{PRODUCT}')) {
        for (const pr of products) {
          const q = t.replace('{PERIOD}', p).replace('{PRODUCT}', pr);
          out.push(q);
        }
      } else if (t.includes('{PERIOD}')) {
        const q = t.replace('{PERIOD}', p);
        out.push(q);
      } else {
        out.push(t);
      }
    }
  }

  // Удаляем дубликаты, если вдруг появились
  const unique = Array.from(new Set(out));
  return unique;
}

function main() {
  const queries = generateQueries();
  const targetPath = path.join(__dirname, 'global_ai_queries.txt');
  fs.writeFileSync(targetPath, queries.join('\n'), 'utf8');
  console.log(`Generated ${queries.length} queries -> ${targetPath}`);
}

main();
