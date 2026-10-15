import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { Env } from '../config/env';
import type { UserDocument } from '../users/schemas/user.schema';
import type { UsersService } from '../users/users.service';
import { AuthService, hashToken, REFRESH_GRACE_MS } from './auth.service';
import type { Session } from './auth.types';
import { PASSWORD_TOO_LONG_MESSAGE } from './password';
import type { RefreshSession } from './schemas/refresh-session.schema';

const ENV: Partial<Env> = {
  JWT_ACCESS_SECRET: 'unit-test-access-secret-0123456789abcdef',
  JWT_REFRESH_SECRET: 'unit-test-refresh-secret-0123456789abcdef',
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 3600,
  BCRYPT_ROUNDS: 4,
};

interface SessionRow {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  tokenHash: string;
  generation: number;
  expiresAt: Date;
  revokedAt: Date | null;
  previousTokenHash: string | null;
  rotatedAt: Date | null;
  graceUsedAt: Date | null;
}

type Filter = Record<string, unknown>;
type Update = { $set: Partial<SessionRow> };

const idOrValue = (v: unknown) => (v instanceof Types.ObjectId ? v.toHexString() : v);

type Range = { $gt?: Date | number; $gte?: number; $lte?: number };

/** Equality on ids/strings/numbers/null plus `$gt`/`$gte`/`$lte`: the operators AuthService uses. */
function matches(row: SessionRow, filter: Filter): boolean {
  return Object.entries(filter).every(([key, want]) => {
    const have = row[key as keyof SessionRow];
    if (want !== null && typeof want === 'object' && !(want instanceof Types.ObjectId)) {
      const range = want as Range;
      if (have === null || typeof have === 'string' || have instanceof Types.ObjectId) return false;
      const n = Number(have);
      return (
        (range.$gt === undefined || n > Number(range.$gt)) &&
        (range.$gte === undefined || n >= range.$gte) &&
        (range.$lte === undefined || n <= range.$lte)
      );
    }
    if (want === null || have === null) return have === want;
    return idOrValue(have) === idOrValue(want);
  });
}

/**
 * In-memory stand-in for the RefreshSession model, implementing only the calls AuthService makes.
 * Each call is applied in one synchronous step, like a single-document update in MongoDB, so the
 * rotation and revocation rules run for real without a database.
 *
 * `holdNextRotation()` pauses the next rotation write just before it is applied, so a test can
 * run something else at exactly that point.
 */
class FakeSessions {
  rows: SessionRow[] = [];
  private gate?: { reached: () => void; release: Promise<void> };

  create(doc: Omit<SessionRow, 'revokedAt' | 'previousTokenHash' | 'rotatedAt' | 'graceUsedAt'>) {
    const row = {
      revokedAt: null,
      previousTokenHash: null,
      rotatedAt: null,
      graceUsedAt: null,
      ...doc,
    };
    this.rows.push(row);
    return Promise.resolve(row);
  }

  findById(id: string) {
    return exec(() => this.rows.find((r) => r._id.toString() === id) ?? null);
  }

  updateOne(filter: Filter, update: Update) {
    const isRotation = 'tokenHash' in filter; // only the rotation write filters on the current hash
    return {
      exec: async () => {
        const gate = isRotation ? this.gate : undefined;
        if (gate) {
          this.gate = undefined;
          gate.reached();
          await gate.release;
        }
        const row = this.rows.find((r) => matches(r, filter));
        if (row) Object.assign(row, update.$set);
        return { matchedCount: row ? 1 : 0, modifiedCount: row ? 1 : 0 };
      },
    };
  }

  updateMany(filter: Filter, update: Update) {
    return exec(() => {
      const hit = this.rows.filter((r) => matches(r, filter));
      for (const row of hit) Object.assign(row, update.$set);
      return { matchedCount: hit.length, modifiedCount: hit.length };
    });
  }

  holdNextRotation() {
    return hold((gate) => (this.gate = gate));
  }

  /** Moves every rotation back in time, past the concurrent-refresh grace window. */
  outsideGrace() {
    for (const row of this.rows) {
      if (row.rotatedAt)
        row.rotatedAt = new Date(row.rotatedAt.getTime() - REFRESH_GRACE_MS - 1000);
    }
  }

  active(): SessionRow[] {
    return this.rows.filter((r) => r.revokedAt === null);
  }
}

function exec<T>(run: () => T) {
  return { exec: () => Promise.resolve().then(run) };
}

