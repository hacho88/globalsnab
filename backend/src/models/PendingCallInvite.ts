import mongoose, { Schema, Document } from 'mongoose';

export interface IPendingCallInvite extends Document {
  toUserId: string;
  fromUserId: string;
  callId: string;
  kind: 'audio' | 'video';
  createdAt: Date;
  updatedAt: Date;
}

const PendingCallInviteSchema = new Schema<IPendingCallInvite>(
  {
    toUserId: { type: String, required: true, index: true },
    fromUserId: { type: String, required: true },
    callId: { type: String, required: true },
    kind: { type: String, required: true, enum: ['audio', 'video'] },
  },
  { timestamps: true }
);

// auto-expire pending invites (seconds)
PendingCallInviteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 });
PendingCallInviteSchema.index({ toUserId: 1, callId: 1 }, { unique: true });

export const PendingCallInviteModel = mongoose.model<IPendingCallInvite>(
  'PendingCallInvite',
  PendingCallInviteSchema
);
