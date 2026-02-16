import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { DeepSeekService } from '../services/deepseek.service';
import { ProductModel } from '../models/Product';

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'invoices');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    if (!ok) {
      return cb(new Error('Недопустимый тип файла. Разрешены изображения и PDF.'));
    }
    cb(null, true);
  },
});

export const ocrRouter = Router();

ocrRouter.use(authMiddleware);

ocrRouter.post('/invoice', upload.array('files'), async (req: AuthRequest, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) {
    return res.status(400).json({ message: 'Файлы не переданы' });
  }

  const service = new DeepSeekService();

  try {
    let combinedDisplay = '';
    let combinedParsing = '';

    for (const file of files) {
      const result = await service.recognizeInvoice(file.path);

      if (result.rawTextForDisplay) {
        combinedDisplay += (combinedDisplay ? '\n\n' : '') + result.rawTextForDisplay;
      }
      if (result.rawTextForParsing) {
        combinedParsing += (combinedParsing ? '\n\n' : '') + result.rawTextForParsing;
      }
    }

    return res.json({
      rawTextForDisplay: combinedDisplay || combinedParsing || '',
      rawTextForParsing: combinedParsing || combinedDisplay || '',
    });
  } catch (err: any) {
    const message = typeof err?.message === 'string' ? err.message : 'OCR processing error';

    // Ожидаемые сообщения про PDF или похожие валидные ошибки -> 400
    if (
      message.includes('PDF пока не поддерживается') ||
      message.includes('PDF не удалось распознать через Yandex Vision') ||
      message.includes('PDF не удалось распознать') ||
      message.includes('Документ не удалось распознать') ||
      message.includes('Формат HEIC/HEIF пока не поддерживается') ||
      message.includes('Недопустимый тип файла')
    ) {
      return res.status(400).json({ message });
    }

    console.error('[OCR] Unexpected error:', err);
    return res.status(500).json({ message: 'Ошибка OCR на сервере', detail: message });
  }
});

// Простая структура черновика накладной для фронта
interface InvoiceDraftItem {
  name: string;
  sku?: string;
  quantity: number;
  unit: string;
  price: number;
  amount: number;
  // Необязательные приходные цены, если удалось сопоставить с товаром
  purchasePriceCash?: number;
  purchasePriceCashless?: number;
}

interface InvoiceDraft {
  number: string;
  date: string | null; // ISO-строка или null
  supplier: string;
  client: string;
  items: InvoiceDraftItem[];
}

