import { ApiProperty } from '@nestjs/swagger'
import { IsDateOnly } from '../../../common/validators/is-date-only.validator'

export class StatsQueryDto {
  @ApiProperty({ example: '2026-10-01', description: 'من تاريخ (ضمناً)' })
  @IsDateOnly()
  from: string

  @ApiProperty({ example: '2026-10-31', description: 'إلى تاريخ (ضمناً)' })
  @IsDateOnly()
  to: string
}
