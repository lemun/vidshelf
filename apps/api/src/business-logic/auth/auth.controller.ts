import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { User } from '../users/users.schema';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  signIn(@Body() signInDto: Record<string, any>): any {
    return this.authService.signIn(signInDto as User);
  }

  @Post('signup')
  signUp(
    @Body() signUpDto: Record<string, any>,
  ): Promise<{ access_token: string }> {
    return this.authService.signUp(signUpDto as User);
  }
}
