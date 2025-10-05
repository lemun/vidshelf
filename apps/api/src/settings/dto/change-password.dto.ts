import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";


export class ChangePasswordDto {
    @ApiProperty({ example: 'OldPass123!' })
    @IsString()
    @IsNotEmpty()
    currentPassword!: string;

    @ApiProperty({ example: 'NewPass123!' })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d\s]{8,}$/, {
        message: 'Password must contain letters and numbers',
    })
    newPassword!: string;
}
