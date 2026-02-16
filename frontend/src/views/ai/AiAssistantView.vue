<template>
  <div class="h-full flex flex-col gap-3">
    <h1 class="text-xl font-semibold mb-1">AI-помощник</h1>
    <div class="text-xs text-slate-400 mb-2">
      Обращайтесь к помощнику так, как в обычной речи. Можно начинать фразу с
      <span class="font-semibold">"Глобалснаб"</span>, например:
      «Глобалснаб, сделай отчёт по накладным за сегодня».
    </div>

    <div class="flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-400">
      <div class="flex flex-col gap-0.5">
        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            class="px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-200"
            @click="toggleWakeListening"
          >
            {{ isWakeListening ? 'Отключить "Привет, Глобалснаб"' : 'Включить "Привет, Глобалснаб"' }}
          </button>
          <span v-if="isWakeListening" class="text-emerald-400">Голосовая активация включена</span>
        </div>
        <div v-if="wakeError" class="text-[11px] text-red-400">
          {{ wakeError }}
        </div>
      </div>
      <button
        type="button"
        class="px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-200"
        @click="clearChat"
      >
        Очистить диалог
      </button>
    </div>

    <div class="flex-1 min-h-0 border border-slate-800 rounded-xl bg-slate-950 flex flex-col">
      <div class="flex-1 overflow-auto p-3 space-y-2 text-sm">
        <div v-if="messages.length === 0" class="text-xs text-slate-500">
          Задайте первый вопрос, например:
          <button
            type="button"
            class="ml-1 px-2 py-0.5 rounded border border-slate-700 text-[11px] hover:bg-slate-800"
            @click="useExample('Глобалснаб, сделай отчёт по накладным за сегодня')"
          >
            Глобалснаб, сделай отчёт по накладным за сегодня
          </button>
        </div>
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="flex"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[80%] px-3 py-2 rounded-lg text-xs whitespace-pre-wrap"
            :class="msg.role === 'user' ? 'bg-sky-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-100'"
          >
            <div class="mb-1 font-semibold" v-if="idx === 0 && msg.role === 'assistant'">Глобалснаб</div>
            {{ msg.content }}
          </div>
        </div>
        <div v-if="loading" class="text-xs text-slate-400">Глобалснаб думает...</div>
      </div>

      <form class="border-t border-slate-800 p-2 flex flex-col gap-2" @submit.prevent="send">
        <div class="flex gap-2 items-stretch">
          <textarea
            v-model="input"
            rows="2"
            class="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100 resize-none"
            placeholder="Напишите запрос или продиктуйте голосом, например: Глобалснаб, сколько накладных за сегодня?"
          />
          <div class="flex flex-col gap-1">
            <button
              type="button"
              class="px-3 py-2 rounded text-sm border border-slate-700"
              :class="isRecording ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-200 hover:bg-slate-800'"
              @click="toggleRecording"
            >
              <span v-if="!isRecording">🎙 Голос</span>
              <span v-else>Стоп</span>
            </button>
            <button
              type="submit"
              class="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm text-white disabled:opacity-60"
              :disabled="!input.trim() || loading"
            >
              Отправить
            </button>
          </div>
        </div>
        <div class="flex flex-wrap gap-1 text-[11px] text-slate-300">
          <span class="text-slate-500 mr-1">Примеры запросов:</span>
          <button
            v-for="(q, idx) in exampleQuestions"
            :key="idx"
            type="button"
            class="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800"
            @click="useExample(q)"
          >
            {{ q }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import axios from 'axios';
import { PorcupineWorker } from '@picovoice/porcupine-web';
import { WebVoiceProcessor } from '@picovoice/web-voice-processor';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const messages = ref<ChatMessage[]>([]);
const input = ref('');
const loading = ref(false);
const isRecording = ref(false);
const isWakeListening = ref(false);
const wakeError = ref('');
let recognition: any | null = null;
let porcupineWorker: any | null = null;

const exampleQuestions = ref<string[]>([
  'Глобалснаб, сделай отчёт по накладным за сегодня',
  'Глобалснаб, сколько накладных за текущий месяц и на какую сумму?',
  'Глобалснаб, сделай отчёт по накладным за прошлый месяц',
  'Глобалснаб, сделай отчёт по накладным за период с 01.12.2025 по 10.12.2025',
  'Глобалснаб, сколько накладных сделал водитель Иванов за текущий месяц?',
  'Глобалснаб, какой водитель сделал больше всего накладных за этот месяц?',
  'Глобалснаб, сколько накладных создал менеджер Айжан за прошлый месяц?',
  'Глобалснаб, сделай рейтинг менеджеров по сумме накладных за текущий месяц',
  'Глобалснаб, какие клиенты дали наибольший оборот за этот месяц?',
  'Глобалснаб, топ 10 самых ходовых товаров по количеству за прошлый месяц',
  'Глобалснаб, какие товары почти закончились на складе?',
  'Глобалснаб, какой общий доход по всем накладным за текущий месяц?',
  'Глобалснаб, сравни прибыль по текущему и прошлому месяцу',
]);

const clearChat = () => {
  messages.value = [];
};

const send = async () => {
  const text = input.value.trim();
  if (!text || loading.value) return;

  messages.value.push({ role: 'user', content: text });
  input.value = '';
  loading.value = true;

  try {
    const history = messages.value
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await axios.post('/api/v1/ai/chat', {
      message: text,
      history,
    });

    const answer: string = res.data?.answer || 'Нет ответа от AI-помощника.';
    messages.value.push({ role: 'assistant', content: answer });
  } catch (e: any) {
    const msg = e?.response?.data?.message || 'Ошибка запроса к AI-помощнику.';
    messages.value.push({ role: 'assistant', content: msg });
  } finally {
    loading.value = false;
  }
};

const useExample = (text: string) => {
  input.value = text;
};

const initRecognition = () => {
  if (typeof window === 'undefined') return;

  const SpeechRecognitionImpl =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognitionImpl) {
    return;
  }

  recognition = new SpeechRecognitionImpl();
  recognition.lang = 'ru-RU';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    try {
      const results = event?.results;
      const lastIndex = results ? results.length - 1 : -1;
      const transcript: string =
        lastIndex >= 0 && results?.[lastIndex]?.[0]?.transcript
          ? results[lastIndex][0].transcript
          : '';

      if (transcript) {
        const lower = transcript.toLowerCase().trim();
        const wake1 = 'привет глобалснаб';
        const wake2 = 'глобалснаб';

        let command = transcript;
        if (lower.startsWith(wake1)) {
          command = transcript.slice(wake1.length).trim();
        } else if (lower.startsWith(wake2)) {
          command = transcript.slice(wake2.length).trim();
        }

        if (command) {
          if (input.value && !input.value.endsWith(' ')) {
            input.value += ' ';
          }
          input.value += command;
          // после диктовки сразу отправляем запрос
          send();
        }
      }
    } catch {
      // ignore
    }
  };

  recognition.onerror = () => {
    isRecording.value = false;
  };

  recognition.onend = () => {
    isRecording.value = false;
    // после завершения диктовки снова включаем wake-word, если он был активен
    if (isWakeListening.value) {
      startWakeListeningInternal().catch(() => {
        isWakeListening.value = false;
      });
    }
  };
};

