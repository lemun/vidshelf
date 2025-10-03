import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { comparePassword } from 'src/utils/bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CustomJwtService } from './jwt/jwt.service';
import { ResetTokenRepository } from './repositories/resettoken.repository';

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(CustomJwtService) private readonly jwtService: CustomJwtService,
    @Inject(ResetTokenRepository)
    private readonly resetTokenRepository: ResetTokenRepository,
  ) {}

  async login(loginDto: LoginDto) {
    try {
      const { email, password } = loginDto;
      const existingUser = await this.usersService.getUserByEmail(email);

      if (!existingUser) {
        throw new NotFoundException('Invalid e-mail or password');
      }

      const hashedPassword = await comparePassword(
        password,
        existingUser.password,
      );

      if (!hashedPassword) {
        throw new UnauthorizedException('Invalid e-mail or password');
      }

      const accessToken = this.jwtService.generateToken({ email });

      return {
        entity: existingUser,
        token: accessToken,
      };
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      throw new InternalServerErrorException('Failed to login', error);
    }
  }

  logout() {
    try {
      return { message: 'Logged out successfully' };
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      throw new InternalServerErrorException('Failed to logout', error);
    }
  }

  async register(registerDto: RegisterDto) {
    const { email, password } = registerDto;
    const existingUser = await this.usersService.getUserByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const user = await this.usersService.createUser({
      email,
      password: password,
    });
    return { message: 'User created successfully', user };
  }
}
