<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold mb-2">Главный дашборд (MVP)</h1>
    <div class="grid gap-4 md:grid-cols-3">
      <div class="bg-slate-950 border border-slate-800 rounded-xl p-4">
        <div class="text-xs uppercase text-slate-400 mb-1">Доходы</div>
        <div class="text-2xl font-bold">— ₽</div>
      </div>
      <div class="bg-slate-950 border border-slate-800 rounded-xl p-4">
        <div class="text-xs uppercase text-slate-400 mb-1">Расходы</div>
        <div class="text-2xl font-bold">— ₽</div>
      </div>
      <div class="bg-slate-950 border border-slate-800 rounded-xl p-4">
        <div class="text-xs uppercase text-slate-400 mb-1">Чистая прибыль</div>
        <div class="text-2xl font-bold">— ₽</div>
      </div>
    </div>
    <p class="text-slate-300 text-sm">
      Сейчас реализованы: аутентификация, роли, база товаров, импорт товаров (JSON) и API распознавания накладных.
      Далее к этому дашборду будут подключены реальные финансовые показатели, склад, автопарк и отчеты.
    </p>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped></style>
