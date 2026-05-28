import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        include: [
            'server/**/*.test.ts',
            'shared/**/*.test.ts',
            'scripts/**/*.test.ts',
        ],
        exclude: ['node_modules', 'dist', 'build'],
        globals: true,
        env: {
            DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
            SESSION_SECRET: 'mock-secret',
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'client/src'),
            '@shared': path.resolve(__dirname, 'shared'),
        },
    },
});
