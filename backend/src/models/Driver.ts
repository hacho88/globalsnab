import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDriver extends Document {
  fullName: string;
  phone?: string;
  car?: Types.ObjectId; // текущая закреплённая машина
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DriverSchema = new Schema<IDriver>(
  {
    fullName: { type: String, required: true },
    phone: { type: String },
    car: { type: Schema.Types.ObjectId, ref: 'Car' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const DriverModel = mongoose.model<IDriver>('Driver', DriverSchema);
