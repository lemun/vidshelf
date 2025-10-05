export interface RequestUser {
    userId: string;
    email: string;
    username?: string;
    refreshToken?: string;
    ip?: string;
    userAgent?: string;
}