const toggleRecording = () => {
  if (!recognition) {
    initRecognition();
  }

  if (!recognition) {
    return;
  }

  if (isRecording.value) {
    try {
      recognition.stop();
    } catch {
      // ignore
    }
    isRecording.value = false;
  } else {
    try {
      recognition.start();
      isRecording.value = true;
    } catch {
      // ignore
    }
  }
};

const initPorcupine = async () => {
  if (porcupineWorker) return;

  const accessKey = (import.meta as any).env?.VITE_PICOVOICE_ACCESS_KEY as string | undefined;
  if (!accessKey) {
    // без access key не инициализируем wake-word
    wakeError.value = 'Wake-word недоступен: не задан VITE_PICOVOICE_ACCESS_KEY.';
    console.error('[WakeWord] VITE_PICOVOICE_ACCESS_KEY не задан');
    return;
  }

  try {
    console.log('[WakeWord] Инициализация Porcupine, файл hotword: /porcupine/Salam-global_en_wasm_v4_0_0.ppn');
    porcupineWorker = await PorcupineWorker.create(
      accessKey,
      [
        {
          label: 'salam_globalsnab',
          publicPath: '/porcupine/Salam-global_en_wasm_v4_0_0.ppn',
        },
      ],
      (detection: any) => {
        if (!detection) return;
        console.log('[WakeWord] Детектирован hotword', detection);
        toggleRecording();
      },
      {
        publicPath: '/porcupine/porcupine_params.pv',
      },
    );
  } catch (err) {
    porcupineWorker = null;
    wakeError.value = 'Ошибка инициализации Porcupine (wake-word). Откройте консоль браузера для деталей.';
    console.error('[WakeWord] Ошибка инициализации Porcupine', err);
  }
};

const startWakeListeningInternal = async () => {
  if (typeof window === 'undefined') return;

  await initPorcupine();
  if (!porcupineWorker) {
    if (!wakeError.value) {
      wakeError.value = 'Не удалось запустить wake-word (Porcupine).';
    }
    console.error('[WakeWord] porcupineWorker отсутствует после initPorcupine');
    return;
  }

  try {
    console.log('[WakeWord] Подписка WebVoiceProcessor на Porcupine');
    await WebVoiceProcessor.subscribe(porcupineWorker);
  } catch (err) {
    wakeError.value = 'Не удалось запустить прослушивание микрофона для wake-word.';
    console.error('[WakeWord] Не удалось выполнить WebVoiceProcessor.subscribe()', err);
  }
};

const stopWakeListeningInternal = async () => {
  if (porcupineWorker) {
    try {
      console.log('[WakeWord] Отписка WebVoiceProcessor от Porcupine');
      await WebVoiceProcessor.unsubscribe(porcupineWorker);
    } catch {
      // ignore
    }
  }
};

const toggleWakeListening = async () => {
  if (isWakeListening.value) {
    await stopWakeListeningInternal();
    isWakeListening.value = false;
  } else {
    wakeError.value = '';
    await startWakeListeningInternal();
    // если не удалось запустить, не отмечаем как включенный
    if (porcupineWorker) {
      isWakeListening.value = true;
    }
  }
};

onBeforeUnmount(() => {
  if (porcupineWorker) {
    try {
      porcupineWorker.terminate();
    } catch {
      // ignore
    }
  }
});
</script>

<style scoped></style>
