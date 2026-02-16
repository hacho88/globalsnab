import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { DeepSeekService } from '../services/deepseek.service';
import { InvoiceModel } from '../models/Invoice';
import { DriverModel } from '../models/Driver';
import { UserModel } from '../models/User';

export const aiRouter = Router();

const deepseek = new DeepSeekService();

aiRouter.use(authMiddleware);

interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

const parseInvoiceDateRange = (text: string): DateRange | null => {
  const lower = text.toLowerCase();

  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (lower.includes('сегодня')) {
    const from = startOfDay(today);
    const to = endOfDay(today);
    return { from, to, label: 'сегодня' };
  }

  if (lower.includes('вчера')) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    const from = startOfDay(d);
    const to = endOfDay(d);
    return { from, to, label: 'вчера' };
  }

  // Текущий месяц: "за текущий месяц", "за этот месяц", просто "за месяц"
  if (
    /за\s+текущ[ийего]+\s+месяц/iu.test(lower) ||
    /за\s+этот\s+месяц/iu.test(lower) ||
    /за\s+месяц/iu.test(lower)
  ) {
    const year = today.getFullYear();
    const month = today.getMonth();
    const from = new Date(year, month, 1, 0, 0, 0, 0);
    const to = endOfDay(today);
    return { from, to, label: 'текущий месяц' };
  }

  // Прошлый месяц: "за прошлый месяц", "за предыдущий месяц"
  if (/за\s+прошл[ыйого]+\s+месяц/iu.test(lower) || /за\s+предыдущий\s+месяц/iu.test(lower)) {
    const year = today.getFullYear();
    const month = today.getMonth();
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const from = new Date(prevYear, prevMonth, 1, 0, 0, 0, 0);
    const to = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999); // последний день прошлого месяца
    return { from, to, label: 'прошлый месяц' };
  }

  // Диапазон вида "с 01.12.2025 по 10.12.2025"
  const rangeMatch = lower.match(/с\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})[^\d]+по\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4})/);
  const parseDate = (s: string): Date | null => {
    const parts = s.replace(/,/g, '.').replace(/\//g, '.').split('.');
    if (parts.length !== 3) return null;
    let [dd, mm, yy] = parts.map((p) => parseInt(p, 10));
    if (!dd || !mm || !yy) return null;
    if (yy < 100) yy += 2000;
    const d = new Date(yy, mm - 1, dd);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  };

  if (rangeMatch) {
    const d1 = parseDate(rangeMatch[1]);
    const d2 = parseDate(rangeMatch[2]);
    if (d1 && d2) {
      const from = startOfDay(d1);
      const to = endOfDay(d2);
      return { from, to, label: `с ${rangeMatch[1]} по ${rangeMatch[2]}` };
    }
  }

  // Одна дата вида "за 01.12.2025"
  const singleMatch = lower.match(/(\d{1,2}[./]\d{1,2}[./]\d{2,4})/);
  if (singleMatch) {
    const d = parseDate(singleMatch[1]);
    if (d) {
      const from = startOfDay(d);
      const to = endOfDay(d);
      return { from, to, label: singleMatch[1] };
    }
  }

  return null;
};

const inferInvoiceDateRangeFromHistory = (
  history: { role: 'user' | 'assistant'; content: string }[] | undefined,
): DateRange | null => {
  if (!Array.isArray(history) || history.length === 0) return null;

  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (!h || h.role !== 'user' || !h.content) continue;
    const r = parseInvoiceDateRange(h.content);
    if (r) return r;
  }

  return null;
};

const isInvoiceTopic = (text: string) => {
  return /накладн/iu.test(text) || /выручк|доход|прибыл|заработ/iu.test(text);
};

const isShortDrillDownQuery = (text: string) => {
  const t = text.trim().toLowerCase();
  return (
    /^по\s+менеджер/iu.test(t) ||
    /^по\s+водител/iu.test(t) ||
    /^по\s+клиент/iu.test(t) ||
    /^по\s+товар/iu.test(t) ||
    /^по\s+достав/iu.test(t)
  );
};

