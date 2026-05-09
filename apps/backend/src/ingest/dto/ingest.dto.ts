import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ApiCallEventDto {
  @IsString()
  method!: string;

  @IsString()
  url!: string;

  @IsOptional()
  requestHeaders?: Record<string, string>;

  @IsOptional()
  requestBody?: unknown;

  @IsOptional()
  queryParams?: Record<string, string>;

  @IsOptional()
  @IsInt()
  statusCode?: number;

  @IsOptional()
  @IsString()
  statusText?: string;

  @IsOptional()
  responseHeaders?: Record<string, string>;

  @IsOptional()
  responseBody?: unknown;

  @IsOptional()
  @IsInt()
  responseSize?: number;

  @IsInt()
  @Min(0)
  latency!: number; // ms

  @IsDateString()
  startedAt!: string;

  @IsDateString()
  endedAt!: string;
}

export class IngestDto {
  @IsString()
  @IsNotEmpty()
  sdkToken!: string; // Identifies the service (and its project/user) — no projectId needed

  @IsArray()
  @ArrayMaxSize(500) // Prevent BullMQ flood — max 500 events per request
  @ValidateNested({ each: true })
  @Type(() => ApiCallEventDto)
  events!: ApiCallEventDto[];
}
