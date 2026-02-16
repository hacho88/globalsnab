import mongoose, { Schema, Document } from 'mongoose';

export interface ICounterparty extends Document {
  name: string;
  phone?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CounterpartySchema = new Schema<ICounterparty>(
  {
    name: { type: String, required: true, index: true },
    phone: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CounterpartySchema.index({ name: 1 }, { unique: false });

export const CounterpartyModel = mongoose.model<ICounterparty>('Counterparty', CounterpartySchema);
