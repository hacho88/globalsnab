import mongoose, { Schema, Document } from 'mongoose';

export type OperatingExpenseCategory =
  | 'rent'
  | 'salary'
  | 'fuel'
  | 'carService'
  | 'utilities'
  | 'marketing'
  | 'taxes'
  | 'other';

export interface IOperatingExpense extends Document {
  date: Date;
  amount: number;
  category: OperatingExpenseCategory | string;
  description?: string | null;
  isFixed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OperatingExpenseSchema = new Schema<IOperatingExpense>(
  {
    date: { type: Date, required: true, index: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    description: { type: String },
    isFixed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

OperatingExpenseSchema.index({ date: 1, category: 1 });

export const OperatingExpenseModel = mongoose.model<IOperatingExpense>('OperatingExpense', OperatingExpenseSchema);
