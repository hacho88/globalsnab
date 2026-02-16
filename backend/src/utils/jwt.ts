import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../models/User';

export interface JwtPayload {
  sub: string;
  role: UserRole;
}

export const signAccessToken = (userId: string, role: UserRole): string => {
  const payload: JwtPayload = { sub: userId, role };
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: '1h' });
};

export const signRefreshToken = (userId: string, role: UserRole): string => {
  const payload: JwtPayload = { sub: userId, role };
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: '7d' });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.jwtAccessSecret) as JwtPayload;
};