aiRouter.post('/chat', async (req: AuthRequest, res) => {
  try {
    const { message, history } = req.body as {
      message?: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
    };

    const text = (message || '').trim();
    if (!text) {
      return res.status(400).json({ message: 'message is required' });
    }

    // Убираем обращение "глобалснаб" в начале фразы, если оно есть
    const lowered = text.toLowerCase().trim();
    let cleaned = text;
    if (lowered.startsWith('глобалснаб')) {
      cleaned = text.slice(text.length - lowered.replace(/^глобалснаб\s*/i, '').length).trim();
      if (!cleaned) cleaned = text; // запасной вариант, если что-то пошло не так с обрезкой
    }

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];

    messages.push({
      role: 'system',
      content:
        'Ты AI-помощник системы GlobalSnab ERP. Отвечай кратко и по делу.\n' +
        '1) Всегда учитывай историю диалога: если новый вопрос короткий (например, \'по доставкам\', \'по водителям\', \'по менеджерам\', \'по клиентам\'), воспринимай его как УТОЧНЕНИЕ к предыдущему запросу и используй тот же период и ту же тему, что обсуждались раньше.\n' +
        '2) Если в системном контексте ниже есть реальные цифры из базы данных (количество накладных, суммы, доход и т.п.), ОБЯЗАТЕЛЬНО опирайся на эти цифры и не придумывай свои. Можно ссылаться на них и в уточняющих ответах (например, когда спрашивают только про доставки, а у тебя есть только общие цифры по накладным за этот период).\n' +
        '3) Если по какому-то аспекту (например, точные суммы по доставке или разрез по клиентам) нет прямых данных из базы в системном контексте ниже, честно скажи, что точные цифры недоступны по текущим данным, но при этом: (а) напомни уже посчитанные цифры по накладным за период (если они есть в контексте), (б) подскажи, какие стандартные отчёты системы можно открыть вручную для детализации.',
    });

    // Если вопрос явно про накладные и содержит понятный период — считаем реальные цифры
    let statsContext = '';

    const directRange = parseInvoiceDateRange(cleaned);
    const range = directRange || (isShortDrillDownQuery(cleaned) ? inferInvoiceDateRangeFromHistory(history) : null);

    const wantManagersBreakdown = /^по\s+менеджер/iu.test(cleaned) || (/менеджер/iu.test(cleaned) && !/менеджер[ауые]*\s+[^,.!\?\n]+/iu.test(cleaned));
    const wantDriversBreakdown = /^по\s+водител/iu.test(cleaned) || (/водител/iu.test(cleaned) && !/водител[ьяюе]*\s+[^,.!\?\n]+/iu.test(cleaned));

    // Вопросы про накладные ИЛИ выручку/доход/прибыль/заработок за период обрабатываем единым агрегатом по накладным
    if (
      (isInvoiceTopic(cleaned) || isShortDrillDownQuery(cleaned)) &&
      range
    ) {
      const match: any = {
        isCancelled: { $ne: true },
        date: { $gte: range.from, $lte: range.to },
      };

      if (wantManagersBreakdown) {
        const rows = await InvoiceModel.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$createdBy',
              count: { $sum: 1 },
              totalAmount: { $sum: '$totalAmount' },
              totalIncome: { $sum: '$totalIncome' },
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'user',
            },
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              managerId: '$_id',
              managerName: { $ifNull: ['$user.fullName', { $ifNull: ['$user.email', '—'] }] },
              count: 1,
              totalAmount: 1,
              totalIncome: 1,
            },
          },
          { $sort: { totalAmount: -1 } },
        ] as any[]);

        const top = (rows || []).slice(0, 50);
        statsContext +=
          `Разрез по менеджерам за период ${range.label} (по накладным): ` +
          top
            .map(
              (r: any) =>
                `${String(r.managerName)}: накладных=${Number(r.count) || 0}, выручка=${Number(r.totalAmount || 0).toFixed(2)} RUB, доход=${Number(r.totalIncome || 0).toFixed(2)} RUB`,
            )
            .join(' | ') +
          '. ';
      }

      if (wantDriversBreakdown) {
        const rows = await InvoiceModel.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$driver',
              count: { $sum: 1 },
              totalAmount: { $sum: '$totalAmount' },
              totalIncome: { $sum: '$totalIncome' },
            },
          },
          {
            $lookup: {
              from: 'drivers',
              localField: '_id',
              foreignField: '_id',
              as: 'driver',
            },
          },
          { $unwind: { path: '$driver', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              driverId: '$_id',
              driverName: { $ifNull: ['$driver.fullName', '—'] },
              count: 1,
              totalAmount: 1,
              totalIncome: 1,
            },
          },
          { $sort: { totalAmount: -1 } },
        ] as any[]);

        const top = (rows || []).slice(0, 50);
        statsContext +=
          `Разрез по водителям за период ${range.label} (по накладным): ` +
          top
            .map(
              (r: any) =>
                `${String(r.driverName)}: накладных=${Number(r.count) || 0}, выручка=${Number(r.totalAmount || 0).toFixed(2)} RUB, доход=${Number(r.totalIncome || 0).toFixed(2)} RUB`,
            )
            .join(' | ') +
          '. ';
      }

      // Отчёт по конкретному водителю, если он упомянут в вопросе
      let driverStatsAdded = false;
      if (/водител/iu.test(cleaned)) {
        try {
          // Пытаемся вытащить имя после слова "водитель"
          const driverNameMatch = cleaned.match(/водител[ьяюе]*\s+([^,.!?\n]+)/iu);
          if (driverNameMatch && driverNameMatch[1]) {
            const rawName = driverNameMatch[1].trim();

            const driver = await DriverModel.findOne({
              fullName: { $regex: rawName.replace(/[-/\\]/g, ' '), $options: 'i' },
              isActive: true,
            }).lean();

            if (driver && driver._id) {
              const driverMatch: any = {
                ...match,
                driver: driver._id,
              };

              const rows = await InvoiceModel.aggregate([
                { $match: driverMatch },
                {
                  $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$totalAmount' },
                    totalIncome: { $sum: '$totalIncome' },
                  },
                },
              ] as any[]);

              const row = rows[0] || { count: 0, totalAmount: 0, totalIncome: 0 };
              const count = row.count || 0;
              const totalAmount = row.totalAmount || 0;
              const totalIncome = row.totalIncome || 0;

              statsContext +=
                `Фактические данные по накладным водителя ${driver.fullName} за период ${range.label}: ` +
                `количество накладных = ${count}, ` +
                `общая сумма = ${totalAmount.toFixed(2)} RUB, ` +
                `общий доход = ${totalIncome.toFixed(2)} RUB. `;

              driverStatsAdded = true;
            } else {
              statsContext += `Вопрос содержит водителя («${rawName}»), но в базе не найден активный водитель с таким именем. `;
            }
          }
        } catch (e) {
          // Если что-то пошло не так при отчёте по водителю, просто не блокируем общий отчёт
        }
      }

      // Отчёт по конкретному менеджеру, если он упомянут в вопросе
      let managerStatsAdded = false;
      if (/менеджер/iu.test(cleaned)) {
        try {
          const managerNameMatch = cleaned.match(/менеджер[ауые]*\s+([^,.!?\n]+)/iu);
          if (managerNameMatch && managerNameMatch[1]) {
            const rawName = managerNameMatch[1].trim();

            const manager = await UserModel.findOne({
              fullName: { $regex: rawName.replace(/[-/\\]/g, ' '), $options: 'i' },
              isActive: true,
            }).lean();

            if (manager && manager._id) {
              const managerMatch: any = {
                ...match,
                createdBy: manager._id,
              };

              const rows = await InvoiceModel.aggregate([
                { $match: managerMatch },
                {
                  $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$totalAmount' },
                    totalIncome: { $sum: '$totalIncome' },
                  },
                },
              ] as any[]);

              const row = rows[0] || { count: 0, totalAmount: 0, totalIncome: 0 };
              const count = row.count || 0;
              const totalAmount = row.totalAmount || 0;
              const totalIncome = row.totalIncome || 0;

              statsContext +=
                `Фактические данные по накладным менеджера ${manager.fullName} за период ${range.label}: ` +
                `количество накладных = ${count}, ` +
                `общая сумма = ${totalAmount.toFixed(2)} RUB, ` +
                `общий доход = ${totalIncome.toFixed(2)} RUB. `;

              managerStatsAdded = true;
            } else {
              statsContext += `Вопрос содержит менеджера («${rawName}»), но в базе не найден активный менеджер с таким именем. `;
            }
          }
        } catch (e) {
          // Если что-то пошло не так при отчёте по менеджеру, просто не блокируем общий отчёт
        }
      }

      // Общий отчёт по накладным за период (если не только про водителя)
      if (!driverStatsAdded && !managerStatsAdded && !wantManagersBreakdown && !wantDriversBreakdown) {
        const rows = await InvoiceModel.aggregate([
          { $match: match },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAmount: { $sum: '$totalAmount' },
              totalIncome: { $sum: '$totalIncome' },
            },
          },
        ] as any[]);

        const row = rows[0] || { count: 0, totalAmount: 0, totalIncome: 0 };
        const count = row.count || 0;
        const totalAmount = row.totalAmount || 0;
        const totalIncome = row.totalIncome || 0;

        statsContext +=
          `Фактические данные по накладным за период ${range.label}: ` +
          `количество накладных = ${count}, ` +
          `общая сумма (выручка по накладным) = ${totalAmount.toFixed(2)} RUB, ` +
          `общий доход (прибыль по накладным) = ${totalIncome.toFixed(2)} RUB.`;
      }
    }

    if (statsContext) {
      messages.push({
        role: 'system',
        content:
          'Ниже приведены реальные цифры из базы данных GlobalSnab, используй их в ответе. ' + statsContext,
      });
    }

    if (Array.isArray(history)) {
      for (const h of history) {
        if (!h || !h.content) continue;
        messages.push({ role: h.role, content: h.content });
      }
    }

    messages.push({ role: 'user', content: cleaned });

    const answer = await deepseek.chat(messages);

    return res.json({ answer });
  } catch (err: any) {
    console.error('[AI] Chat error:', err?.response?.data || err);
    const message = err?.response?.data?.error?.message || err?.message || 'AI chat error';
    return res.status(500).json({ message: 'Ошибка AI-помощника', detail: message });
  }
});
