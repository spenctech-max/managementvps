/**
 * Shared Validation Schemas
 * Zod schemas used across backend and frontend
 */
import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    username: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password?: string;
    email?: string;
    username?: string;
}, {
    password?: string;
    email?: string;
    username?: string;
}>;
export type RegisterData = z.infer<typeof registerSchema>;
export declare const loginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password?: string;
    username?: string;
}, {
    password?: string;
    username?: string;
}>;
export type LoginData = z.infer<typeof loginSchema>;
export declare const createUserSchema: z.ZodObject<{
    username: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["admin", "user", "viewer"]>>;
}, "strip", z.ZodTypeAny, {
    role?: "admin" | "user" | "viewer";
    password?: string;
    email?: string;
    username?: string;
}, {
    role?: "admin" | "user" | "viewer";
    password?: string;
    email?: string;
    username?: string;
}>;
export type CreateUserData = z.infer<typeof createUserSchema>;
export declare const updateUserSchema: z.ZodObject<{
    is_active: z.ZodOptional<z.ZodBoolean>;
    role: z.ZodOptional<z.ZodEnum<["admin", "user", "viewer"]>>;
}, "strip", z.ZodTypeAny, {
    role?: "admin" | "user" | "viewer";
    is_active?: boolean;
}, {
    role?: "admin" | "user" | "viewer";
    is_active?: boolean;
}>;
export type UpdateUserData = z.infer<typeof updateUserSchema>;
export declare const createServerSchema: z.ZodObject<{
    name: z.ZodString;
    ip: z.ZodString;
    port: z.ZodDefault<z.ZodNumber>;
    username: z.ZodString;
    auth_type: z.ZodEnum<["password", "key"]>;
    credential: z.ZodString;
    tags: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    port?: number;
    name?: string;
    username?: string;
    ip?: string;
    auth_type?: "password" | "key";
    credential?: string;
    tags?: string;
    description?: string;
}, {
    port?: number;
    name?: string;
    username?: string;
    ip?: string;
    auth_type?: "password" | "key";
    credential?: string;
    tags?: string;
    description?: string;
}>;
export type CreateServerData = z.infer<typeof createServerSchema>;
export declare const updateServerSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    ip: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
    username: z.ZodOptional<z.ZodString>;
    auth_type: z.ZodOptional<z.ZodEnum<["password", "key"]>>;
    credential: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    port?: number;
    name?: string;
    username?: string;
    ip?: string;
    auth_type?: "password" | "key";
    credential?: string;
    tags?: string;
    description?: string;
}, {
    port?: number;
    name?: string;
    username?: string;
    ip?: string;
    auth_type?: "password" | "key";
    credential?: string;
    tags?: string;
    description?: string;
}>;
export type UpdateServerData = z.infer<typeof updateServerSchema>;
export declare const createBackupSchema: z.ZodObject<{
    backup_type: z.ZodDefault<z.ZodEnum<["full", "incremental", "differential", "home", "config", "database"]>>;
    options: z.ZodOptional<z.ZodObject<{
        compression_level: z.ZodOptional<z.ZodNumber>;
        exclude_paths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        compression_level?: number;
        exclude_paths?: string[];
    }, {
        compression_level?: number;
        exclude_paths?: string[];
    }>>;
}, "strip", z.ZodTypeAny, {
    options?: {
        compression_level?: number;
        exclude_paths?: string[];
    };
    backup_type?: "full" | "incremental" | "differential" | "database" | "home" | "config";
}, {
    options?: {
        compression_level?: number;
        exclude_paths?: string[];
    };
    backup_type?: "full" | "incremental" | "differential" | "database" | "home" | "config";
}>;
export type CreateBackupData = z.infer<typeof createBackupSchema>;
export declare const createBackupScheduleSchema: z.ZodObject<{
    backup_id: z.ZodString;
    cron_expression: z.ZodString;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    backup_id?: string;
    cron_expression?: string;
    enabled?: boolean;
}, {
    backup_id?: string;
    cron_expression?: string;
    enabled?: boolean;
}>;
export type CreateBackupScheduleData = z.infer<typeof createBackupScheduleSchema>;
export declare const createScanSchema: z.ZodObject<{
    scan_type: z.ZodDefault<z.ZodEnum<["quick", "full", "services", "filesystems"]>>;
}, "strip", z.ZodTypeAny, {
    scan_type?: "full" | "services" | "filesystems" | "quick";
}, {
    scan_type?: "full" | "services" | "filesystems" | "quick";
}>;
export type CreateScanData = z.infer<typeof createScanSchema>;
export declare const uuidSchema: z.ZodString;
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}, {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export declare const createNotificationSubscriptionSchema: z.ZodObject<{
    event_type: z.ZodString;
    method: z.ZodEnum<["email", "webhook", "sms"]>;
    destination: z.ZodString;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    method?: "email" | "webhook" | "sms";
    enabled?: boolean;
    event_type?: string;
    destination?: string;
}, {
    method?: "email" | "webhook" | "sms";
    enabled?: boolean;
    event_type?: string;
    destination?: string;
}>;
export type CreateNotificationSubscriptionData = z.infer<typeof createNotificationSubscriptionSchema>;
export declare const exportSchema: z.ZodObject<{
    format: z.ZodDefault<z.ZodEnum<["csv", "json", "pdf"]>>;
    includeFilters: z.ZodOptional<z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>>;
}, "strip", z.ZodTypeAny, {
    format?: "json" | "csv" | "pdf";
    includeFilters?: {};
}, {
    format?: "json" | "csv" | "pdf";
    includeFilters?: {};
}>;
export type ExportQuery = z.infer<typeof exportSchema>;
/**
 * Validation middleware factory (Express.js)
 * Only available in Node.js environment
 */
export declare function validateRequest(schema: z.ZodSchema): (req: any, res: any, next: any) => Promise<any>;
/**
 * Validate UUID parameter middleware
 */
export declare function validateUuidParam(paramName?: string): (req: any, res: any, next: any) => any;
//# sourceMappingURL=schemas.d.ts.map