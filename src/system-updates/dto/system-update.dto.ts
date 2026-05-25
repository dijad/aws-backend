import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  SystemUpdatePriority,
  SystemUpdateType,
} from '@prisma/client';

export class CreateSystemUpdateDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ enum: SystemUpdateType })
  @IsEnum(SystemUpdateType)
  type!: SystemUpdateType;

  @ApiProperty({ description: 'Module id of the affected functional area' })
  @IsString()
  moduleId!: string;

  @ApiProperty({ enum: SystemUpdatePriority })
  @IsEnum(SystemUpdatePriority)
  priority!: SystemUpdatePriority;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;
}

export class ReviewDecisionDto {
  @ApiProperty({ description: 'true = approve, false = reject' })
  @IsBoolean()
  approve!: boolean;

  @ApiProperty({ required: false, description: 'Required when approve=false' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SystemUpdateCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  content!: string;
}

export class ListSystemUpdatesQueryDto {
  @ApiProperty({
    required: false,
    enum: ['mine', 'inbox', 'completed', 'rejected', 'pending', 'approved', 'all'],
  })
  @IsOptional()
  @IsString()
  scope?:
    | 'mine'
    | 'inbox'
    | 'completed'
    | 'rejected'
    | 'pending'
    | 'approved'
    | 'all';
}