// Очень простой парсер под текущий формат счёта, чтобы быстро получить черновик
function parseInvoiceText(
  rawText: string,
  opts?: {
    debug?: boolean;
  }
): InvoiceDraft & { __debug?: any } {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let number = '';
  let date: string | null = null;
  let supplier = '';
  let client = '';
  const items: InvoiceDraftItem[] = [];

  const headerLine = lines.find((l) => /Счет на оплату/i.test(l));
  if (headerLine) {
    const numMatch = headerLine.match(/№\s*(\S+)/i);
    if (numMatch) {
      number = numMatch[1];
    }
    // Пробуем вытащить дату формата "от 26 ноября 2025 г."
    const dateMatch = headerLine.match(/от\s+(\d{1,2})\s+([А-Яа-я]+)\s+(\d{4})/i);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const monthName = dateMatch[2].toLowerCase();
      const year = parseInt(dateMatch[3], 10);

      const monthMap: Record<string, number> = {
        января: 0,
        февраля: 1,
        марта: 2,
        апреля: 3,
        мая: 4,
        июня: 5,
        июля: 6,
        августа: 7,
        сентября: 8,
        октября: 9,
        ноября: 10,
        декабря: 11,
      };

      const m = Object.keys(monthMap).find((name) => monthName.startsWith(name.slice(0, 4)) || name.startsWith(monthName));
      if (m !== undefined) {
        const jsDate = new Date(year, monthMap[m], day);
        if (!isNaN(jsDate.getTime())) {
          // Вернём ISO-дату вида YYYY-MM-DD, чтобы удобно подставлять в input[type=date]
          date = jsDate.toISOString().slice(0, 10);
        }
      }
    }
  }

  const supplierIndex = lines.findIndex((l) => /^Поставщик/i.test(l));
  if (supplierIndex !== -1) {
    const supplierLine = lines[supplierIndex];
    const afterLabel = supplierLine.replace(/^Поставщик/i, '').trim();
    if (afterLabel) {
      // "Поставщик ООО ..." в одной строке
      supplier = afterLabel.replace(/^[:,-]+/, '').trim();
    } else {
      // Следующая непустая строка после слова "Поставщик"
      for (let i = supplierIndex + 1; i < lines.length; i++) {
        const candidate = lines[i].trim();
        if (!candidate) continue;
        // Останавливаемся, если наткнулись на другой крупный заголовок
        if (/^Покупатель|^Основание|^№\s*$|^Товары \(работы, услуги\)/i.test(candidate)) break;
        supplier = candidate;
        break;
      }
    }
  }

  const clientIndex = lines.findIndex((l) => /^Покупатель/i.test(l));
  if (clientIndex !== -1) {
    const clientLine = lines[clientIndex];
    const afterLabel = clientLine.replace(/^Покупатель/i, '').trim();
    if (afterLabel) {
      client = afterLabel.replace(/^[:,-]+/, '').trim();
    } else {
      for (let i = clientIndex + 1; i < lines.length; i++) {
        const candidate = lines[i].trim();
        if (!candidate) continue;
        if (/^Поставщик|^Основание|^№\s*$|^Товары \(работы, услуги\)/i.test(candidate)) break;
        client = candidate;
        break;
      }
    }
  }

  // Нормализация названий позиций, чтобы ловить типичные OCR-искажения
  const normalizeItemName = (name: string): string => {
    const raw = name.trim();
    if (!raw) return raw;

    const lower = raw.toLowerCase();
    const letters = lower.replace(/[^а-яa-z]/g, '');

    // Доставка: ловим "доставка" и типичные искажения типа "доетана", "достаака" и т.п.
    const looksLikeDelivery =
      letters.includes('доставка') ||
      letters.includes('доет') ||
      (letters.startsWith('дост') && letters.length <= 12);

    if (looksLikeDelivery) {
      return 'Доставка';
    }

    return raw;
  };

  // Определяем, с какой строки начинается таблица товаров,
  // чтобы не пытаться разбирать банковские реквизиты как позиции.
  const tableStartIndex = (() => {
    // Разные шаблоны могут иметь заголовки:
    // - "Товары (работы, услуги)"
    // - "Товары" / "Товары (работы, услуги" без закрывающей скобки
    // - иногда OCR рвёт строку
    const idx = lines.findIndex((l) => /\bТовары\b/i.test(l) && /услуг|работ/i.test(l));
    if (idx !== -1) return idx + 1;

    const idx2 = lines.findIndex((l) => /\bТовары\b/i.test(l));
    if (idx2 !== -1) return idx2 + 1;

    return 0;
  })();

  const isTableStopLine = (l: string): boolean => {
    return /^(Итого:|Всего\s+наименований|Всего\s+к\s+оплате|Руководитель|Бухгалтер)/i.test(l);
  };

  const isTableHeaderLine = (l: string): boolean => {
    return /^(№|N\s*№|Товары|Кол-во|Ед\.?\s*изм\.?|Цена|Сумма)$/i.test(l) || /Кол-во|Ед\.?\s*изм\.?|Цена|Сумма/i.test(l);
  };

  // Склеиваем строки таблицы, если OCR переносит название/единицу на следующую строку.
  // Логика: если строка начинается с номера позиции, считаем её началом.
  // Следующие строки, которые НЕ начинаются с номера позиции и не являются итогами/заголовками,
  // считаем продолжением текущей позиции.
  const mergedTableLines: string[] = [];
  let current: string | null = null;
  const startNum = (l: string) => /^\d+[|.]?\s+/.test(l) || /^\d+\|/.test(l);

  for (let i = tableStartIndex; i < lines.length; i++) {
    const l = lines[i];
    if (isTableStopLine(l)) {
      break;
    }
    if (isTableHeaderLine(l)) {
      continue;
    }

    if (startNum(l)) {
      if (current) mergedTableLines.push(current);
      current = l;
      continue;
    }

    if (current) {
      // продолжение позиции
      current = `${current} ${l}`.replace(/\s{2,}/g, ' ').trim();
    }
  }
  if (current) mergedTableLines.push(current);

  // Черновой разбор строк позиций.
  // 1) Специальный проход для формата, где каждая позиция идёт блоком из нескольких строк:
  //    № (отдельная строка), затем название, потом строка с количеством и единицей ("40 шт"),
  //    затем цена ("515,00") и сумма ("20 600,00").
  const usedLineIndexes = new Set<number>();

  for (let i = tableStartIndex; i < lines.length; i++) {
    const line = lines[i];

    // Пропускаем, если строка уже использована другим алгоритмом
    if (usedLineIndexes.has(i)) continue;
    if (isTableStopLine(line)) break;
    if (isTableHeaderLine(line)) continue;

    // Ищем строку, которая состоит только из номера позиции
    if (!/^\d+$/.test(line)) continue;

    const idx = parseInt(line, 10);
    if (!Number.isFinite(idx)) continue;

    const nameLine = lines[i + 1];
    const qtyUnitLine = lines[i + 2];
    const priceLine = lines[i + 3];
    const amountLine = lines[i + 4];

    if (!nameLine || !qtyUnitLine || !priceLine || !amountLine) continue;
    if (isTableStopLine(nameLine) || isTableStopLine(qtyUnitLine)) continue;

    // qtyUnitLine типа "40 шт", "200 пог. м", "1 рул" и т.п. —
    // берём только первое число как количество, остальное считаем произвольной единицей.
    const qtyUnitMatch = qtyUnitLine.match(/^(\d+(?:[\s.,]\d+)*)(?:\s+(.+))?$/i);
    if (!qtyUnitMatch) continue;

    const quantity = parseFloat(qtyUnitMatch[1].replace(/\s/g, '').replace(',', '.')) || 0;
    const unitRaw = (qtyUnitMatch[2] || '').trim();
    const unit = unitRaw || 'шт';

    const price = parseFloat(priceLine.replace(/\s/g, '').replace(',', '.')) || 0;
    const amount = parseFloat(amountLine.replace(/\s/g, '').replace(',', '.')) || 0;

    const name = normalizeItemName(nameLine.trim());

    if (name && quantity > 0) {
      items.push({ name, quantity, unit, price, amount });

      usedLineIndexes.add(i);
      usedLineIndexes.add(i + 1);
      usedLineIndexes.add(i + 2);
      usedLineIndexes.add(i + 3);
      usedLineIndexes.add(i + 4);
    }
  }

  const debugParsedLines: any[] = [];

  // 2) Разбор строк, которые идут одной строкой (в том числе после склейки переносов).
  //    Важно: единица измерения может быть любой (меш, лист, мец, рейс, уп/50шт, пог. м, и т.п.)
  //    и содержать 1-3 слова.
  for (const rawLine of mergedTableLines) {
    // Пропускаем явные служебные строки
    if (/Счет на оплату|Поставщик|Покупатель|Основание|Итого:|Всего к оплате/i.test(rawLine)) {
      continue;
    }

    // Специальный разбор строк вида:
    // "[1 Колесо ... 48400 | 8 | 130000] 2160000]"
    if (/^\[\s*\d+/.test(rawLine)) {
      const withoutBrackets = rawLine.replace(/^[\[]/, '').replace(/[\]]+/g, ' ').trim();
      const idxMatch = withoutBrackets.match(/^(\d+)\s+(.+)/);
      if (idxMatch) {
        const tail = idxMatch[2];
        const numMatches = tail.match(/\d[\d.,]*/g) || [];

        if (numMatches.length >= 3) {
          const qtyStr = numMatches[numMatches.length - 3];
          const priceStr = numMatches[numMatches.length - 2];
          const amountStr = numMatches[numMatches.length - 1];

          const firstNumPos = tail.search(/\d/);
          const namePart = firstNumPos > 0 ? tail.slice(0, firstNumPos) : tail;

          const nameRaw = namePart.replace(/[|]/g, ' ').trim();
          const name = normalizeItemName(nameRaw);
          const quantity = parseFloat(qtyStr.replace(/\s/g, '').replace(',', '.')) || 0;
          let price = parseFloat(priceStr.replace(/\s/g, '').replace(',', '.')) || 0;
          let amount = parseFloat(amountStr.replace(/\s/g, '').replace(',', '.')) || 0;

          if (price >= 100000) price = price / 100;
          if (amount >= 100000) amount = amount / 100;

          if (name && quantity > 0) {
            items.push({ name, quantity, unit: 'шт', price, amount });
            continue; // переходим к следующей строке
          }
        }
      }
    }

    // Убираем скобки и лишние пробелы, т.к. OCR часто добавляет [ ] и рвёт формат
    const cleaned = rawLine.replace(/[\[\]]/g, ' ').replace(/\s{2,}/g, ' ').trim();

    let parsed = false;

    // 1) Попробуем формат с колонками через '|':
    // "1 Товар | 8 | 1 200,00 | 21 600,00"
    if (rawLine.includes('|')) {
      const parts = rawLine
        .replace(/[\[\]]/g, ' ')
        .split('|')
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 3) {
        const first = parts[0];
        const numMatch = first.match(/^(\d+)\s+(.+)/);
        const qtyStr = parts[1];
        const priceStr = parts[2];
        const amountStr = parts[3] ?? parts[2];

        if (numMatch) {
          const name = normalizeItemName(numMatch[2].trim());
          const quantity = parseFloat(qtyStr.replace(/\s/g, '').replace(',', '.')) || 0;
          let price = parseFloat(priceStr.replace(/\s/g, '').replace(',', '.')) || 0;
          let amount = parseFloat(amountStr.replace(/\s/g, '').replace(',', '.')) || 0;

          // Грубая нормализация: если явно получились "лишние два нуля" (ошибка OCR/парсинга), делим на 100
          if (price >= 100000) {
            price = price / 100;
          }
          if (amount >= 100000) {
            amount = amount / 100;
          }

          if (name && quantity > 0) {
            items.push({ name, quantity, unit: 'шт', price, amount });
            parsed = true;
            if (opts?.debug) {
              debugParsedLines.push({ source: rawLine, method: 'pipe', name, quantity, unit: 'шт', price, amount });
            }
          }
        }
      }
    }

    if (parsed) {
      continue;
    }

    // 2) Запасной вариант: regex, если нет '|' или split не сработал
    // Пример ожидаемого формата (после OCR):
    // "1 ВЕТОНИТ LR+ ... 7 мец 772,00 5 404,00"
    // "24 Полотно ... 20 м.п 30,00 600,00"
    // "35 Доставка 1 рейс 3 500,00 3 500,00"
    const line = cleaned;
    const m = line.match(
      /^(\d+)[|.]?\s+(.+?)\s+(\d+(?:[\s.,]\d+)*)\s+([a-zа-я0-9./-]+(?:\s+[a-zа-я0-9./-]+){0,2})\s+(\d+(?:[\s.,]\d+)*)\s+(\d+(?:[\s.,]\d+)*)$/i
    );
    if (!m) continue;

    const name = normalizeItemName(m[2].trim());
    const quantity = parseFloat(m[3].replace(/\s/g, '').replace(',', '.')) || 0;
    const unit = (m[4] || '').trim() || 'шт';
    let price = parseFloat(m[5].replace(/\s/g, '').replace(',', '.')) || 0;
    let amount = parseFloat(m[6].replace(/\s/g, '').replace(',', '.')) || 0;

    if (price >= 100000) {
      price = price / 100;
    }
    if (amount >= 100000) {
      amount = amount / 100;
    }

    if (!name) continue;

    items.push({ name, quantity, unit, price, amount });
    if (opts?.debug) {
      debugParsedLines.push({ source: rawLine, method: 'regex', name, quantity, unit, price, amount });
    }
  }

  // 3) Если позиций почти нет, пробуем более устойчивый разбор строк таблицы
  // (на некоторых фото Tesseract рвёт единицы измерения и числа).
  if (items.length <= 1 && mergedTableLines.length > 0) {
    const tryParseFromEnd = (src: string) => {
      let rest = src
        .replace(/[\[\]]/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

      // убираем ведущий индекс позиции
      rest = rest.replace(/^\d+[|.]?\s+/, '').trim();

      const takeLastNumber = (): number | null => {
        const m = rest.match(/(\d[\d\s.,]*)\s*$/);
        if (!m) return null;
        const raw = m[1];
        rest = rest.slice(0, m.index).trim();
        return parseFloat(String(raw).replace(/\s/g, '').replace(',', '.')) || 0;
      };

      const amount = takeLastNumber();
      const price = takeLastNumber();
      if (amount == null || price == null) return null;

      // хвост теперь примерно: "... <qty> <unit>" или "... <qty>" (unit потерян)
      const qtyMatch = rest.match(/(\d+(?:[\s.,]\d+)*)\s*$/);
      if (!qtyMatch) return null;
      const qtyRaw = qtyMatch[1];
      const quantity = parseFloat(String(qtyRaw).replace(/\s/g, '').replace(',', '.')) || 0;
      const beforeQty = rest.slice(0, qtyMatch.index).trim();
      if (quantity <= 0) return null;

      // unit: берём последние 1-3 токена (если есть), иначе 'шт'
      const tokens = beforeQty.split(' ').filter(Boolean);
      let unit = 'шт';
      let namePart = beforeQty;

      if (tokens.length >= 2) {
        const candidateUnit = tokens.slice(-2).join(' ');
        const candidateUnit1 = tokens.slice(-1).join(' ');

        const isUnitish = (u: string) => /^[a-zа-я0-9./'-]{1,10}(?:\s+[a-zа-я0-9./'-]{1,10})?$/i.test(u);

        if (isUnitish(candidateUnit)) {
          unit = candidateUnit;
          namePart = tokens.slice(0, -2).join(' ').trim();
        } else if (isUnitish(candidateUnit1)) {
          unit = candidateUnit1;
          namePart = tokens.slice(0, -1).join(' ').trim();
        }
      }

      const name = normalizeItemName(namePart.trim());
      if (!name) return null;

      return { name, quantity, unit, price, amount } as InvoiceDraftItem;
    };

    const nextItems: InvoiceDraftItem[] = [];
    for (const l of mergedTableLines) {
      if (isTableStopLine(l)) break;
      if (!/^\d+[|.]?\s+/.test(l) && !/^\d+\|/.test(l)) continue;
      const parsed = tryParseFromEnd(l);
      if (parsed) {
        nextItems.push(parsed);
        if (opts?.debug) {
          debugParsedLines.push({ source: l, method: 'from_end', ...parsed });
        }
      }
    }

    if (nextItems.length > items.length) {
      items.length = 0;
      items.push(...nextItems);
    }
  }

  // 4) Фоллбек для шаблонов, где каждая позиция идёт блоком из нескольких строк:
  //    "<n> <name>" -> "<qty> <unit>" -> "<price>" -> "<amount>"
  //    + OCR-ошибки вроде "в <name>" (вместо "8 <name>")
  //    + пропуск количества (вычисляем qty = amount / price)
  if (items.length <= 1) {
    const parseMoney = (s: string): number => {
      return parseFloat(String(s || '').replace(/\s/g, '').replace(',', '.')) || 0;
    };

    const looksLikeMoneyLine = (s: string): boolean => {
      const t = String(s || '').trim();
      if (!t) return false;
      // допускаем 2 500.00, 1 500,00, 73,00
      return /^\d[\d\s]*([.,]\d{2})?$/.test(t);
    };

    const looksLikeQtyUnitLine = (s: string): { qty: number; unit: string } | null => {
      const t = String(s || '').trim();
      const m = t.match(/^(\d+(?:[\s.,]\d+)*)\s+(.+)$/i);
      if (!m) return null;
      const qty = parseMoney(m[1]);
      const unit = String(m[2] || '').trim();
      if (!qty || qty <= 0) return null;
      if (!unit) return null;
      return { qty, unit };
    };

    const normalizeIndexLine = (s: string): string => {
      // OCR иногда распознаёт "8" как "в".
      const t = String(s || '').trim();
      if (/^[вВ]\s+/.test(t)) {
        return `8 ${t.slice(1).trim()}`;
      }
      if (/^\d+\|/.test(t)) {
        return t.replace(/^([0-9]+)\|\s*/, '$1 ');
      }
      return t;
    };

    type Tmp = {
      nameParts: string[];
      quantity: number | null;
      unit: string | null;
      price: number | null;
      amount: number | null;
      source: string[];
    };

    const flush = (cur: Tmp, out: InvoiceDraftItem[]) => {
      const name = normalizeItemName(cur.nameParts.join(' ').replace(/\s{2,}/g, ' ').trim());
      if (!name) return;

      let quantity = cur.quantity ?? 0;
      const unit = (cur.unit || '').trim() || 'шт';
      const price = cur.price ?? 0;
      const amount = cur.amount ?? 0;

      if ((!quantity || quantity <= 0) && price > 0 && amount > 0) {
        const q = amount / price;
        const rounded = Math.round(q * 1000) / 1000;
        if (Number.isFinite(rounded) && rounded > 0) {
          quantity = rounded;
        }
      }

      if (!quantity || quantity <= 0) return;
      if (!price || price <= 0) return;
      if (!amount || amount <= 0) {
        // если суммы нет, считаем
        out.push({ name, quantity, unit, price, amount: quantity * price });
        return;
      }

      out.push({ name, quantity, unit, price, amount });
    };

    const blockItems: InvoiceDraftItem[] = [];
    let cur: Tmp | null = null;

    const nextMeaningful = (start: number): { idx: number; line: string } | null => {
      for (let j = start; j < lines.length; j++) {
        const raw = lines[j];
        if (isTableStopLine(raw)) return null;
        if (isTableHeaderLine(raw)) continue;
        const ln = normalizeIndexLine(raw);
        if (!ln) continue;
        return { idx: j, line: ln };
      }
      return null;
    };

    for (let i = tableStartIndex; i < lines.length; i++) {
      const raw = lines[i];
      if (isTableStopLine(raw)) break;
      if (isTableHeaderLine(raw)) continue;
      const l = normalizeIndexLine(raw);
      if (!l) continue;

      const idxMatch = l.match(/^(\d+)[|.]?\s+(.+)$/);
      if (idxMatch) {
        // Важно: "7 мец" / "5 меш" — это НЕ новая позиция, а qty+unit.
        // Поэтому считаем началом позиции только если дальше реально идёт структура блока:
        // qty+unit -> price -> amount.
        const m1 = nextMeaningful(i + 1);
        const m2 = m1 ? nextMeaningful(m1.idx + 1) : null;
        const m3 = m2 ? nextMeaningful(m2.idx + 1) : null;

        const looksLikeBlock =
          !!m1 &&
          !!m2 &&
          !!m3 &&
          !!looksLikeQtyUnitLine(m1.line) &&
          looksLikeMoneyLine(m2.line) &&
          looksLikeMoneyLine(m3.line);

        if (looksLikeBlock) {
          if (cur) flush(cur, blockItems);
          cur = { nameParts: [idxMatch[2].trim()], quantity: null, unit: null, price: null, amount: null, source: [raw] };
          continue;
        }
      }

      if (!cur) continue;
      cur.source.push(raw);

      const qtyUnit = looksLikeQtyUnitLine(l);
      if (qtyUnit && cur.quantity == null) {
        cur.quantity = qtyUnit.qty;
        cur.unit = qtyUnit.unit;
        continue;
      }

      // Иногда единица идёт отдельной строкой (например "ЛИСТ")
      if (cur.unit == null && /^[a-zа-я0-9./'-]{2,15}$/i.test(l) && !/\d/.test(l)) {
        cur.unit = l;
        continue;
      }

      if (looksLikeMoneyLine(l)) {
        const val = parseMoney(l);
        if (val > 0 && cur.price == null) {
          cur.price = val;
          continue;
        }
        if (val > 0 && cur.price != null && cur.amount == null) {
          cur.amount = val;
          continue;
        }
      }

      // Остальное считаем продолжением названия
      cur.nameParts.push(l);
    }
    if (cur) flush(cur, blockItems);

    if (blockItems.length > items.length) {
      items.length = 0;
      items.push(...blockItems);
      if (opts?.debug) {
        for (const it of blockItems) {
          debugParsedLines.push({ method: 'block', ...it });
        }
      }
    }
  }

  // Гарантируем, что все строки "Доставка" идут в конце списка позиций черновика
  if (items.length > 0) {
    const delivery: InvoiceDraftItem[] = [];
    const regular: InvoiceDraftItem[] = [];

    for (const it of items) {
      if (it.name === 'Доставка') {
        delivery.push(it);
      } else {
        regular.push(it);
      }
    }

    if (delivery.length > 0) {
      items.length = 0;
      items.push(...regular, ...delivery);
    }
  }

  const draft: InvoiceDraft & { __debug?: any } = { number, date, supplier, client, items };
  if (opts?.debug) {
    draft.__debug = {
      tableStartIndex,
      mergedTableLines,
      parsedLines: debugParsedLines,
    };
  }

  return draft;
}

