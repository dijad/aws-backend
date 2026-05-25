import { ApiProperty } from '@nestjs/swagger';

export class MeUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ required: false, nullable: true }) avatarUrl?: string | null;
  @ApiProperty() roleCode!: string;
  @ApiProperty() roleName!: string;
  @ApiProperty({ type: [String] }) permissions!: string[];
}

export class AuthTokensDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty() accessTokenExpiresIn!: number;
}

export class LoginResponseDto extends AuthTokensDto {
  @ApiProperty({ type: MeUserDto }) user!: MeUserDto;
}
