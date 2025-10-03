import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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

  @ApiParam({
    name: 'id',
    description: 'Id of user to',
    type: String,
    required: true,
    example: '6806287ea2d840de8bee3064',
  })
  @ApiBearerAuth()
  @Get(':id')
  findAll(@Query('id') id: string) {
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
