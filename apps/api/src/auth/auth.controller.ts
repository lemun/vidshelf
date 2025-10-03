import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
@ApiTags('Auth Module')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('/login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/logout')
  logout() {
    return this.authService.logout();
  }

  @HttpCode(HttpStatus.OK)
  @Post('/register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // NOTE: Work on accessToken and refreshToken functionality
  // refreshToken()
}
