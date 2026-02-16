import mongoose, { Schema, Document, Types } from 'mongoose';

export type ContractorType =
  | 'НАШ СКЛАД'
  | 'ФАМАРКЕТ'
  | 'БАКЫТ'
  | 'МЕТАЛЛТРЕЙД'
  | 'СТРОЙОПТ'
  | 'ДРУГОЙ';

export interface IInvoiceItem extends Document {
  product?: Types.ObjectId | null;
  sku?: string | null;
  name: string;
  quantity: number;
  unit: string;
  salePrice: number;
  purchasePriceCash?: number | null;
  purchasePriceCashless?: number | null;
  contractor: string;
  purchasePrice?: number | null;
  income: number;
  paidToContractor?: boolean;
}

export interface IInvoice extends Document {
  number: string;
  date: Date;
  supplier: string;
  client: string;
  clientRef?: Types.ObjectId | null;
  paymentType: 'cash' | 'cashless';
  items: Types.DocumentArray<IInvoiceItem>;
  car?: Types.ObjectId | null;
  driver?: Types.ObjectId | null;
  photoFile?: string | null;
  scanFile?: string | null;
  deliveryPrice: number;
  totalAmount: number;
  totalIncome: number;
  source: 'manual' | 'ocr';
  ocrRawText?: string | null;
  ocrMeta?: any;
  createdBy: Types.ObjectId;
  isCancelled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    sku: { type: String },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    salePrice: { type: Number, required: true },
    purchasePriceCash: { type: Number },
    purchasePriceCashless: { type: Number },
    contractor: {
      type: String,
      required: true,
    },
    purchasePrice: { type: Number },
    income: { type: Number, required: true },
    paidToContractor: { type: Boolean, default: false },
  },
  { _id: true }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    number: { type: String, required: true },
    date: { type: Date, required: true },
    supplier: { type: String, required: true },
    client: { type: String, required: true },
    clientRef: { type: Schema.Types.ObjectId, ref: 'Client' },
    paymentType: { type: String, enum: ['cash', 'cashless'], required: true },
    items: { type: [InvoiceItemSchema], default: [] },
    car: { type: Schema.Types.ObjectId, ref: 'Car' },
    driver: { type: Schema.Types.ObjectId, ref: 'Driver' },
    photoFile: { type: String },
    scanFile: { type: String },
    deliveryPrice: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true },
    totalIncome: { type: Number, required: true },
    source: { type: String, enum: ['manual', 'ocr'], required: true, default: 'manual' },
    ocrRawText: { type: String },
    ocrMeta: { type: Schema.Types.Mixed },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isCancelled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

InvoiceSchema.index({ date: -1 });
InvoiceSchema.index({ number: 1 });

export const InvoiceModel = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
