import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { generateHash } from '../utils/bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './models/users.model';
import { UserRepository } from './repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(
    @Inject(UserRepository) private readonly userRepository: UserRepository,
  ) {}

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await this.userRepository.getUserByEmail(email);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to get user by email',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        error,
      );
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      return await this.userRepository.getUserById(id);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to get user by id',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        error,
      );
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await this.userRepository.getUsers({});
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to get all users',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        error,
      );
    }
  }

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    try {
      const existingUser = await this.userRepository.getUserByEmail(
        createUserDto.email,
      );
      if (existingUser) {
        throw new ConflictException('User already exists');
      }

      const newUser = await this.userRepository.create({
        ...createUserDto,
        password: await generateHash(createUserDto.password),
      });

      return newUser;
    } catch (error) {
      throw new InternalServerErrorException('Failed to create user', error);
    }
  }

  async readUserById(id: string): Promise<User | null> {
    try {
      const existingUser = await this.userRepository.getUserById(id);
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      return existingUser;
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to read user by id',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        error,
      );
    }
  }

  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<User | null> {
    try {
      const existingUser = await this.userRepository.getUserById(id);
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }
      return await this.userRepository.updateUserById(id, updateUserDto);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      throw new InternalServerErrorException('Failed to update user', error);
    }
  }

  async updateUserPasswordById(
    id: string,
    password: string,
  ): Promise<User | null> {
    try {
      const existingUser = await this.userRepository.getUserById(id);
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }
      return await this.userRepository.updateUserById(id, {
        password: await generateHash(password),
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to update user password',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        error,
      );
    }
  }

  async deleteUser(id: string): Promise<User | null> {
    try {
      const existingUser = await this.userRepository.getUserById(id);
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }
      return await this.userRepository.deleteUserById(id);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      throw new InternalServerErrorException('Failed to delete user', error);
    }
  }
}
