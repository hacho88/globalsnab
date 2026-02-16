import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICheckItem extends Document {
  product?: Types.ObjectId | null;
  sku?: string | null;
  name: string;
  quantity: number;
  price: number;
  amount: number;
}

export interface ICheck extends Document {
  number: string; // номер чека (автонумерация)
  date: Date; // дата и время чека
  items: Types.DocumentArray<ICheckItem>;
  totalAmount: number; // итоговая сумма чека
  comment?: string | null; // примечание к чеку
  shopName?: string | null; // название магазина в шапке
  shopAddress?: string | null; // адрес
  shopContacts?: string | null; // контакты
  createdBy: Types.ObjectId; // пользователь, создавший чек
  createdAt: Date;
  updatedAt: Date;
}

const CheckItemSchema = new Schema<ICheckItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    sku: { type: String },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: true }
);

const CheckSchema = new Schema<ICheck>(
  {
    number: { type: String, required: true },
    date: { type: Date, required: true },
    items: { type: [CheckItemSchema], default: [] },
    totalAmount: { type: Number, required: true },
    comment: { type: String },
    shopName: { type: String },
    shopAddress: { type: String },
    shopContacts: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

CheckSchema.index({ date: -1 });
CheckSchema.index({ number: 1 });

export const CheckModel = mongoose.model<ICheck>('Check', CheckSchema);
