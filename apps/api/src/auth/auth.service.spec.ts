import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { Env } from '../config/env';
import type { UserDocument } from '../users/schemas/user.schema';
import type { UsersService } from '../users/users.service';
import { AuthService, hashToken } from './auth.service';
import type { RefreshToken } from './schemas/refresh-token.schema';

const ENV: Partial<Env> = {
  JWT_ACCESS_SECRET: 'unit-test-access-secret-0123456789abcdef',
  JWT_REFRESH_SECRET: 'unit-test-refresh-secret-0123456789abcdef',
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 3600,
  BCRYPT_ROUNDS: 4,
};

interface TokenRow {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/**
 * In-memory stand-in for the RefreshToken model, implementing only the query shapes AuthService
 * uses. It lets the rotation and reuse-detection rules run for real without a database.
 */
class FakeRefreshTokens {
  rows: TokenRow[] = [];

  create(doc: Omit<TokenRow, '_id' | 'revokedAt'>) {
    const row = { _id: new Types.ObjectId(), revokedAt: null, ...doc };
    this.rows.push(row);
    return Promise.resolve(row);
  }

  findOneAndUpdate(
    filter: { tokenHash: string; expiresAt: { $gt: Date } },
    update: { $set: { revokedAt: Date } },
  ) {
    const row = this.rows.find(
      (r) =>
        r.tokenHash === filter.tokenHash &&
        r.revokedAt === null &&
        r.expiresAt > filter.expiresAt.$gt,
    );
    if (row) row.revokedAt = update.$set.revokedAt;
    // Mongoose returns the document as it was before the update by default.
    return exec(row ? { ...row, revokedAt: null } : null);
  }

  findOne(filter: { tokenHash: string }) {
    return exec(this.rows.find((r) => r.tokenHash === filter.tokenHash) ?? null);
  }

  updateOne(filter: { tokenHash: string }, update: { $set: { revokedAt: Date } }) {
    const row = this.rows.find((r) => r.tokenHash === filter.tokenHash && r.revokedAt === null);
    if (row) row.revokedAt = update.$set.revokedAt;
    return exec({ modifiedCount: row ? 1 : 0 });
  }

  updateMany(filter: { user: string }, update: { $set: { revokedAt: Date } }) {
    let modifiedCount = 0;
    for (const row of this.rows) {
      if (row.user.toString() === filter.user && row.revokedAt === null) {
        row.revokedAt = update.$set.revokedAt;
        modifiedCount++;
      }
    }
    return exec({ modifiedCount });
  }