/** A pause point: `reached` resolves when the code under test arrives, `release()` lets it go on. */
function hold(install: (gate: { reached: () => void; release: Promise<void> }) => void) {
  let reached!: () => void;
  let release!: () => void;
  const arrived = new Promise<void>((r) => (reached = r));
  const released = new Promise<void>((r) => (release = r));
  install({ reached, release: released });
  return { reached: arrived, release };
}

/** The refresh token of a session that must have one (sign-in or a real rotation). */
function rt(session: Session): string {
  if (!session.refreshToken) throw new Error('expected a new refresh token');
  return session.refreshToken;
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

const LOGIN = { email: 'demo@example.com', password: 'correct-horse-42' };

describe('AuthService', () => {
  let sessions: FakeSessions;
  let jwt: JwtService;
  let users: jest.Mocked<
    Pick<
      UsersService,
      'findById' | 'findByEmailWithPassword' | 'existsByEmailOrUsername' | 'create'
    >
  >;
  let service: AuthService;
  let user: UserDocument;

  /** Pauses the next refresh-token signing (the replacement being minted) until released. */
  function holdNextRefreshSigning() {
    const sign = jwt.signAsync.bind(jwt) as (p: object, o: { secret?: string }) => Promise<string>;
    return hold((gate) => {
      const spy = jest.spyOn(jwt, 'signAsync').mockImplementation((async (
        payload: object,
        options: { secret?: string },
      ) => {
        const token = await sign(payload, options);
        if (options.secret === ENV.JWT_REFRESH_SECRET) {
          spy.mockRestore();
          gate.reached();
          await gate.release;
        }
        return token;
      }) as unknown as JwtService['signAsync']);
    });
  }

  beforeEach(async () => {
    sessions = new FakeSessions();
    jwt = new JwtService({});
    user = makeUser({ passwordHash: await bcrypt.hash('correct-horse-42', 4) });
    users = {
      findById: jest.fn().mockResolvedValue(user),
      findByEmailWithPassword: jest.fn().mockResolvedValue(user),
      existsByEmailOrUsername: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue(user),
    };
    const config = { get: (key: keyof Env) => ENV[key] } as unknown as ConfigService<Env, true>;
    service = new AuthService(
      jwt,
      users as unknown as UsersService,
      config,
      sessions as unknown as Model<RefreshSession>,
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
      expect(sessions.rows).toHaveLength(1);
      expect(sessions.rows[0].tokenHash).toBe(hashToken(rt(session)));
      expect(sessions.rows[0].tokenHash).not.toBe(session.refreshToken);
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

    it('rejects a password longer than 72 bytes even when it is under 72 characters', async () => {
      const password = 'é'.repeat(36) + '1'; // 37 characters, 73 bytes
      expect(password.length).toBeLessThan(72);
      await expect(
        service.register({ username: 'demo_user', email: 'demo@example.com', password }),
      ).rejects.toThrow(new BadRequestException(PASSWORD_TOO_LONG_MESSAGE));
      expect(users.create).not.toHaveBeenCalled();

      // Exactly 72 bytes is fine.
      await service.register({
        username: 'demo_user',
        email: 'demo@example.com',
        password: 'é'.repeat(35) + 'a1',
      });
      expect(users.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    it('issues an access token carrying the user id and name', async () => {
      const session = await service.login(LOGIN);
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
      expect(sessions.rows).toHaveLength(0);
    });
  });

  describe('refresh (rotation)', () => {
    it('consumes the presented token and issues a new pair in the same session', async () => {
      const first = await service.login(LOGIN);
      const second = await service.refresh(first.refreshToken);

      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(second.accessToken).toEqual(expect.any(String));
      expect(sessions.rows).toHaveLength(1);
      expect(sessions.rows[0]).toMatchObject({
        tokenHash: hashToken(rt(second)),
        generation: 1,
        revokedAt: null,
      });
      await expect(service.refresh(second.refreshToken)).resolves.toBeDefined();
    });

    it('treats reuse of a consumed token as theft and revokes every session of the user', async () => {
      const first = await service.login(LOGIN);
      const otherDevice = await service.login(LOGIN);
      const second = await service.refresh(first.refreshToken);
      sessions.outsideGrace();
      expect(sessions.active()).toHaveLength(2);

      await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(sessions.active()).toHaveLength(0);
      await expect(service.refresh(second.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(service.refresh(otherDevice.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a token whose stored session has expired', async () => {
      const session = await service.login(LOGIN);
      sessions.rows[0].expiresAt = new Date(Date.now() - 1000);
      await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects missing tokens, garbage, and tokens signed with another secret', async () => {
      await expect(service.refresh(undefined)).rejects.toThrow('Missing refresh token');
      await expect(service.refresh('not-a-jwt')).rejects.toThrow('Invalid refresh token');
      const forged = new JwtService({}).sign(
        { sub: user._id.toString(), sid: new Types.ObjectId().toString(), gen: 0, jti: 'x' },
        { secret: ENV.JWT_ACCESS_SECRET },
      );
      await expect(service.refresh(forged)).rejects.toThrow('Invalid refresh token');
    });

    it('rejects a correctly signed token that is not a session token', async () => {
      const malformed = new JwtService({}).sign(
        { sub: user._id.toString(), sid: 'not-an-id', gen: 0, jti: 'x' },
        { secret: ENV.JWT_REFRESH_SECRET },
      );
      await expect(service.refresh(malformed)).rejects.toThrow('Invalid refresh token');
    });

    it('rejects an access token presented as a refresh token', async () => {
      const session = await service.login(LOGIN);
      await expect(service.refresh(session.accessToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  /**
   * The race the session document exists for: a legitimate client refreshes with its current
   * token while a replay of an older token triggers reuse detection. Whatever the interleaving,
   * no refresh token minted by that legitimate refresh may still work after the revocation.
   */
  describe('refresh racing reuse detection', () => {
    async function rotatedOnce() {
      const stolen = await service.login(LOGIN); // the attacker keeps a copy of this one
      const current = await service.refresh(stolen.refreshToken); // the real client moves on
      sessions.outsideGrace(); // the replay comes later than the two-tab grace window
      return { stolen: rt(stolen), current: rt(current) };
    }

    it('rejects a replacement minted while reuse detection revokes the session', async () => {
      const { stolen, current } = await rotatedOnce();

      // 1. The legitimate refresh verifies its token and starts minting the replacement...
      const signing = holdNextRefreshSigning();
      const legit = service.refresh(current);
      await signing.reached;
      // 2. ...the replay of the spent token is detected and revokes everything...
      await expect(service.refresh(stolen)).rejects.toThrow('Invalid refresh token');
      expect(sessions.active()).toHaveLength(0);
      // 3. ...then the legitimate refresh finishes and tries to store its replacement.
      signing.release();

      await expect(legit).rejects.toThrow('Invalid refresh token');
      expect(sessions.rows[0].tokenHash).toBe(hashToken(current)); // replacement never stored
      expect(sessions.active()).toHaveLength(0);
    });

    it('rejects a replacement whose write is the last thing to happen', async () => {
      const { stolen, current } = await rotatedOnce();

      // Pause the legitimate refresh at the latest possible point: right before its write.
      const write = sessions.holdNextRotation();
      const legit = service.refresh(current);
      await write.reached;
      await expect(service.refresh(stolen)).rejects.toThrow('Invalid refresh token');
      write.release();

      await expect(legit).rejects.toThrow('Invalid refresh token');
      expect(sessions.active()).toHaveLength(0);
    });

    it('revokes a replacement that was stored just before the reuse was detected', async () => {
      const { stolen, current } = await rotatedOnce();

      const replacement = await service.refresh(current); // wins the race
      await expect(service.refresh(stolen)).rejects.toThrow('Invalid refresh token');

      await expect(service.refresh(rt(replacement))).rejects.toThrow('Invalid refresh token');
      expect(sessions.active()).toHaveLength(0);
    });
  });

  describe('two tabs refreshing at once (grace window)', () => {
    it('answers the losing tab with an access token only, and revokes nothing', async () => {
      const t0 = rt(await service.login(LOGIN));
      // Both tabs send the same cookie at the same moment.
      const [a, b] = await Promise.all([service.refresh(t0), service.refresh(t0)]);
      const winner = a.refreshToken ? a : b;
      const loser = a.refreshToken ? b : a;

      expect(winner.refreshToken).toEqual(expect.any(String));
      expect(loser.refreshToken).toBeUndefined();
      expect(loser.refreshTokenExpiresAt).toBeUndefined();
      expect(loser.accessToken).toEqual(expect.any(String));
      expect(sessions.active()).toHaveLength(1);
      // The cookie both tabs now share (the winner's) keeps working.
      await expect(service.refresh(rt(winner))).resolves.toBeDefined();
    });

    it('gives the grace once per rotation; a second replay is reuse', async () => {
      const otherDevice = rt(await service.login(LOGIN));
      const t0 = rt(await service.login(LOGIN));
      await service.refresh(t0);
      expect((await service.refresh(t0)).refreshToken).toBeUndefined();

      await expect(service.refresh(t0)).rejects.toThrow('Invalid refresh token');
      expect(sessions.active()).toHaveLength(0);
      await expect(service.refresh(otherDevice)).rejects.toThrow('Invalid refresh token');
    });

    it(`treats the consumed token as reuse once ${REFRESH_GRACE_MS / 1000} s have passed`, async () => {
      const t0 = rt(await service.login(LOGIN));
      const t1 = rt(await service.refresh(t0));
      sessions.outsideGrace();

      await expect(service.refresh(t0)).rejects.toThrow('Invalid refresh token');
      expect(sessions.active()).toHaveLength(0);
      await expect(service.refresh(t1)).rejects.toThrow('Invalid refresh token');
    });

    it('never graces a token older than the one just consumed', async () => {
      const t0 = rt(await service.login(LOGIN));
      const t1 = rt(await service.refresh(t0));
      await service.refresh(t1); // two rotations inside the window

      await expect(service.refresh(t0)).rejects.toThrow('Invalid refresh token');
      expect(sessions.active()).toHaveLength(0);
    });

    it('does not grace a session that was signed out; a tab that raced the sign-out just fails', async () => {
      const otherDevice = rt(await service.login(LOGIN));
      const t0 = rt(await service.login(LOGIN));
      const t1 = rt(await service.refresh(t0));
      await service.logout(t1);

      await expect(service.refresh(t0)).rejects.toThrow('Invalid refresh token');
      // Not treated as theft: the other device stays signed in.
      await expect(service.refresh(otherDevice)).resolves.toBeDefined();
    });
  });

  describe('logout', () => {
    it('ends only the session of the presented token', async () => {
      const a = await service.login(LOGIN);
      const b = await service.login(LOGIN);
      await service.logout(a.refreshToken);
      expect(sessions.active().map((r) => r.tokenHash)).toEqual([hashToken(rt(b))]);
      await expect(service.refresh(a.refreshToken)).rejects.toThrow('Invalid refresh token');
      await expect(service.logout(undefined)).resolves.toBeUndefined();
    });

    it('ends the session even when a concurrent refresh replaced the token first', async () => {
      const t0 = rt(await service.login(LOGIN));
      const t1 = rt(await service.refresh(t0)); // lands first...
      await service.logout(t0); // ...then the logout that carried the same (older) cookie

      expect(sessions.active()).toHaveLength(0);
      await expect(service.refresh(t1)).rejects.toThrow('Invalid refresh token');
    });

    it('wins against a refresh paused right before its write', async () => {
      const otherDevice = rt(await service.login(LOGIN));
      const t0 = rt(await service.login(LOGIN));

      // 1. A refresh verifies t0 and mints its replacement, then pauses before writing it...
      const write = sessions.holdNextRotation();
      const refreshing = service.refresh(t0);
      await write.reached;
      // 2. ...the user signs out with the same cookie...
      await service.logout(t0);
      // 3. ...and the refresh resumes.
      write.release();

      await expect(refreshing).rejects.toThrow('Invalid refresh token');
      const ended = sessions.rows.find((r) => r.tokenHash === hashToken(t0));
      expect(ended?.revokedAt).toBeInstanceOf(Date);
      expect(ended?.generation).toBe(0); // the replacement was never stored
      // A refresh that lost to a sign-out is not theft: the other device is untouched.
      await expect(service.refresh(otherDevice)).resolves.toBeDefined();
    });

    it('ignores tokens that are not a current or just-replaced token of a session', async () => {
      const t0 = rt(await service.login(LOGIN));
      const t1 = rt(await service.refresh(t0));
      await service.refresh(t1); // t0 is now two generations old

      await service.logout(t0);
      await service.logout('not-a-jwt');
      await service.logout(
        new JwtService({}).sign(
          { sub: user._id.toString(), sid: sessions.rows[0]._id.toString(), gen: 2, jti: 'x' },
          { secret: ENV.JWT_ACCESS_SECRET }, // wrong secret: not a genuine refresh token
        ),
      );
      expect(sessions.active()).toHaveLength(1);
    });
  });
});
