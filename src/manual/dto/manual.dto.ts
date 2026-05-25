import { ApiProperty } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFeatureDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @ApiProperty({
    description: 'URL slug, lowercase + dashes. Auto-derived if omitted.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug?: string;

  @ApiProperty({ type: Object })
  @IsObject()
  contentJson!: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  contentText!: string;
}

export class UpdateFeatureDocumentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  contentJson?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contentText?: string;
}
