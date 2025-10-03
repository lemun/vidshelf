import bcrypt from 'bcrypt';
import { environments } from '../environments/environments';

const saltWorkFactor = environments.saltWorkFactor
  ? parseInt(environments.saltWorkFactor, 10)
  : 10;

export const generateHash = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, saltWorkFactor);
};

export const comparePassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};
