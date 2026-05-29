import { BadRequestException } from '@nestjs/common';
import { normalizeRoleCode } from './roles.service';

describe('normalizeRoleCode', () => {
  it('converts names to uppercase codes', () => {
    expect(normalizeRoleCode('Quality Analyst')).toBe('QUALITY_ANALYST');
  });

  it('accepts explicit codes', () => {
    expect(normalizeRoleCode('QA_LEAD')).toBe('QA_LEAD');
  });

  it('rejects invalid codes', () => {
    expect(() => normalizeRoleCode('123')).toThrow(BadRequestException);
  });
});
