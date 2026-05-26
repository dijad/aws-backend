import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchCitableNotesQueryDto {
  @ApiProperty({ required: false, description: 'Filter by note title' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
