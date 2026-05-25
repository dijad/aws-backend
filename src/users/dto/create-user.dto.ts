import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export const ROLE_CODES = ['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER'] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export class CreateUserDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) password!: string;
  @ApiProperty({ enum: ROLE_CODES })
  @IsIn(ROLE_CODES as unknown as string[])
  roleCode!: RoleCode;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
