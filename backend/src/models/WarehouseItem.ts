import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWarehouseItem extends Document {
  product: Types.ObjectId;
  currentStock: number;
  minStock: number;
  location?: string | null;
  lastInDate?: Date | null;
  lastOutDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseItemSchema = new Schema<IWarehouseItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    currentStock: { type: Number, required: true, default: 0 },
    minStock: { type: Number, required: true, default: 0 },
    location: { type: String },
    lastInDate: { type: Date },
    lastOutDate: { type: Date },
  },
  { timestamps: true }
);

export const WarehouseItemModel = mongoose.model<IWarehouseItem>('WarehouseItem', WarehouseItemSchema);
