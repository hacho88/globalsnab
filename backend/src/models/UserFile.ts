import mongoose, { Schema, Document } from 'mongoose';

export interface IUserFile extends Document {
  fromUserId: string;
  toUserId: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserFileSchema = new Schema<IUserFile>(
  {
    fromUserId: { type: String, required: true, index: true },
    toUserId: { type: String, required: true, index: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storagePath: { type: String, required: true },
  },
  { timestamps: true }
);

export const UserFileModel = mongoose.model<IUserFile>('UserFile', UserFileSchema);
