import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'رقم الصفحة يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'رقم الصفحة يبدأ من 1' })
  page = 1

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'عدد العناصر يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'عدد العناصر يجب أن يكون 1 على الأقل' })
  @Max(100, { message: 'عدد العناصر لا يتجاوز 100' })
  limit = 10

  @ApiPropertyOptional({ description: 'نص البحث' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string

  get skip(): number {
    return (this.page - 1) * this.limit
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export function paginated<T>(
  items: T[],
  total: number,
  query: PaginationQueryDto,
): PaginatedResponse<T> {
  return { items, total, page: query.page, limit: query.limit }
}
