import fs from 'fs';
import path from 'path';
import axios from 'axios';
import Tesseract from 'tesseract.js';
import { env } from '../config/env';

export interface DeepSeekOcrResult {
  // Текст для отображения пользователю (максимально качественный, Azure если доступен)
  rawTextForDisplay: string;
  // Текст для парсинга в черновик (формат, с которым умеет работать текущий парсер) — всегда из Tesseract
  rawTextForParsing: string;
}

export class DeepSeekService {
  async recognizeInvoice(filePath: string): Promise<DeepSeekOcrResult> {
    const ext = path.extname(filePath).toLowerCase();

    // HEIC/HEIF: tesseract.js обычно не умеет читать напрямую, а для парсинга нужен текст из Tesseract.
    // Поэтому возвращаем явную ошибку, чтобы пользователь конвертировал файл в JPG/PNG.
    if (ext === '.heic' || ext === '.heif') {
      throw new Error('Формат HEIC/HEIF пока не поддерживается для распознавания. Конвертируйте файл в JPG/PNG.');
    }

    let rawTextForDisplay = '';
    let rawTextForParsing = '';
    // Отдельные сценарии для PDF и изображений
    if (ext === '.pdf') {
      // PDF: используем Azure Read API, если настроен
      if (env.azureVisionEndpoint && env.azureVisionApiKey) {
        try {
          const fileBuffer = await fs.promises.readFile(filePath);

          const endpoint = env.azureVisionEndpoint.replace(/\/+$/, '');
          const url = `${endpoint}/vision/v3.2/read/analyze?language=ru`;

          // 1. Отправляем PDF на анализ
          const submitResponse = await axios.post(url, fileBuffer, {
            headers: {
              'Content-Type': 'application/octet-stream',
              'Ocp-Apim-Subscription-Key': env.azureVisionApiKey,
            },
            timeout: 30000,
          });

          const operationLocation: string | undefined = submitResponse.headers['operation-location'];
          if (!operationLocation) {
            console.error('[AzureRead][PDF] Нет заголовка operation-location');
          } else {
            // 2. Опрос статуса операции
            const maxAttempts = 10;
            const delayMs = 1500;
            let attempt = 0;
            let done = false;
            let readResult: any = null;

            while (attempt < maxAttempts && !done) {
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              attempt += 1;

              try {
                const statusResponse = await axios.get(operationLocation, {
                  headers: {
                    'Ocp-Apim-Subscription-Key': env.azureVisionApiKey,
                  },
                  timeout: 15000,
                });

                const status = statusResponse.data?.status;
                if (status === 'succeeded') {
                  readResult = statusResponse.data?.analyzeResult;
                  done = true;
                  break;
                }

                if (status === 'failed') {
                  console.error('[AzureRead][PDF] Статус failed:', statusResponse.data);
                  break;
                }
              } catch (pollErr) {
                console.error('[AzureRead][PDF] Ошибка при опросе статуса:', pollErr);
                break;
              }
            }

            if (readResult?.readResults) {
              const lines: string[] = [];
              for (const page of readResult.readResults) {
                for (const line of page.lines || []) {
                  const text = String(line.text || '').trim();
                  if (text) lines.push(text);
                }
              }

              const text = lines.join('\n').trim();
              if (text) {
                rawTextForDisplay = text;
                rawTextForParsing = text;
              } else {
                console.warn('[AzureRead][PDF] Пустой текст после распознавания');
              }
            } else {
              console.warn('[AzureRead][PDF] Нет readResults в ответе');
            }
          }
        } catch (err) {
          console.error('[AzureRead][PDF] Ошибка OCR:', { filePath, err });
        }

        // Если Azure настроен, но текста всё равно нет — возвращаем более точную ошибку для PDF
        if (!String(rawTextForDisplay || '').trim() && !String(rawTextForParsing || '').trim()) {
          throw new Error(
            'PDF не удалось распознать. Часто это происходит, если PDF — это скан/картинки низкого качества. ' +
              'Попробуйте сохранить страницы как JPG/PNG и загрузить как изображения.'
          );
        }
      } else {
        // Для PDF у нас нет локального fallback, поэтому возвращаем явную ошибку
        // (фронт уже обрабатывает такие сообщения как 400)
        throw new Error('PDF пока не поддерживается без настроенного Azure Vision');
      }
    } else {
      // Изображения: Azure (для отображения) + Tesseract (для парсинга)

      // 1. Azure Computer Vision — источник максимально качественного текста для отображения
      if (env.azureVisionEndpoint && env.azureVisionApiKey) {
        try {
          const imageBuffer = await fs.promises.readFile(filePath);

          const endpoint = env.azureVisionEndpoint.replace(/\/+$/, '');
          const url = `${endpoint}/vision/v3.2/ocr?language=ru&detectOrientation=true`;

          const response = await axios.post(url, imageBuffer, {
            headers: {
              'Content-Type': 'application/octet-stream',
              'Ocp-Apim-Subscription-Key': env.azureVisionApiKey,
            },
            timeout: 30000,
          });

          const regions = Array.isArray(response.data?.regions) ? response.data.regions : [];
          const lines: string[] = [];

          for (const region of regions) {
            for (const line of region?.lines || []) {
              const words = (line?.words || []).map((w: any) => String(w.text || '').trim()).filter(Boolean);
              if (words.length) {
                lines.push(words.join(' '));
              }
            }
          }

          const azureText = lines.join('\n').trim();
          if (azureText) {
            rawTextForDisplay = azureText;
          }
        } catch (err) {
          console.error('[AzureVision] Ошибка OCR, используем только Tesseract для отображения/парсинга:', { filePath, err });
        }
      }

      // 2. Tesseract — источник текста для ПАРСИНГА (и, при отсутствии Azure, для отображения)
      try {
        // В проекте рядом с backend лежат языковые файлы rus.traineddata и eng.traineddata.
        // Указываем путь явно, чтобы tesseract.js не пытался скачивать их из интернета.
        const trainedDataPath = path.join(__dirname, '..', '..', '');
        const baseOptions = {
          logger: () => undefined,
          langPath: trainedDataPath,
          // Базовые настройки, которые часто улучшают качество на сканах/фото
          // (не ломают текущий парсер и не зависят от внешних утилит).
          config: {
            preserve_interword_spaces: '1',
            tessedit_pageseg_mode: '6',
          } as any,
        };

        const tryRecognize = async (lang: string) => {
          const { data } = await Tesseract.recognize(filePath, lang, baseOptions as any);
          return String(data?.text || '').trim();
        };

        // 1) Основная попытка
        let text = await tryRecognize('rus+eng');

        // 2) Фоллбек: иногда смешанный язык даёт пусто, а одиночный — нет
        if (!text) {
          text = await tryRecognize('rus');
        }
        if (!text) {
          text = await tryRecognize('eng');
        }

        rawTextForParsing = text;

        if (!rawTextForDisplay && text) {
          rawTextForDisplay = text;
        }
      } catch (err) {
        console.error('[Tesseract] Ошибка OCR для парсинга:', { filePath, err });
      }
    }

    // Если вообще не получили текст — считаем, что документ не распознан.
    // Иначе фронт получает пустые строки и показывает "не распознаёт документ" без деталей.
    if (!String(rawTextForDisplay || '').trim() && !String(rawTextForParsing || '').trim()) {
      console.warn('[OCR] Empty text after OCR attempts:', { filePath });
      throw new Error('Документ не удалось распознать. Проверьте качество изображения (резкость/контраст) или попробуйте другой формат (JPG/PNG).');
    }

    return {
      rawTextForDisplay,
      rawTextForParsing,
    };
  }

  async chat(messages: { role: 'system' | 'user' | 'assistant'; content: string }[]): Promise<string> {
    if (!env.deepseekApiKey) {
      throw new Error('DeepSeek API key is not configured');
    }

    const url = `${env.deepseekApiUrl.replace(/\/+$/, '')}/chat/completions`;

    const response = await axios.post(
      url,
      {
        model: env.deepseekChatModel || 'deepseek-chat',
        messages,
        stream: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.deepseekApiKey}`,
        },
        timeout: 30000,
      },
    );

    const choice = response.data?.choices?.[0];
    const content: string | undefined = choice?.message?.content;
    if (!content) {
      throw new Error('DeepSeek chat response is empty');
    }
    return String(content);
  }
}
