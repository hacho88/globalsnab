import mongoose, { Schema, Document } from 'mongoose';

export interface IClient extends Document {
  name: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true, index: true },
    phone: { type: String },
    email: { type: String },
    city: { type: String },
    address: { type: String },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ClientSchema.index({ name: 1 });
ClientSchema.index({ phone: 1 });

export const ClientModel = mongoose.model<IClient>('Client', ClientSchema);
