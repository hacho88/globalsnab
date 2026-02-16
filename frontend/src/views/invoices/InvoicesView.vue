<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h1 class="text-xl font-semibold">Накладные</h1>
      <label class="inline-flex items-center px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm cursor-pointer hover:bg-slate-800">
        <input
          ref="fileInput"
          type="file"
          name="invoice_ocr_files"
          class="hidden"
          multiple
          accept=".pdf,image/*"
          @change="onFileChange"
        />
        <span>🤖 Распознать накладную (фото / PDF)</span>
      </label>
    </div>

    <div v-if="ocrError" class="text-sm text-red-400">
      {{ ocrError }}
    </div>

    <div v-if="ocrLoading" class="text-sm text-slate-300">
      Распознавание накладной через DeepSeek... Это может занять до 10 секунд.
    </div>

    <div v-if="rawText" class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm whitespace-pre-wrap max-h-96 overflow-auto">
      <div class="text-xs uppercase text-slate-400 mb-2">Распознанный текст</div>
      {{ rawText }}
    </div>

    <div v-if="rawText" class="flex items-center gap-2">
      <button
        type="button"
        class="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm text-white"
        @click="fillFromText"
      >
        Заполнить накладную из текста
      </button>
      <span v-if="parseError" class="text-xs text-red-400">{{ parseError }}</span>
    </div>

    <div v-if="invoiceDraft" class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 space-y-4">
      <div class="text-xs uppercase text-slate-400 mb-1">
        {{ editingInvoiceId ? `Редактирование накладной №${invoiceDraft.number || ''}` : 'Черновик накладной' }}
      </div>
      <div class="mt-1 text-[11px] uppercase text-slate-400 tracking-wide">
        Основная информация
      </div>

      <div
        v-if="editingInvoiceId"
        class="border border-slate-800 rounded-lg p-3 bg-slate-950 space-y-2"
      >
        <div class="text-[11px] uppercase text-slate-400 tracking-wide">Фото и скан накладной</div>
        <div v-if="attachmentsError" class="text-xs text-red-400">{{ attachmentsError }}</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div class="space-y-2">
            <div class="text-slate-300">Фото</div>
            <div class="flex items-center gap-2">
              <input
                type="file"
                accept="image/*,.pdf"
                class="block w-full text-xs"
                :disabled="attachmentsLoading"
                @change="(e) => onSelectAttachment(e, 'photo')"
              />
              <button
                v-if="editingInvoiceRaw && editingInvoiceRaw.photoFile"
                type="button"
                class="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-[11px]"
                :disabled="attachmentsLoading"
                @click="deleteAttachment('photo')"
              >
                Удалить
              </button>
            </div>
            <div v-if="editingInvoiceRaw && editingInvoiceRaw.photoFile" class="text-[11px]">
              <a :href="editingInvoiceRaw.photoFile" target="_blank" class="text-sky-400 hover:underline">Открыть</a>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-slate-300">Скан</div>
            <div class="flex items-center gap-2">
              <input
                type="file"
                accept="image/*,.pdf"
                class="block w-full text-xs"
                :disabled="attachmentsLoading"
                @change="(e) => onSelectAttachment(e, 'scan')"
              />
              <button
                v-if="editingInvoiceRaw && editingInvoiceRaw.scanFile"
                type="button"
                class="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-[11px]"
                :disabled="attachmentsLoading"
                @click="deleteAttachment('scan')"
              >
                Удалить
              </button>
            </div>
            <div v-if="editingInvoiceRaw && editingInvoiceRaw.scanFile" class="text-[11px]">
              <a :href="editingInvoiceRaw.scanFile" target="_blank" class="text-sky-400 hover:underline">Открыть</a>
            </div>
          </div>
        </div>

        <div v-if="attachmentsLoading" class="text-xs text-slate-400">Загрузка файла...</div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label class="block text-xs text-slate-400 mb-1" for="invoice_number">Номер</label>
          <input
            v-model="invoiceDraft.number"
            type="text"
            id="invoice_number"
            name="invoice_number"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1" for="invoice_date">Дата</label>
          <input
            v-model="invoiceDraft.date"
            type="date"
            id="invoice_date"
            name="invoice_date"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1" for="invoice_payment_type">Тип продажи</label>
          <select
            v-model="invoiceDraft.paymentType"
            id="invoice_payment_type"
            name="invoice_payment_type"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          >
            <option value="cashless">Безналичная</option>
            <option value="cash">Наличная</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label class="block text-xs text-slate-400 mb-1" for="invoice_supplier">Поставщик</label>
          <textarea
            v-model="invoiceDraft.supplier"
            id="invoice_supplier"
            name="invoice_supplier"
            rows="2"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          ></textarea>
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1" for="invoice_client">Покупатель</label>
          <textarea
            v-model="invoiceDraft.client"
            id="invoice_client"
            name="invoice_client"
            rows="2"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          ></textarea>
          <div v-if="invoiceDraft" class="mt-1 space-y-1 text-[11px]">
            <div class="text-slate-400">Клиент из базы (необязательно)</div>
            <div class="flex items-center gap-1">
              <input
                v-model="clientSearch"
                type="text"
                id="invoice_client_search"
                name="invoice_client_search"
                placeholder="Поиск по имени / телефону / email"
                class="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                @input="onClientSearchInput"
              />
              <button
                v-if="invoiceDraft.clientId"
                type="button"
                class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[11px] text-white"
                @click="clearSelectedClient"
              >
                Сбросить
              </button>
            </div>
            <div
              v-if="clientSearchResults.length > 0"
              class="border border-slate-700 rounded bg-slate-950 max-h-40 overflow-auto"
            >
              <button
                v-for="c in clientSearchResults"
                :key="c._id"
                type="button"
                class="w-full text-left px-2 py-1 hover:bg-slate-900 flex flex-col"
                @click="selectClientFromSearch(c)"
              >
                <span class="text-slate-100">{{ c.name }}</span>
                <span class="text-slate-400">
                  {{ c.phone || '' }}
                  <span v-if="c.email"> · {{ c.email }}</span>
                </span>
              </button>
            </div>
            <div v-if="invoiceDraft.clientId" class="text-emerald-400">
              Выбран клиент: {{ selectedClientLabel }}
            </div>
          </div>
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1" for="invoice_delivery_driver">Доставка</label>
          <div class="space-y-1">
            <select
              v-model="invoiceDraft.deliveryDriverId"
              id="invoice_delivery_driver"
              name="invoice_delivery_driver"
              class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs mb-1"
            >
              <option value="">Без водителя</option>
              <option
                v-for="d in drivers"
                :key="d._id"
                :value="d._id"
              >
                {{ d.fullName }}
              </option>
            </select>
            <div class="flex items-center gap-2">
              <span class="text-[11px] text-slate-300 whitespace-nowrap">Сумма доставки</span>
              <input
                v-model.number="invoiceDraft.deliveryPrice"
                type="number"
                id="invoice_delivery_price"
                name="invoice_delivery_price"
                step="0.01"
                class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-right"
              />
              <span class="text-[11px] text-slate-400">₽</span>
            </div>
          </div>
        </div>
      </div>

      <div class="pt-2 border-t border-slate-800 text-[11px] uppercase text-slate-400 tracking-wide">
        Товары в накладной
      </div>

      <div class="border border-slate-800 rounded-lg overflow-visible">
        <div class="px-2 pt-2 pb-1 text-[11px] text-slate-400 flex justify-end">
          Всегда сверяйте артикул с названием в общей базе товаров
        </div>
        <table class="min-w-full text-xs">
          <thead class="bg-slate-900 text-slate-400">
            <tr>
              <th class="px-2 py-1 text-left">#</th>
              <th class="px-2 py-1 text-left min-w-[240px]">Товар</th>
              <th class="px-2 py-1 text-left w-[110px]">Артикул</th>
              <th class="px-2 py-1 text-right w-[96px]">Кол-во</th>
              <th class="px-2 py-1 text-left w-[60px]">Ед.</th>
              <th class="px-2 py-1 text-right w-[112px]">Цена</th>
              <th class="px-2 py-1 text-right w-[112px]">Приход нал</th>
              <th class="px-2 py-1 text-right w-[128px]">Приход безнал</th>
              <th class="px-2 py-1 text-left">Контрагент</th>
              <th class="px-2 py-1 text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, idx) in invoiceDraft.items"
              :key="idx"
              class="border-t border-slate-800"
              :class="{
                'bg-red-950/40': isRowCritical(item),
                'bg-amber-950/30': !isRowCritical(item) && isRowWarning(item),
              }"
            >
              <td class="px-2 py-1 text-slate-400">{{ idx + 1 }}</td>
              <td class="px-2 py-1 min-w-[220px]">
                <input
                  v-model="item.name"
                  type="text"
                  :name="`invoice_item_${idx}_name`"
                  class="w-full bg-slate-900 border border-slate-800 rounded px-1 py-0.5"
                  @input="onNameInput(item, idx)"
                  @blur="onNameBlur(item, idx)"
                />
              </td>
              <td class="px-2 py-1 w-[110px]">
                <div class="flex flex-col gap-1">
                  <input
                    v-model="item.sku"
                    type="text"
                    :name="`invoice_item_${idx}_sku`"
                    class="w-full bg-slate-900 border border-slate-800 rounded px-1 py-0.5"
                    @blur="onSkuBlur(item)"
                    @change="onSkuBlur(item)"
                  />
                  <button
                    v-if="item.name && !item.sku"
                    type="button"
                    class="text-[10px] px-1 py-0.5 rounded border border-slate-700 text-slate-200 hover:bg-slate-800"
                    @click="createProductFromItem(item)"
                  >
                    Создать товар
                  </button>
                </div>
              </td>
              <td class="px-2 py-1 text-right w-[96px]">
                <input
                  v-model.number="item.quantity"
                  type="number"
                  :name="`invoice_item_${idx}_quantity`"
                  step="1"
                  class="w-full bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-right"
                  @input="recomputeAmount(item)"
                />
              </td>
              <td class="px-2 py-1 w-[60px]">
                <input
                  v-model="item.unit"
                  type="text"
                  :name="`invoice_item_${idx}_unit`"
                  class="w-full bg-slate-900 border border-slate-800 rounded px-1 py-0.5"
                />
              </td>
              <td class="px-2 py-1 text-right w-[112px]">
                <input
                  v-model.number="item.price"
                  type="number"
                  :name="`invoice_item_${idx}_price`"
                  step="1"
                  class="w-full bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-right"
                  @input="recomputeAmount(item)"
                />
              </td>
              <td class="px-2 py-1 text-right w-[112px]">
                <input
                  v-model.number="item.purchasePriceCash"
                  type="number"
                  :name="`invoice_item_${idx}_purchase_cash`"
                  step="1"
                  class="w-full bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-right"
                />
              </td>
              <td class="px-2 py-1 text-right w-[128px]">
                <input
                  v-model.number="item.purchasePriceCashless"
                  type="number"
                  :name="`invoice_item_${idx}_purchase_cashless`"
                  step="1"
                  class="w-full bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-right"
                />
              </td>
              <td class="px-2 py-1">
                <select
                  v-model="item.contractor"
                  :name="`invoice_item_${idx}_contractor`"
                  class="w-32 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-xs"
                >
                  <option value="НАШ СКЛАД">НАШ СКЛАД</option>
                  <option
                    v-for="c in counterparties"
                    :key="c._id"
                    :value="c.name"
                  >
                    {{ c.name }}
                  </option>
                  <option value="ДРУГОЙ">ДРУГОЙ</option>
                </select>
              </td>
              <td class="px-2 py-1 text-right">
                <input
                  v-model.number="item.amount"
                  type="number"
                  :name="`invoice_item_${idx}_amount`"
                  step="0.01"
                  class="w-24 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-right"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="activeNameRowIndex !== null && currentNameSuggestions.length > 0 && invoiceDraft"
        class="mt-2 border border-slate-800 rounded-lg bg-slate-950 text-xs max-h-56 overflow-auto"
      >
        <div class="px-2 py-1 border-b border-slate-800 text-slate-400">
          Подходящие товары для строки {{ (activeNameRowIndex as number) + 1 }}
        </div>
        <button
          v-for="suggestion in currentNameSuggestions"
          :key="suggestion._id"
          type="button"
          class="w-full text-left px-2 py-1 hover:bg-slate-900 flex items-center justify-between gap-2"
          @click="applyNameSuggestion(invoiceDraft.items[activeNameRowIndex as number], suggestion)"
        >
          <div>
            <div class="font-medium text-slate-100">{{ suggestion.name }}</div>
            <div class="text-[11px] text-slate-400">{{ suggestion.sku || 'без артикула' }} · {{ suggestion.unit }}</div>
          </div>
        </button>
      </div>

      <div class="flex items-center justify-between text-xs text-slate-300">
        <button
          type="button"
          class="px-2 py-1 rounded border border-slate-700 text-slate-200 hover:bg-slate-800"
          @click="addItem"
        >
          Добавить строку
        </button>
        <div class="text-right">
          <div>Строк: {{ invoiceDraft.items.length }}</div>
          <div>Сумма по строкам: {{ totalAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} ₽</div>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs mt-2">
        <button
          type="button"
          class="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="saveLoading || !invoiceDraft.items.length || hasCriticalErrors"
          @click="saveInvoice"
        >
          {{ saveLoading ? 'Сохранение...' : 'Сохранить накладную' }}
        </button>

        <div class="text-right space-y-1">
          <div v-if="hasCriticalErrors" class="text-red-400">
            Исправьте строки с пустым названием, количеством или ценой прежде чем сохранять.
          </div>
          <div v-if="saveError" class="text-red-400">{{ saveError }}</div>
          <div v-if="saveSuccess" class="text-emerald-400">Накладная сохранена</div>
        </div>
      </div>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 space-y-3">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="font-semibold text-base">Список накладных</div>
        <label class="inline-flex items-center gap-1 text-xs text-slate-300">
          <input type="checkbox" v-model="showArchiveInvoices" @change="onToggleArchiveInvoices" />
          <span>Показать архив (удалённые)</span>
        </label>
      </div>

      <div class="mt-2 flex flex-wrap gap-2 items-end text-[11px] text-slate-300">
        <div class="flex flex-col">
          <label class="mb-0.5" for="invoice_list_number">Номер</label>
          <input
            v-model="listNumberQuery"
            type="text"
            id="invoice_list_number"
            name="invoice_list_number"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500"
            placeholder="Поиск по номеру"
          />
        </div>
        <div class="flex flex-col min-w-[180px]">
          <label class="mb-0.5" for="invoice_list_client">Покупатель</label>
          <input
            v-model="listClientQuery"
            type="text"
            id="invoice_list_client"
            name="invoice_list_client"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500"
            placeholder="Поиск по покупателю"
          />
        </div>
        <div class="flex flex-col min-w-[160px]">
          <label class="mb-0.5" for="invoice_list_manager">Менеджер</label>
          <input
            v-model="listManagerQuery"
            type="text"
            id="invoice_list_manager"
            name="invoice_list_manager"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500"
            placeholder="Поиск по менеджеру"
          />
        </div>
        <div class="flex flex-col min-w-[160px]">
          <label class="mb-0.5" for="invoice_list_driver">Водитель</label>
          <input
            v-model="listDriverQuery"
            type="text"
            id="invoice_list_driver"
            name="invoice_list_driver"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500"
            placeholder="Поиск по водителю"
          />
        </div>
        <div class="flex flex-col">
          <label class="mb-0.5" for="invoice_list_date_from">Дата с</label>
          <input
            v-model="listDateFrom"
            type="date"
            id="invoice_list_date_from"
            name="invoice_list_date_from"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
          />
        </div>
        <div class="flex flex-col">
          <label class="mb-0.5" for="invoice_list_date_to">Дата по</label>
          <input
            v-model="listDateTo"
            type="date"
            id="invoice_list_date_to"
            name="invoice_list_date_to"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
          />
        </div>
        <div class="flex flex-col">
          <label class="mb-0.5" for="invoice_list_payment">Тип оплаты</label>
          <select
            v-model="listPaymentFilter"
            id="invoice_list_payment"
            name="invoice_list_payment"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
          >
            <option value="all">Все</option>
            <option value="cash">Наличные</option>
            <option value="cashless">Безналичные</option>
          </select>
        </div>
        <button
          type="button"
          class="ml-auto px-3 py-1.5 rounded border border-slate-600 text-[11px] text-slate-200 hover:bg-slate-800"
          @click="resetListFilters"
        >
          Сбросить фильтры
        </button>
      </div>

      <div v-if="invoicesError" class="text-xs text-red-400">{{ invoicesError }}</div>
      <div v-if="invoicesLoading" class="text-xs text-slate-400">Загрузка накладных...</div>

      <table class="min-w-full text-xs mt-2">
        <thead class="bg-slate-900 text-slate-300">
          <tr>
            <th class="px-2 py-1 text-left">Дата</th>
            <th class="px-2 py-1 text-left">№</th>
            <th class="px-2 py-1 text-left">Поставщик</th>
            <th class="px-2 py-1 text-left">Покупатель</th>
            <th class="px-2 py-1 text-right">Сумма</th>
            <th class="px-2 py-1 text-right">Доход</th>
            <th class="px-2 py-1 text-right">Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="inv in currentInvoices"
            :key="inv._id"
            class="border-t border-slate-800"
          >
            <td class="px-2 py-1">{{ new Date(inv.date).toLocaleDateString('ru-RU') }}</td>
            <td class="px-2 py-1">{{ inv.number }}</td>
            <td class="px-2 py-1 truncate max-w-[180px]" :title="inv.supplier">{{ inv.supplier }}</td>
            <td class="px-2 py-1 truncate max-w-[180px]" :title="inv.client">{{ inv.client }}</td>
            <td class="px-2 py-1 text-right">{{ (inv.totalAmount || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
            <td class="px-2 py-1 text-right">{{ (inv.totalIncome || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
            <td class="px-2 py-1 text-right space-x-1">
              <button
                v-if="!showArchiveInvoices"
                type="button"
                class="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-white text-[11px]"
                @click="openPrint(inv)"
              >
                Печать
              </button>
              <button
                v-if="!showArchiveInvoices"
                type="button"
                class="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-white text-[11px]"
                @click="openBill(inv)"
              >
                Счёт
              </button>
              <button
                v-if="!showArchiveInvoices"
                type="button"
                class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-[11px]"
                @click="editInvoice(inv)"
              >
                Редактировать
              </button>
              <button
                v-if="!showArchiveInvoices"
                type="button"
                class="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-[11px]"
                @click="deleteInvoice(inv)"
              >
                Удалить
              </button>
              <button
                v-else
                type="button"
                class="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[11px]"
                @click="restoreInvoice(inv)"
              >
                Восстановить
              </button>
            </td>
          </tr>
          <tr v-if="!invoicesLoading && currentInvoices.length === 0">
            <td colspan="7" class="px-2 py-3 text-center text-slate-400">
              {{ showArchiveInvoices ? 'Архив накладных пуст.' : 'Накладные ещё не созданы.' }}
            </td>
          </tr>
        </tbody>
      </table>
      <div
        v-if="!invoicesLoading && currentInvoices.length > 0"
        class="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 border-t border-slate-800 pt-2"
      >
        <div>
          Всего накладных: <span class="font-semibold">{{ currentInvoices.length }}</span>
        </div>
        <div class="space-x-4 text-right">
          <span>
            Сумма: <span class="font-semibold">{{ currentTotals.totalAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} ₽</span>
          </span>
          <span>
            Доход: <span class="font-semibold">{{ currentTotals.totalIncome.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} ₽</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const router = useRouter();

const fileInput = ref<HTMLInputElement | null>(null);
const ocrLoading = ref(false);
const ocrError = ref('');
// Текст для отображения пользователю (из Azure или Tesseract)
const rawText = ref('');
// Текст, оптимальный для парсинга черновика (из Tesseract)
const rawTextForParsing = ref('');

interface InvoiceDraftItem {
  name: string;
  sku?: string;
  quantity: number;
  unit: string;
  price: number;
  purchasePriceCash: number;
  purchasePriceCashless: number;
  amount: number;
  contractor: string;
}

interface InvoiceDraft {
  number: string;
  date: string;
  paymentType: 'cash' | 'cashless';
  supplier: string;
  client: string;
  items: InvoiceDraftItem[];
  deliveryPrice: number;
  deliveryDriverId?: string | null;
  clientId?: string | null;
}

const invoiceDraft = ref<InvoiceDraft | null>(null);
const parseError = ref('');
const saveLoading = ref(false);
const saveError = ref('');
const saveSuccess = ref(false);

const attachmentsLoading = ref(false);
const attachmentsError = ref('');

interface InvoiceSummary {
  _id: string;
  number: string;
  date: string;
  supplier: string;
  client: string;
  totalAmount: number;
  totalIncome: number;
  paymentType?: 'cash' | 'cashless';
  isCancelled?: boolean;
   driverId?: string | null;
   driverName?: string | null;
   managerId?: string | null;
   managerName?: string | null;
}

const invoices = ref<InvoiceSummary[]>([]);
const archivedInvoices = ref<InvoiceSummary[]>([]);
const invoicesLoading = ref(false);
const invoicesError = ref('');
const showArchiveInvoices = ref(false);

const listNumberQuery = ref('');
const listClientQuery = ref('');
const listManagerQuery = ref('');
const listDriverQuery = ref('');
const listDateFrom = ref('');
const listDateTo = ref('');
const listPaymentFilter = ref<'all' | 'cash' | 'cashless'>('all');

// Режим редактирования существующей накладной
const editingInvoiceId = ref<string | null>(null);
const editingInvoiceRaw = ref<any | null>(null);

interface CounterpartyLight {
  _id: string;
  name: string;
}

const counterparties = ref<CounterpartyLight[]>([]);

interface DriverLight {
  _id: string;
  fullName: string;
}

const drivers = ref<DriverLight[]>([]);

interface ClientLight {
  _id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

const clientSearch = ref('');
const clientSearchResults = ref<ClientLight[]>([]);

interface ProductLight {
  _id: string;
  sku?: string;
  name: string;
  unit?: string;
  purchasePriceCash?: number;
  purchasePriceCashless?: number;
  lastSalePrice?: number;
}

const allProducts = ref<ProductLight[]>([]);

const activeNameRowIndex = ref<number | null>(null);
const currentNameSuggestions = ref<ProductLight[]>([]);

const ocrRowSuggestions = ref<Record<number, never>>({});

const totalAmount = computed(() => {
  if (!invoiceDraft.value) return 0;
  return invoiceDraft.value.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
});

const selectedClientLabel = computed(() => {
  if (!invoiceDraft.value || !invoiceDraft.value.clientId) return '';
  const inResults = clientSearchResults.value.find((c) => c._id === invoiceDraft.value!.clientId);
  if (inResults) {
    return inResults.name;
  }
  const fallbackName = (invoiceDraft.value.client || '').trim();
  if (fallbackName) return fallbackName;
  return `ID: ${invoiceDraft.value.clientId}`;
});

const hasCriticalErrors = computed(() => {
  if (!invoiceDraft.value) return false;
  return invoiceDraft.value.items.some((it) => {
    const nameMissing = !String(it.name || '').trim();
    const qty = Number(it.quantity);
    const qtyInvalid = !Number.isFinite(qty) || qty <= 0;
    const price = Number(it.price);
    const priceInvalid = !Number.isFinite(price) || price < 0;
    return nameMissing || qtyInvalid || priceInvalid;
  });
});

const baseList = computed(() => (showArchiveInvoices.value ? archivedInvoices.value : invoices.value));

const currentInvoices = computed(() => {
  const numQ = listNumberQuery.value.trim().toLowerCase();
  const clientQ = listClientQuery.value.trim().toLowerCase();
  const managerQ = listManagerQuery.value.trim().toLowerCase();
  const driverQ = listDriverQuery.value.trim().toLowerCase();
  const pay = listPaymentFilter.value;
  const from = listDateFrom.value ? new Date(listDateFrom.value) : null;
  const to = listDateTo.value ? new Date(listDateTo.value) : null;

  return baseList.value.filter((inv) => {
    const numOk = !numQ || String(inv.number || '').toLowerCase().includes(numQ);
    const clientOk = !clientQ || String(inv.client || '').toLowerCase().includes(clientQ);
    const managerOk = !managerQ || String(inv.managerName || '').toLowerCase().includes(managerQ);
    const driverOk = !driverQ || String(inv.driverName || '').toLowerCase().includes(driverQ);

    let dateOk = true;
    const d = new Date(inv.date);
    if (!Number.isNaN(d.getTime())) {
      if (from && d < from) dateOk = false;
      if (to) {
        const toEnd = new Date(to);
        toEnd.setHours(23, 59, 59, 999);
        if (d > toEnd) dateOk = false;
      }
    }

    const payOk =
      pay === 'all' ||
      (pay === 'cash' && inv.paymentType === 'cash') ||
      (pay === 'cashless' && inv.paymentType === 'cashless');

    return numOk && clientOk && managerOk && driverOk && dateOk && payOk;
  });
});

const currentTotals = computed(() => {
  return currentInvoices.value.reduce(
    (acc, inv) => {
      acc.totalAmount += Number(inv.totalAmount) || 0;
      acc.totalIncome += Number(inv.totalIncome) || 0;
      return acc;
    },
    { totalAmount: 0, totalIncome: 0 },
  );
});

const isRowCritical = (item: InvoiceDraftItem) => {
  const nameMissing = !String(item.name || '').trim();
  const qty = Number(item.quantity);
  const qtyInvalid = !Number.isFinite(qty) || qty <= 0;
  const price = Number(item.price);
  const priceInvalid = !Number.isFinite(price) || price < 0;
  return nameMissing || qtyInvalid || priceInvalid;
};

const computeOcrRowSuggestions = async (_item: InvoiceDraftItem, _rowIndex: number) => {
  // отключено по требованию: никаких вариантов не показываем
  return;
};

const resetListFilters = () => {
  listNumberQuery.value = '';
  listClientQuery.value = '';
   listManagerQuery.value = '';
   listDriverQuery.value = '';
  listDateFrom.value = '';
  listDateTo.value = '';
  listPaymentFilter.value = 'all';
};

const isRowWarning = (item: InvoiceDraftItem) => {
  const skuEmpty = !String(item.sku || '').trim();
  return skuEmpty && !isRowCritical(item);
};

const loadInvoices = async () => {
  invoicesLoading.value = true;
  invoicesError.value = '';
  try {
    const res = await axios.get('/api/v1/invoices');
    invoices.value = (res.data?.invoices || []) as InvoiceSummary[];
  } catch (e: any) {
    invoicesError.value = e?.response?.data?.message || 'Ошибка загрузки накладных';
  } finally {
    invoicesLoading.value = false;
  }
};

const onSelectAttachment = async (e: Event, type: 'photo' | 'scan') => {
  const input = e.target as HTMLInputElement;
  const file = input?.files?.[0];
  if (!file) return;
  if (!editingInvoiceId.value) return;

  attachmentsLoading.value = true;
  attachmentsError.value = '';
  try {
    const form = new FormData();
    form.append(type, file);
    const res = await axios.post(`/api/v1/invoices/${editingInvoiceId.value}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const updated = res.data?.invoice;
    if (updated) {
      editingInvoiceRaw.value = updated;
    }
  } catch (err: any) {
    attachmentsError.value = err?.response?.data?.message || 'Ошибка загрузки файла';
  } finally {
    attachmentsLoading.value = false;
    // позволяем выбрать тот же файл повторно
    if (input) input.value = '';
  }
};

const deleteAttachment = async (type: 'photo' | 'scan') => {
  if (!editingInvoiceId.value) return;

  attachmentsLoading.value = true;
  attachmentsError.value = '';
  try {
    const res = await axios.delete(`/api/v1/invoices/${editingInvoiceId.value}/attachments/${type}`);
    const updated = res.data?.invoice;
    if (updated) {
      editingInvoiceRaw.value = updated;
    }
  } catch (err: any) {
    attachmentsError.value = err?.response?.data?.message || 'Ошибка удаления файла';
  } finally {
    attachmentsLoading.value = false;
  }
};

const onClientSearchInput = async () => {
  const q = clientSearch.value.trim();
  if (!q) {
    clientSearchResults.value = [];
    return;
  }

  try {
    const res = await axios.get('/api/v1/clients', { params: { q } });
    clientSearchResults.value = (res.data?.clients || []) as ClientLight[];
  } catch {
    clientSearchResults.value = [];
  }
};

const selectClientFromSearch = (c: ClientLight) => {
  if (!invoiceDraft.value) return;
  invoiceDraft.value.clientId = c._id;
  if (!invoiceDraft.value.client || !invoiceDraft.value.client.trim()) {
    invoiceDraft.value.client = c.name;
  }
  clientSearchResults.value = [];
  clientSearch.value = c.name;
};

const clearSelectedClient = () => {
  if (!invoiceDraft.value) return;
  invoiceDraft.value.clientId = null;
};

const openPrint = (inv: InvoiceSummary) => {
  const url = router.resolve({ name: 'invoicePrint', params: { id: inv._id } }).href;
  window.open(url, '_blank');
};

const openBill = (inv: InvoiceSummary) => {
  const url = router.resolve({ name: 'invoiceBill', params: { id: inv._id } }).href;
  window.open(url, '_blank');
};

const loadInvoiceById = async (id: string) => {
  const res = await axios.get(`/api/v1/invoices/${id}`);
  return res.data?.invoice as any;
};

const loadCounterparties = async () => {
  try {
    const res = await axios.get('/api/v1/counterparties');
    counterparties.value = (res.data?.counterparties || []).map((c: any) => ({
      _id: c._id,
      name: String(c.name || ''),
    }));
  } catch {
    // если не удалось загрузить контрагентов - просто останется базовый список
  }
};

const loadDrivers = async () => {
  try {
    const res = await axios.get('/api/v1/drivers');
    drivers.value = (res.data?.drivers || []).map((d: any) => ({
      _id: d._id,
      fullName: String(d.fullName || ''),
    }));
  } catch {
    // если не удалось загрузить водителей - просто не будет списка
  }
};

const deleteInvoice = async (inv: InvoiceSummary) => {
  if (!window.confirm(`Отправить накладную №${inv.number} от ${new Date(inv.date).toLocaleDateString('ru-RU')} в архив?`)) {
    return;
  }

  try {
    await axios.delete(`/api/v1/invoices/${inv._id}`);
    await loadInvoices();
    if (showArchiveInvoices.value) {
      await loadArchivedInvoices();
    }
  } catch (e: any) {
    invoicesError.value = e?.response?.data?.message || 'Ошибка удаления накладной';
  }
};

const restoreInvoice = async (inv: InvoiceSummary) => {
  try {
    await axios.post(`/api/v1/invoices/${inv._id}/restore`);
    await loadInvoices();
    await loadArchivedInvoices();
  } catch (e: any) {
    invoicesError.value = e?.response?.data?.message || 'Ошибка восстановления накладной';
  }
};

const onToggleArchiveInvoices = async () => {
  if (showArchiveInvoices.value) {
    await loadArchivedInvoices();
  }
};

const loadArchivedInvoices = async () => {
  if (!showArchiveInvoices.value) return;
  try {
    const res = await axios.get('/api/v1/invoices/archived');
    archivedInvoices.value = (res.data?.invoices || []) as InvoiceSummary[];
  } catch {
    // архив вспомогательный, ошибки можно опустить
  }
};

const ensureProductsLoaded = async () => {
  try {
    const res = await axios.get('/api/v1/products');
    const products = res.data.products || [];
    allProducts.value = products.map((p: any): ProductLight => ({
      _id: p._id,
      name: p.name,
      sku: p.sku ?? null,
      unit: p.unit,
      purchasePriceCash: p.purchasePriceCash ?? null,
      purchasePriceCashless: p.purchasePriceCashless ?? null,
      lastSalePrice: p.lastSalePrice ?? null,
    }));
  } catch (e) {
    // при ошибке просто не будет автоподстановки по артикулу
  }
};

const createProductFromItem = async (item: InvoiceDraftItem) => {
  const name = (item.name || '').trim();
  if (!name) {
    parseError.value = 'Нельзя создать товар без названия.';
    return;
  }

  await ensureProductsLoaded();

  // Ищем максимальный числовой артикул и берём следующий
  const numericSkus = allProducts.value
    .map((p) => {
      const raw = String(p.sku || '').trim();
      const digits = raw.replace(/[^0-9]/g, '');
      const num = Number(digits);
      return Number.isFinite(num) ? num : null;
    })
    .filter((n): n is number => n !== null);

  const maxSku = numericSkus.length > 0 ? Math.max(...numericSkus) : 0;
  const nextSkuNum = maxSku + 1;
  const nextSku = String(nextSkuNum);

  try {
    const res = await axios.post('/api/v1/products', {
      name,
      sku: nextSku,
      unit: item.unit || 'шт',
      purchasePriceCash: item.purchasePriceCash || null,
      purchasePriceCashless: item.purchasePriceCashless || null,
      lastSalePrice: item.price || null,
      isActive: true,
    });

    const product = res.data?.product;
    if (product) {
      const light: ProductLight = {
        _id: product._id,
        name: product.name,
        sku: product.sku ?? nextSku,
        unit: product.unit,
        purchasePriceCash: product.purchasePriceCash ?? null,
        purchasePriceCashless: product.purchasePriceCashless ?? null,
        lastSalePrice: product.lastSalePrice ?? null,
      };
      allProducts.value.push(light);

      item.sku = light.sku || '';
      item.unit = light.unit || item.unit || 'шт';
      if (typeof light.lastSalePrice === 'number' && !Number.isNaN(light.lastSalePrice)) {
        item.price = light.lastSalePrice;
      }
      if (typeof light.purchasePriceCash === 'number' && !Number.isNaN(light.purchasePriceCash)) {
        item.purchasePriceCash = light.purchasePriceCash;
      }
      if (typeof light.purchasePriceCashless === 'number' && !Number.isNaN(light.purchasePriceCashless)) {
        item.purchasePriceCashless = light.purchasePriceCashless;
      }

      recomputeAmount(item);
      parseError.value = '';
    } else {
      parseError.value = 'Не удалось создать товар.';
    }
  } catch (e: any) {
    parseError.value = e?.response?.data?.message || 'Ошибка при создании товара';
  }
};

const recomputeAmount = (item: InvoiceDraftItem) => {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.price) || 0;
  if (qty > 0 && price > 0) {
    item.amount = qty * price;
  } else if (!qty || !price) {
    // если одно из полей обнулили — не держим старую сумму
    item.amount = 0;
  }
};

const normalizeName = (v: string) =>
  String(v || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeName = (name: string): string[] => {
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
  if (aHasNum || bHasNum) return a === b;
  const minLen = Math.min(a.length, b.length);
  if (minLen >= 5) {
    const d = editDistance(a, b);
    if (d <= 1) return true;
  }
  if (a.length >= 4 && b.length >= 4) {
    if (a.includes(b) || b.includes(a)) return true;
  }
  return false;
};

const computeNameSimilarity = (aRaw: string, bRaw: string): number => {
  const ta = tokenizeName(aRaw);
  const tb = tokenizeName(bRaw);
  if (ta.length === 0 || tb.length === 0) return 0;

  const used = new Array(tb.length).fill(false);
  let matched = 0;

  for (const t of ta) {
    for (let i = 0; i < tb.length; i++) {
      if (used[i]) continue;
      if (tokenMatch(t, tb[i])) {
        used[i] = true;
        matched += 1;
        break;
      }
    }
  }

  // 95% = покрытие токенов из вводимой (OCR) строки
  const denom = ta.length || 1;
  return matched / denom;
};

const onSkuBlur = async (item: InvoiceDraftItem) => {
  const raw = (item.sku || '').trim();
  if (!raw) return;

  await ensureProductsLoaded();

  const normalizeSku = (v: string) => v.replace(/\s+/g, '').toLowerCase();
  const skuNorm = normalizeSku(raw);

  let product = allProducts.value.find((p) => normalizeSku(String(p.sku || '')) === skuNorm);
  if (!product) {
    product = allProducts.value.find((p) => normalizeSku(String(p.sku || '')).includes(skuNorm));
  }

  if (!product) {
    parseError.value = `Товар по артикулу "${raw}" не найден в базе.`;
    return;
  }

  parseError.value = '';

  item.name = product.name;
  item.unit = product.unit || 'шт';

  if (typeof product.lastSalePrice === 'number' && !Number.isNaN(product.lastSalePrice)) {
    item.price = product.lastSalePrice;
  }
  if (typeof product.purchasePriceCash === 'number' && !Number.isNaN(product.purchasePriceCash)) {
    item.purchasePriceCash = product.purchasePriceCash;
  }
  if (typeof product.purchasePriceCashless === 'number' && !Number.isNaN(product.purchasePriceCashless)) {
    item.purchasePriceCashless = product.purchasePriceCashless;
  }

  recomputeAmount(item);
};

const onNameBlur = async (item: InvoiceDraftItem, rowIndex: number) => {
  const raw = (item.name || '').trim();

  // Если поле пустое — ничего не делаем
  if (!raw) return;

  await ensureProductsLoaded();

  let best: { product: ProductLight | null; score: number } = { product: null, score: 0 };
  for (const p of allProducts.value) {
    const score = computeNameSimilarity(raw, p.name || '');
    if (score > best.score) {
      best = { product: p, score };
    }
  }

  // Если лучший кандидат совпадает по названию меньше чем примерно на 95%,
  // автоматически ничего не подставляем
  if (!best.product || best.score < 0.95) {
    parseError.value = '';
    return;
  }

  applyNameSuggestion(item, best.product);
  parseError.value = '';
};

const onNameInput = async (item: InvoiceDraftItem, rowIndex: number) => {
  const raw = (item.name || '').trim();

  // если поле очистили — убираем подсказки
  if (!raw) {
    currentNameSuggestions.value = [];
    activeNameRowIndex.value = null;
    return;
  }

  await ensureProductsLoaded();

  const q = raw.toLowerCase();

  // ищем совпадения по названию и артикулу, ограничиваем до 10 штук
  const suggestions = allProducts.value
    .filter((p) => {
      const name = (p.name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      return name.includes(q) || sku.includes(q);
    })
    .slice(0, 10);

  currentNameSuggestions.value = suggestions;
  activeNameRowIndex.value = suggestions.length > 0 ? rowIndex : null;
  parseError.value = '';
};

const applyNameSuggestion = (item: InvoiceDraftItem, product: ProductLight) => {
  item.name = product.name;
  item.sku = product.sku || '';
  item.unit = product.unit || 'шт';

  if (typeof product.lastSalePrice === 'number' && !Number.isNaN(product.lastSalePrice)) {
    item.price = product.lastSalePrice;
  }
  if (typeof product.purchasePriceCash === 'number' && !Number.isNaN(product.purchasePriceCash)) {
    item.purchasePriceCash = product.purchasePriceCash;
  }
  if (typeof product.purchasePriceCashless === 'number' && !Number.isNaN(product.purchasePriceCashless)) {
    item.purchasePriceCashless = product.purchasePriceCashless;
  }

  const qty = Number(item.quantity) || 0;
  const price = Number(item.price) || 0;
  if (qty > 0 && price > 0) {
    item.amount = qty * price;
  }

  // после выбора скрываем подсказки
  currentNameSuggestions.value = [];
  activeNameRowIndex.value = null;
  parseError.value = '';
};

const onFileChange = async () => {
  const files = fileInput.value?.files;
  if (!files || files.length === 0) return;

  ocrError.value = '';
  rawText.value = '';
  ocrLoading.value = true;

  const formData = new FormData();
  Array.from(files).forEach((file) => {
    formData.append('files', file);
  });

  try {
    const res = await axios.post('/api/v1/ocr/invoice', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    rawText.value = res.data.rawTextForDisplay || res.data.rawText || '';
    rawTextForParsing.value = res.data.rawTextForParsing || res.data.rawText || '';
  } catch (e: any) {
    ocrError.value = e?.response?.data?.message || 'Ошибка распознавания накладной';
  } finally {
    ocrLoading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
};

const fillFromText = async () => {
  if (!rawTextForParsing.value) return;
  parseError.value = '';

  try {
    const res = await axios.post('/api/v1/ocr/parse', { rawText: rawTextForParsing.value });
    const draft = res.data?.draft;
    if (!draft) {
      parseError.value = 'Не удалось разобрать текст накладной';
      return;
    }

    // Автоматически определяем сумму доставки по строке "доставка",
    // но саму строку в список товаров не добавляем.
    let autoDeliveryPrice = 0;
    if (Array.isArray(draft.items)) {
      for (const it of draft.items as any[]) {
        const name = String(it.name || '').toLowerCase();
        if (name.includes('доставк')) {
          const qty = Number(it.quantity) || 0;
          const price = Number(it.price) || 0;
          const amount = Number(it.amount) || qty * price;
          if (amount > 0) {
            autoDeliveryPrice = amount; // берём последнюю подходящую строку
          }
        }
      }
    }

    invoiceDraft.value = {
      number: draft.number || '',
      date: draft.date || '',
      paymentType: 'cashless',
      supplier: draft.supplier || '',
      client: draft.client || '',
      deliveryPrice: autoDeliveryPrice,
      items: (
        Array.isArray(draft.items)
          ? draft.items
              .filter((it: any) => {
                const name = String(it.name || '').toLowerCase();
                return !name.includes('доставк');
              })
              .map((it: any) => ({
                name: String(it.name || ''),
                sku: it.sku ? String(it.sku) : '',
                quantity: Number(it.quantity) || 0,
                unit: String(it.unit || 'шт'),
                price: Number(it.price) || 0,
                purchasePriceCash: Number(it.purchasePriceCash ?? 0) || 0,
                purchasePriceCashless: Number(it.purchasePriceCashless ?? 0) || 0,
                amount: Number(it.amount) || 0,
                contractor: 'ДРУГОЙ',
              }))
          : []
      ),
    };

    // отключено по требованию: никаких вариантов не показываем
    ocrRowSuggestions.value = {};
  } catch (e: any) {
    parseError.value = e?.response?.data?.message || 'Ошибка разбора текста накладной';
  }
};

const addItem = () => {
  if (!invoiceDraft.value) {
    invoiceDraft.value = {
      number: '',
      date: '',
      paymentType: 'cashless',
      supplier: '',
      client: '',
      clientId: null,
      deliveryPrice: 0,
      items: [],
    };
  }

  invoiceDraft.value.items.push({
    name: '',
    sku: '',
    quantity: 1,
    unit: 'шт',
    price: 0,
    purchasePriceCash: 0,
    purchasePriceCashless: 0,
    amount: 0,
    contractor: 'ДРУГОЙ',
  });
};

const saveInvoice = async () => {
  if (!invoiceDraft.value) return;

  saveError.value = '';
  saveSuccess.value = false;
  saveLoading.value = true;

  try {
    const base: any = editingInvoiceRaw.value ? { ...editingInvoiceRaw.value } : {};

    const payload: any = {
      ...base,
      number: invoiceDraft.value.number || '',
      date: invoiceDraft.value.date || new Date().toISOString(),
      supplier: invoiceDraft.value.supplier || '',
      client: invoiceDraft.value.client || '',
      paymentType: invoiceDraft.value.paymentType || 'cashless',
      deliveryPrice: Number(invoiceDraft.value.deliveryPrice) || 0,
      driver: invoiceDraft.value.deliveryDriverId || null,
      clientId: invoiceDraft.value.clientId || null,
      source: base.source || 'ocr',
      ocrRawText: base.ocrRawText || rawText.value || '',
      items: invoiceDraft.value.items.map((it) => ({
        name: it.name || '',
        sku: it.sku || '',
        quantity: Number(it.quantity) || 0,
        unit: it.unit || 'шт',
        salePrice: Number(it.price) || 0,
        purchasePriceCash: Number(it.purchasePriceCash) || 0,
        purchasePriceCashless: Number(it.purchasePriceCashless) || 0,
        contractor: it.contractor || 'ДРУГОЙ',
        purchasePrice: null,
      })),
    };

    let res;
    if (editingInvoiceId.value) {
      res = await axios.put(`/api/v1/invoices/${editingInvoiceId.value}`, payload);
    } else {
      res = await axios.post('/api/v1/invoices', payload);
    }

    if (res.status === 201 || res.status === 200) {
      saveSuccess.value = true;
      editingInvoiceId.value = null;
      editingInvoiceRaw.value = null;
      invoiceDraft.value = null;
      await loadInvoices();
    } else {
      saveError.value = 'Ошибка при сохранении накладной';
    }
  } catch (e: any) {
    saveError.value = e?.response?.data?.message || 'Ошибка при сохранении накладной';
  } finally {
    saveLoading.value = false;
  }
};

const downloadInvoicePdf = async (inv: InvoiceSummary) => {
  try {
    const res = await axios.get(`/api/v1/invoices/${inv._id}/pdf`, {
      responseType: 'blob',
    });

    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice-${inv.number || inv._id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  } catch (e: any) {
    invoicesError.value = e?.response?.data?.message || 'Ошибка скачивания PDF накладной';
  }
};

const editInvoice = async (inv: InvoiceSummary) => {
  try {
    const full = await loadInvoiceById(inv._id);
    editingInvoiceId.value = inv._id;
    editingInvoiceRaw.value = full;

    invoiceDraft.value = {
      number: full.number || '',
      date: full.date ? new Date(full.date).toISOString().slice(0, 10) : '',
      paymentType: (full.paymentType as 'cash' | 'cashless') || 'cashless',
      supplier: full.supplier || '',
      client: full.client || '',
      clientId: (full.clientRef as string) || null,
      deliveryPrice: Number(full.deliveryPrice ?? 0) || 0,
      deliveryDriverId: (full.driver as string) || '',
      items: (full.items || []).map((it: any) => ({
        name: it.name || '',
        sku: it.sku || (it.product && it.product.sku) || '',
        quantity: Number(it.quantity) || 0,
        unit: it.unit || 'шт',
        price: Number(it.salePrice) || 0,
        purchasePriceCash: Number(it.purchasePriceCash ?? 0) || 0,
        purchasePriceCashless: Number(it.purchasePriceCashless ?? 0) || 0,
        amount: Number(it.salePrice || 0) * Number(it.quantity || 0),
        contractor: it.contractor || 'ДРУГОЙ',
      })),
    };

    parseError.value = '';
    saveError.value = '';
    saveSuccess.value = false;
  } catch (e: any) {
    invoicesError.value = e?.response?.data?.message || 'Ошибка загрузки накладной для редактирования';
  }
};

onMounted(() => {
  loadInvoices();
  loadCounterparties();
  loadDrivers();
});
</script>

<style scoped></style>
