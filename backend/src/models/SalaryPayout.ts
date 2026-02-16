import mongoose, { Document, Schema, Types } from 'mongoose';

export type SalaryPayoutPersonType = 'driver' | 'manager';

export interface ISalaryPayout extends Document {
  monthKey: string; // YYYY-MM (month of accrual)
  personType: SalaryPayoutPersonType;
  personId: Types.ObjectId;
  amount: number;
  paidAt: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SalaryPayoutSchema = new Schema<ISalaryPayout>(
  {
    monthKey: { type: String, required: true, index: true },
    personType: { type: String, enum: ['driver', 'manager'], required: true, index: true },
    personId: { type: Schema.Types.ObjectId, required: true, index: true },
    amount: { type: Number, required: true },
    paidAt: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

SalaryPayoutSchema.index({ monthKey: 1, personType: 1, personId: 1 }, { unique: true });

export const SalaryPayoutModel = mongoose.model<ISalaryPayout>('SalaryPayout', SalaryPayoutSchema);
