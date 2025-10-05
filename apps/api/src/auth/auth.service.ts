import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Model, Types } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { comparePassword, generateHash } from '../utils/bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { REFRESH_TOKEN_SECRET, REFRESH_TOKEN_TTL } from './interfaces/constants';
import { JwtTokenPair } from './interfaces/jwt-token-pair';
import { RefreshToken } from './schemas/refresh-token.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel('User') private readonly userModel: Model<User>,
    @InjectModel(RefreshToken.name) private readonly rtModel: Model<RefreshToken>,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.userModel.findOne({
      $or: [{ email: dto.email }, { username: dto.username }]
    });

    if (existingUser) {
      throw new ConflictException('User with this email or username already exists');
    }

    const passwordHash = await generateHash(dto.password);
    const user = new this.userModel({
      username: dto.username,
      email: dto.email,
      passwordHash,
    });

    await user.save();
    const tokens = await this.issueTokenPair(user);
    await this.storeRefreshToken(user._id, tokens.refreshToken);

    return {
      user: this.getSafeUser(user),
      tokens
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await comparePassword(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokenPair(user);

    await this.storeRefreshToken(user._id, tokens.refreshToken);

    return {
      user: this.getSafeUser(user),
      tokens
    };
  }

  async logout(userId: string) {
    await this.revokeRefreshToken(userId);
    return { success: true };
  }

  async rotateRefreshToken(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const storedToken = await this.rtModel.findOne({
      tokenHash,
      revoked: false,
      expiresAt: { $gt: new Date() }
    }).populate('user');

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.rtModel.findByIdAndUpdate(storedToken._id, { revoked: true });

    const tokens = await this.issueTokenPair(storedToken.user as unknown as User);

    await this.storeRefreshToken(storedToken.user, tokens.refreshToken);

    return { tokens };
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { user: this.getSafeUser(user) };
  }

  async issueTokenPair(user: User): Promise<JwtTokenPair> {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      username: user.username
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
      expiresIn: REFRESH_TOKEN_TTL
    });

    return { accessToken, refreshToken };
  }

  async storeRefreshToken(userId: Types.ObjectId, refreshToken: string, meta?: { ip?: string, userAgent?: string }) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + parseInt(REFRESH_TOKEN_TTL) * 1000);

    const refreshTokenDoc = new this.rtModel({
      user: userId,
      tokenHash,
      userAgent: meta?.userAgent,
      ip: meta?.ip,
      expiresAt
    });

    await refreshTokenDoc.save();
    return refreshTokenDoc;
  }

  async revokeRefreshToken(userId: string, token?: string) {
    const filter: any = { user: userId, revoked: false };

    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      filter.tokenHash = tokenHash;
    }

    await this.rtModel.updateMany(filter, { revoked: true });
    return { success: true };
  }

  private getSafeUser(user: User) {
    const userObj = (user as any).toObject ? (user as any).toObject() : user;
    const { passwordHash, ...safeUser } = userObj;
    return safeUser;
  }
}
