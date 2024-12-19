import { z } from 'zod';
/**
 * Schema for ClickHouse configuration
 * Validates and provides defaults for all required configuration options
 */
export declare const configSchema: z.ZodObject<{
    url: z.ZodDefault<z.ZodString>;
    username: z.ZodDefault<z.ZodString>;
    password: z.ZodDefault<z.ZodString>;
    database: z.ZodDefault<z.ZodString>;
    oplogTable: z.ZodDefault<z.ZodString>;
    dataTable: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    url: string;
    username: string;
    password: string;
    database: string;
    oplogTable: string;
    dataTable: string;
}, {
    url?: string | undefined;
    username?: string | undefined;
    password?: string | undefined;
    database?: string | undefined;
    oplogTable?: string | undefined;
    dataTable?: string | undefined;
}>;
/**
 * Type definition for ClickHouse configuration
 */
export type Config = z.infer<typeof configSchema>;
/**
 * Gets configuration from environment variables with defaults
 * @returns Validated configuration object
 */
export declare const getConfig: () => Config;
//# sourceMappingURL=config.d.ts.map