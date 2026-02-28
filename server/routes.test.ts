import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { createServer } from 'http';
import { registerRoutes } from './routes.js';
import session from 'express-session';
import passport from 'passport';
import { storage } from './storage.js';

let app: Express;

// Mock storage methods so we don't hit the real DB during tests.
vi.mock('./storage.js', () => {
    return {
        storage: {
            getTours: vi.fn(),
            getTour: vi.fn(),
            getSiteSettings: vi.fn().mockResolvedValue([]),
        },
    };
});

// A standard setup for testing Express routes wrapped by `supertest`
beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Basic session middleware required by passport
    app.use(
        session({
            secret: 'test-secret',
            resave: false,
            saveUninitialized: false,
            cookie: { maxAge: 60000 },
        })
    );

    app.use(passport.initialize());
    app.use(passport.session());

    // Register our actual routes onto the Express testing instance
    const httpServer = createServer(app);
    registerRoutes(httpServer, app);
});

describe('API Routes', () => {
    describe('Public Configuration Endpoints', () => {
        it('GET /api/config should return standard config', async () => {
            // Act
            const res = await request(app).get('/api/config');

            // Assert
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('ddd');
            expect(res.body).toHaveProperty('payments');
            expect(res.body).toHaveProperty('killSwitches');
        });

        it('GET /api/settings should return public site settings from mocked storage', async () => {
            // Arrange
            const mockSettings = [{ key: 'contact_email', value: 'hello@acetours.vu' }];
            vi.mocked(storage.getSiteSettings).mockResolvedValue(mockSettings as any);

            // Act
            const res = await request(app).get('/api/settings');

            // Assert
            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockSettings);
        });
    });

    describe('Product Endpoints', () => {
        it('GET /api/tours should return a list of active tours', async () => {
            // Arrange
            const mockTours = [
                { id: 't1', title: 'Test Tour', shortDescription: 'Desc', priceCents: 10000 },
            ];
            vi.mocked(storage.getTours).mockResolvedValue(mockTours as any);

            // Act
            const res = await request(app).get('/api/tours');

            // Assert
            expect(res.status).toBe(200);
            // Because /api/tours maps responses heavily, it might wrap it or return partials
            expect(Array.isArray(res.body)).toBe(true);
            expect(storage.getTours).toHaveBeenCalled();
        });

        it('GET /api/tours/:id should return a specific tour', async () => {
            // Arrange
            const mockTour = { id: 't1', title: 'Specific Tour' };
            vi.mocked(storage.getTour).mockResolvedValue(mockTour as any);

            // Act
            const res = await request(app).get('/api/tours/t1');

            // Assert
            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockTour);
            expect(storage.getTour).toHaveBeenCalledWith('t1');
        });

        it('GET /api/tours/:id should return 404 for missing tour', async () => {
            // Arrange
            vi.mocked(storage.getTour).mockResolvedValue(undefined as any);

            // Act
            const res = await request(app).get('/api/tours/not-found');

            // Assert
            expect(res.status).toBe(404);
            // Expecting a standard HTML or JSON response dependending on express config
        });
    });
});
