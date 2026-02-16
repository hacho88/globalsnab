import mongoose, { Document, Schema, Types } from 'mongoose';

export type CarExpenseType = 'fuel' | 'service' | 'fine' | 'insurance' | 'tax' | 'other';

export interface ICarExpense extends Document {
  car: Types.ObjectId;
  date: Date;
  type: CarExpenseType;
  amount: number;
  description?: string;
  odometer?: number; // пробег на момент расхода
  createdAt: Date;
  updatedAt: Date;
}

const CarExpenseSchema = new Schema<ICarExpense>(
  {
    car: { type: Schema.Types.ObjectId, ref: 'Car', required: true },
    date: { type: Date, required: true },
    type: { type: String, enum: ['fuel', 'service', 'fine', 'insurance', 'tax', 'other'], required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    odometer: { type: Number },
  },
  { timestamps: true }
);

export const CarExpenseModel = mongoose.model<ICarExpense>('CarExpense', CarExpenseSchema);
