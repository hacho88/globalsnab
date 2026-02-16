import mongoose, { Schema } from 'mongoose';

export type CarFuelType = 'gasoline' | 'diesel' | 'gas' | 'hybrid' | 'electric' | 'other';

export interface ICar {
  name: string; // внутреннее название, например "Газель #1"
  plateNumber: string; // госномер
  brand?: string;
  model?: string;
  year?: number;
  vin?: string;
  fuelType?: CarFuelType;
  oilChangeIntervalKm?: number; // через сколько км менять масло
  lastOilChangeOdometer?: number; // пробег на последней замене масла
  currentOdometer?: number; // текущий пробег
  driverSharePercent?: number; // доля водителя от стоимости доставки (0.33 или 0.5)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CarSchema = new Schema<ICar>(
  {
    name: { type: String, required: true },
    plateNumber: { type: String, required: true, trim: true },
    brand: { type: String },
    model: { type: String },
    year: { type: Number },
    vin: { type: String },
    fuelType: { type: String, enum: ['gasoline', 'diesel', 'gas', 'hybrid', 'electric', 'other'], default: 'gasoline' },
    oilChangeIntervalKm: { type: Number, default: 10000 },
    lastOilChangeOdometer: { type: Number, default: 0 },
    currentOdometer: { type: Number, default: 0 },
    driverSharePercent: { type: Number, default: 0.5 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const CarModel = mongoose.model<ICar>('Car', CarSchema);