  active(): TokenRow[] {
    return this.rows.filter((r) => r.revokedAt === null);
  }
}

function exec<T>(value: T) {
  return { exec: () => Promise.resolve(value) };
}

function makeUser(
  overrides: Partial<{ username: string; email: string; passwordHash: string }> = {},
) {
  return {
    _id: new Types.ObjectId(),
    username: 'demo_user',
    email: 'demo@example.com',
    passwordHash: '',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as unknown as UserDocument;
}

describe('AuthService', () => {
  let tokens: FakeRefreshTokens;
  let users: jest.Mocked<
    Pick<
      UsersService,
      'findById' | 'findByEmailWithPassword' | 'existsByEmailOrUsername' | 'create'
    >
  >;
  let service: AuthService;
  let user: UserDocument;

  beforeEach(async () => {
    tokens = new FakeRefreshTokens();
    user = makeUser({ passwordHash: await bcrypt.hash('correct-horse-42', 4) });
    users = {
      findById: jest.fn().mockResolvedValue(user),
      findByEmailWithPassword: jest.fn().mockResolvedValue(user),
      existsByEmailOrUsername: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue(user),
    };
    const config = { get: (key: keyof Env) => ENV[key] } as unknown as ConfigService<Env, true>;
    service = new AuthService(
      new JwtService({}),
      users as unknown as UsersService,
      config,
      tokens as unknown as Model<RefreshToken>,
    );
  });

  describe('register', () => {
    it('hashes the password and returns a session whose refresh token is stored only as a hash', async () => {
      const session = await service.register({
        username: 'demo_user',
        email: 'demo@example.com',
        password: 'correct-horse-42',
      });

      const created = users.create.mock.calls[0][0];
      expect(created.passwordHash).not.toBe('correct-horse-42');
      expect(await bcrypt.compare('correct-horse-42', created.passwordHash)).toBe(true);

      expect(session.user).toEqual({
        id: user._id.toString(),
        username: 'demo_user',
        email: 'demo@example.com',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(session.user).not.toHaveProperty('passwordHash');
      expect(tokens.rows).toHaveLength(1);
      expect(tokens.rows[0].tokenHash).toBe(hashToken(session.refreshToken));
      expect(tokens.rows[0].tokenHash).not.toBe(session.refreshToken);
    });

    it('rejects a taken email or username', async () => {
      users.existsByEmailOrUsername.mockResolvedValue(true);
      await expect(
        service.register({
          username: 'demo_user',
          email: 'demo@example.com',
          password: 'abc12345',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('issues an access token carrying the user id and name', async () => {
      const session = await service.login({
        email: 'demo@example.com',
        password: 'correct-horse-42',
      });
      const payload = new JwtService({}).verify<{ sub: string; username: string }>(
        session.accessToken,
        {
          secret: ENV.JWT_ACCESS_SECRET,
        },
      );
      expect(payload).toMatchObject({ sub: user._id.toString(), username: 'demo_user' });
    });

    it('rejects a wrong password and an unknown email the same way', async () => {
      await expect(
        service.login({ email: 'demo@example.com', password: 'wrong-pass-1' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
      users.findByEmailWithPassword.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever-1' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
      expect(tokens.rows).toHaveLength(0);
    });
  });

  describe('refresh (rotation)', () => {
    it('consumes the presented token and issues a new pair', async () => {
      const first = await service.login({
        email: 'demo@example.com',
        password: 'correct-horse-42',
      });
      const second = await service.refresh(first.refreshToken);

      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(second.accessToken).toEqual(expect.any(String));
      const old = tokens.rows.find((r) => r.tokenHash === hashToken(first.refreshToken));
      expect(old?.revokedAt).toBeInstanceOf(Date);
      expect(tokens.active().map((r) => r.tokenHash)).toEqual([hashToken(second.refreshToken)]);
    });

    it('treats reuse of a consumed token as theft and revokes every session of the user', async () => {
      const first = await service.login({
        email: 'demo@example.com',
        password: 'correct-horse-42',
      });
      const otherDevice = await service.login({
        email: 'demo@example.com',
        password: 'correct-horse-42',
      });
      await service.refresh(first.refreshToken);
      expect(tokens.active()).toHaveLength(2);

      await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(tokens.active()).toHaveLength(0);
      await expect(service.refresh(otherDevice.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a token whose stored record has expired', async () => {
      const session = await service.login({
        email: 'demo@example.com',
        password: 'correct-horse-42',
      });
      tokens.rows[0].expiresAt = new Date(Date.now() - 1000);
      await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects missing tokens, garbage, and tokens signed with another secret', async () => {
      await expect(service.refresh(undefined)).rejects.toThrow('Missing refresh token');
      await expect(service.refresh('not-a-jwt')).rejects.toThrow('Invalid refresh token');
      const forged = new JwtService({}).sign(
        { sub: user._id.toString(), jti: 'x' },
        { secret: ENV.JWT_ACCESS_SECRET },
      );
      await expect(service.refresh(forged)).rejects.toThrow('Invalid refresh token');
    });

    it('rejects an access token presented as a refresh token', async () => {
      const session = await service.login({
        email: 'demo@example.com',
        password: 'correct-horse-42',
      });
      await expect(service.refresh(session.accessToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes only the presented token', async () => {
      const a = await service.login({ email: 'demo@example.com', password: 'correct-horse-42' });
      const b = await service.login({ email: 'demo@example.com', password: 'correct-horse-42' });
      await service.logout(a.refreshToken);
      expect(tokens.active().map((r) => r.tokenHash)).toEqual([hashToken(b.refreshToken)]);
      await expect(service.logout(undefined)).resolves.toBeUndefined();
    });
  });
});
