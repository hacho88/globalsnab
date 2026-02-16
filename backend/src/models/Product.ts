import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  sku?: string | null;
  name: string;
  category?: string | null;
  unit: string;
  description?: string | null;
  imageUrl?: string | null;
  baseSource?: string | null;
  purchasePriceCash?: number | null;
  purchasePriceCashless?: number | null;
  lastSalePrice?: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    sku: { type: String, index: true },
    name: { type: String, required: true, index: true },
    category: { type: String },
    unit: { type: String, required: true },
    description: { type: String },
    imageUrl: { type: String },
    baseSource: { type: String },
    purchasePriceCash: { type: Number },
    purchasePriceCashless: { type: Number },
    lastSalePrice: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ProductSchema.index({ name: 1, unit: 1 }, { unique: false });

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);
