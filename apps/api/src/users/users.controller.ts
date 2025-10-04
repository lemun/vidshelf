/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth()
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @ApiBearerAuth()
  @Get()
  async findAll() {
    const users = await this.usersService.getAllUsers();
    // Transform MongoDB documents to match frontend expectations
    const transformedUsers = users.map((user: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      id: user._id.toString(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      email: user.email,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      bio: user.bio || '',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      avatarUrl: user.avatarUrl || '',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      createdAt: user.createdAt
        ? // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          new Date(user.createdAt).getTime()
        : Date.now(),
    }));
    return { data: transformedUsers };
  }

  @ApiParam({
    name: 'id',
    description: 'Id of user to',
    type: String,
    required: true,
    example: '6806287ea2d840de8bee3064',
  })
  @ApiBearerAuth()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.readUserById(id);
  }

  @ApiParam({
    name: 'id',
    description: 'Id of user to',
    type: String,
    required: true,
    example: '6806287ea2d840de8bee3064',
  })
  @ApiBearerAuth()
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @ApiParam({
    name: 'id',
    description: 'Id of user to delete',
    type: String,
    required: true,
    example: '6806287ea2d840de8bee3064',
  })
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}
