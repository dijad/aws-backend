import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateNoteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ description: 'TipTap JSON document', type: Object })
  @IsObject()
  contentJson!: Record<string, unknown>;

  @ApiProperty({ description: 'Plain-text version of the content for search' })
  @IsString()
  contentText!: string;

  @ApiProperty({ type: [String], description: 'User IDs mentioned with @' })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  mentionUserIds!: string[];

  @ApiProperty({ type: [String], description: 'Recipient user IDs' })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  recipientUserIds!: string[];
}

export class RejectNoteDto {
  @ApiProperty({ description: 'Reason for the rejection' })
  @IsString()
  @MinLength(1)
  reason!: string;
}

export class CreateSubNoteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  content!: string;
}

export class ListNotesQueryDto {
  @ApiProperty({
    required: false,
    enum: ['mine', 'mentions', 'received', 'pending', 'approved', 'rejected', 'all'],
  })
  @IsOptional()
  @IsString()
  scope?:
    | 'mine'
    | 'mentions'
    | 'received'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'all';
}
