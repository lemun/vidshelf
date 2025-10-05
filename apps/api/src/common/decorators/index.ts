import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";

// Pulls the authentictated user object from request (req.user)
export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext) => {
        const req = ctx.switchToHttp().getRequest();
        return req.user ?? null;
    },
);
// Marks a route as public (no JWT required)
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

