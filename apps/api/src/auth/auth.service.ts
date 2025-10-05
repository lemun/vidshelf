import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { User } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtTokenPair } from './interfaces/jwt-token-pair';
import { RefreshToken } from './schemas/refresh-token.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel('User') private readonly userModel: Model<User>,
    @InjectModel(RefreshToken.name) private readonly rtModel: Model<RefreshToken>,
  ) {}

  async register(_dto: RegisterDto) {
    // TODO: create user, hash password, save, issue tokens
    return { user: null, tokens: null};
  }

  async login(_dto: LoginDto) {
    // TODO: validate creds, issue tokens
    return { user: null, tokens: null };
  }

  async logout(_userId: string) {
    // TODO: revoke refresh tokens
    return { success: true };
  }

  async rotateRefreshToken(_refreshToken: string) {
    // TODO: verify, rotate tokens
    return { tokens: null };
  }

  async getProfile(_userId: string) {
    // TODO: return safe user
    return { user: null };
  }

  async issueTokenPair(_user: User): Promise<JwtTokenPair> {
    return { accessToken: '', refreshToken: '' };
  }

  async storeRefreshToken(_userId: Types.ObjectId, _refreshToken: string, _meta?: { ip?: string, userAgent?: string }) {
    return {};
  }

  async revokeRefreshToken(_userId: string, _token?: string) {
    return { success: true };
  }
}
