import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'admin' | 'manager';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  // Набор прав пользователя по модулям, например: { invoices: true, stock: false }
  permissions?: Record<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    role: { type: String, enum: ['admin', 'manager'], required: true, default: 'manager' },
    isActive: { type: Boolean, default: true },
    permissions: { type: Object, default: {} },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<IUser>('User', UserSchema);