// Парсинг распознанного текста в черновик накладной
ocrRouter.post('/parse', async (req: AuthRequest, res) => {
  const { rawText } = req.body || {};

  if (!rawText || typeof rawText !== 'string') {
    return res.status(400).json({ message: 'rawText is required' });
  }

  try {
    const debug = String((req as any).query?.debug || '') === '1';
    const draft = parseInvoiceText(rawText, { debug });

    // Подтягиваем товары из базы и пробуем подставить артикулы (sku) по названию
    const products = await ProductModel.find({ isActive: true })
      .select('sku name unit purchasePriceCash purchasePriceCashless lastSalePrice')
      .lean()
      .exec();

    const normalizeName = (name: string) => {
      return name
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ')
        .replace(/[<>"']/g, '')
        .replace(/[,.;:]+/g, '')
        .trim();
    };

    const tokenize = (name: string): string[] => {
      const normalized = normalizeName(name)
        .replace(/[,.;:()"'«»]/g, ' ')
        .replace(/[^0-9a-zа-я\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!normalized) return [];

      const parts = normalized
        .split(' ')
        .map((w) => w.trim())
        .filter(Boolean);

      const tokens: string[] = [];
      for (const p of parts) {
        const mixed = p.match(/^(\d+(?:[.,]\d+)?)([a-zа-я]+)$/i);
        if (mixed) {
          const num = String(mixed[1]).replace(',', '.');
          const unit = String(mixed[2]);
          if (num) tokens.push(num);
          if (unit && unit.length >= 2) tokens.push(unit);
          continue;
        }

        const isNumericish = /\d/.test(p);
        if (isNumericish) {
          tokens.push(p.replace(',', '.'));
          continue;
        }
        if (p.length >= 3) tokens.push(p);
      }

      return tokens;
    };

    const editDistance = (a: string, b: string) => {
      const s1 = String(a || '');
      const s2 = String(b || '');
      const m = s1.length;
      const n = s2.length;
      if (m === 0) return n;
      if (n === 0) return m;
      const dp: number[] = Array(n + 1)
        .fill(0)
        .map((_, i) => i);
      for (let i = 1; i <= m; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= n; j++) {
          const tmp = dp[j];
          const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
          dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
          prev = tmp;
        }
      }
      return dp[n];
    };

    const tokenMatch = (a: string, b: string): boolean => {
      if (!a || !b) return false;
      if (a === b) return true;

      const aHasNum = /\d/.test(a);
      const bHasNum = /\d/.test(b);
      if (aHasNum || bHasNum) {
        // числа считаем только точным совпадением
        return a === b;
      }

      const minLen = Math.min(a.length, b.length);
      if (minLen >= 5) {
        const d = editDistance(a, b);
        if (d <= 1) return true;
      }

      // мягкое включение (часто OCR добавляет/теряет суффиксы)
      if (a.length >= 4 && b.length >= 4) {
        if (a.includes(b) || b.includes(a)) return true;
      }

      return false;
    };

    // OCR-устойчивая похожесть названий: совпадение токенов (порядок не важен)
    const computeNameSimilarity = (a: string, b: string): number => {
      const ta = tokenize(a);
      const tb = tokenize(b);
      if (ta.length === 0 || tb.length === 0) return 0;

      const used = new Array(tb.length).fill(false);
      let matched = 0;

      for (const t of ta) {
        let found = false;
        for (let i = 0; i < tb.length; i++) {
          if (used[i]) continue;
          if (tokenMatch(t, tb[i])) {
            used[i] = true;
            matched += 1;
            found = true;
            break;
          }
        }
        if (!found) {
          // ничего
        }
      }

      // Важно: интерпретируем "95%" как покрытие токенов из OCR-строки.
      // Если OCR пропустил часть слов из полной карточки товара, но то, что распознал,
      // совпало — это считается высокой схожестью.
      const denom = ta.length || 1;
      return matched / denom;
    };

    const normalizedProducts = products.map((p) => ({
      sku: (p as any).sku as string | undefined,
      name: (p as any).name as string,
      unit: (p as any).unit as string,
      purchasePriceCash: (p as any).purchasePriceCash as number | undefined,
      purchasePriceCashless: (p as any).purchasePriceCashless as number | undefined,
      lastSalePrice: (p as any).lastSalePrice as number | undefined,
      norm: normalizeName((p as any).name as string),
      tokens: tokenize((p as any).name as string),
    }));

    for (const item of draft.items) {
      const rawName = typeof item.name === 'string' ? item.name.trim() : '';
      if (!rawName) continue;

      // Подстановка артикула ТОЛЬКО по схожести названия.
      // Если схожесть < 95% — не подставляем SKU (лучше пусто, чем неверно).
      let best: { p: (typeof normalizedProducts)[number] | null; score: number } = { p: null, score: 0 };
      let secondScore = 0;

      const itemNorm = normalizeName(rawName);

      for (const p of normalizedProducts) {
        const score = computeNameSimilarity(itemNorm, p.norm);

        if (score > best.score) {
          secondScore = best.score;
          best = { p, score };
        } else if (score > secondScore) {
          secondScore = score;
        }
      }

      const product = best.p;
      const CONFIDENCE_MIN = 0.95;
      const CONFIDENCE_MARGIN = 0.02;

      if (!product) continue;
      if (best.score < CONFIDENCE_MIN) continue;
      if (best.score - secondScore < CONFIDENCE_MARGIN) continue;

      item.sku = product.sku || item.sku;
      if (!item.unit || item.unit === 'шт') {
        item.unit = product.unit || item.unit || 'шт';
      }

      const qty = Number(item.quantity) || 0;

      // Если в карточке товара есть цены — подставляем их в черновик
      if (typeof product.lastSalePrice === 'number' && !Number.isNaN(product.lastSalePrice)) {
        item.price = product.lastSalePrice;
      }
      if (typeof product.purchasePriceCash === 'number' && !Number.isNaN(product.purchasePriceCash)) {
        item.purchasePriceCash = product.purchasePriceCash;
      }
      if (typeof product.purchasePriceCashless === 'number' && !Number.isNaN(product.purchasePriceCashless)) {
        item.purchasePriceCashless = product.purchasePriceCashless;
      }

      if (qty > 0 && typeof item.price === 'number' && !Number.isNaN(item.price)) {
        item.amount = qty * item.price;
      }
    }

    if (debug) {
      return res.json({ draft, rawText });
    }

    return res.json({ draft });
  } catch (err) {
    console.error('[OCR] Parse error:', err);
    return res.status(500).json({ message: 'Ошибка разбора текста накладной' });
  }
});
