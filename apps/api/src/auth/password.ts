import { ValidateBy, type ValidationOptions } from 'class-validator';

/**
 * bcrypt only uses the first 72 BYTES of a password and silently ignores the rest. Non-ASCII
 * characters take 2-4 bytes in UTF-8, so a character limit is not enough: 37 "é" are 74 bytes.
 */
export const BCRYPT_MAX_PASSWORD_BYTES = 72;

export const PASSWORD_TOO_LONG_MESSAGE = `password must be at most ${BCRYPT_MAX_PASSWORD_BYTES} bytes in UTF-8 (letters outside A-Z, such as é or emoji, count as 2-4 bytes each)`;

export const passwordFitsBcrypt = (password: string): boolean =>
  Buffer.byteLength(password, 'utf8') <= BCRYPT_MAX_PASSWORD_BYTES;

/** class-validator rule: the value is a string of at most 72 UTF-8 bytes. */
export const FitsBcrypt = (options?: ValidationOptions): PropertyDecorator =>
  ValidateBy(
    {
      name: 'fitsBcrypt',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && passwordFitsBcrypt(value),
        defaultMessage: () => PASSWORD_TOO_LONG_MESSAGE,
      },
    },
    options,
  );
