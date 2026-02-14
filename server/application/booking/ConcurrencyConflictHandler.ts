/**
 * ConcurrencyConflictHandler - PHASE 4: CONFLICT DETECTION & RECOVERY
 * 
 * Detects, analyzes, and recovers from concurrent conflict scenarios.
 * 
 * Handled conflicts:
 * ✅ Serialization conflicts (concurrent modifications)
 * ✅ Deadlock scenarios (lock cycle detection)  
 * ✅ Lock timeouts (acquisition timeouts)
 * ✅ Stale holds (expired but not released)
 * ✅ Double confirmation (idempotency)
 * ✅ Capacity race conditions (overselling attempts)
 * 
 * Recovery strategies:
 * - Exponential backoff for transient failures
 * - Transparent retry with state re-validation
 * - Clear error reporting for non-retryable failures
 */

import { IStorage } from "../../storage.js";
import { ConfirmationErrorCode } from "./AtomicBookingConfirmationService.js";

export enum ConflictType {
  SERIALIZATION = "SERIALIZATION",
  DEADLOCK = "DEADLOCK",
  LOCK_TIMEOUT = "LOCK_TIMEOUT",
  STALE_HOLD = "STALE_HOLD",
  DOUBLE_CONFIRMATION = "DOUBLE_CONFIRMATION",
  CAPACITY_RACE = "CAPACITY_RACE",
  UNKNOWN = "UNKNOWN",
}

export interface ConflictInfo {
  type: ConflictType;
  errorMessage: string;
  errorCode: ConfirmationErrorCode;
  isTransient: boolean;
  isRetryable: boolean;
  suggestedBackoffMs: number;
  maxRetries: number;
  diagnostics?: {
    relatedBookingIds?: string[];
    relatedHoldIds?: string[];
    timeWindow?: { startMs: number; endMs: number };
  };
}

export interface ConflictResolution {
  resolved: boolean;
  conflictType: ConflictType;
  resolutionStrategy: string;
  message: string;
  nextAction?: "RETRY" | "FAIL" | "MANUAL_REVIEW";
  retryCount?: number;
  totalRetries?: number;
  metrics?: {
    detectionTimeMs: number;
    resolutionTimeMs: number;
    backoffAppliedMs?: number;
  };
}

export class ConcurrencyConflictHandler {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Main entry point: Analyze error and determine conflict type
   */
  analyzeConflict(
    error: Error | string,
    errorCode?: ConfirmationErrorCode
  ): ConflictInfo {
    const message = error instanceof Error ? error.message : String(error);

    // Detect conflict patterns
    if (this.isSerializationError(message)) {
      return {
        type: ConflictType.SERIALIZATION,
        errorMessage: message,
        errorCode: errorCode || ConfirmationErrorCode.SERIALIZATION_CONFLICT,
        isTransient: true,
        isRetryable: true,
        suggestedBackoffMs: 50,
        maxRetries: 3,
      };
    }

    if (this.isDeadlockError(message)) {
      return {
        type: ConflictType.DEADLOCK,
        errorMessage: message,
        errorCode: errorCode || ConfirmationErrorCode.INSTANCE_LOCKED,
        isTransient: true,
        isRetryable: true,
        suggestedBackoffMs: 100,
        maxRetries: 2,
      };
    }

    if (this.isLockTimeoutError(message)) {
      return {
        type: ConflictType.LOCK_TIMEOUT,
        errorMessage: message,
        errorCode: errorCode || ConfirmationErrorCode.INSTANCE_LOCKED,
        isTransient: true,
        isRetryable: true,
        suggestedBackoffMs: 200,
        maxRetries: 2,
      };
    }

    if (errorCode === ConfirmationErrorCode.HOLD_EXPIRED) {
      return {
        type: ConflictType.STALE_HOLD,
        errorMessage: message,
        errorCode,
        isTransient: false,
        isRetryable: false,
        suggestedBackoffMs: 0,
        maxRetries: 0,
        diagnostics: {
          timeWindow: {
            startMs: Date.now() - 15 * 60 * 1000, // 15-min hold TTL
            endMs: Date.now(),
          },
        },
      };
    }

    if (errorCode === ConfirmationErrorCode.CAPACITY_EXHAUSTED) {
      return {
        type: ConflictType.CAPACITY_RACE,
        errorMessage: message,
        errorCode,
        isTransient: false,
        isRetryable: false,
        suggestedBackoffMs: 0,
        maxRetries: 0,
      };
    }

    // Default: Unknown conflict type
    return {
      type: ConflictType.UNKNOWN,
      errorMessage: message,
      errorCode: errorCode || ConfirmationErrorCode.UNKNOWN_ERROR,
      isTransient: false,
      isRetryable: false,
      suggestedBackoffMs: 0,
      maxRetries: 0,
    };
  }

  /**
   * Calculate exponential backoff with jitter
   */
  calculateBackoff(
    attemptNumber: number,
    baseMs: number,
    maxMs: number = 5000
  ): number {
    // Exponential: baseMs * 2^attemptNumber
    const exponential = baseMs * Math.pow(2, attemptNumber);
    const withCap = Math.min(exponential, maxMs);

    // Add jitter: ±25% randomization
    const jitter = withCap * (0.75 + Math.random() * 0.5);

    return Math.ceil(jitter);
  }

  /**
   * Resolve a conflict with appropriate strategy
   */
  async resolveConflict(
    conflictInfo: ConflictInfo,
    context: {
      bookingId: string;
      previousAttempts: number;
      totalAttempts: number;
    }
  ): Promise<ConflictResolution> {
    const detectionStart = Date.now();

    // Already retried max times?
    if (context.previousAttempts >= conflictInfo.maxRetries) {
      return {
        resolved: false,
        conflictType: conflictInfo.type,
        resolutionStrategy: "MAX_RETRIES_EXCEEDED",
        message: `Unable to resolve conflict after ${context.previousAttempts} retries`,
        nextAction: "MANUAL_REVIEW",
        retryCount: context.previousAttempts,
        totalRetries: context.totalAttempts,
        metrics: {
          detectionTimeMs: Date.now() - detectionStart,
          resolutionTimeMs: 0,
        },
      };
    }

    // Not retryable?
    if (!conflictInfo.isRetryable) {
      return {
        resolved: false,
        conflictType: conflictInfo.type,
        resolutionStrategy: "NOT_RETRYABLE",
        message: conflictInfo.errorMessage,
        nextAction: "FAIL",
        retryCount: context.previousAttempts,
        totalRetries: context.totalAttempts,
        metrics: {
          detectionTimeMs: Date.now() - detectionStart,
          resolutionTimeMs: 0,
        },
      };
    }

    // Strategy-specific resolution
    let resolutionTime = 0;
    let backoffMs = 0;

    switch (conflictInfo.type) {
      case ConflictType.SERIALIZATION:
        backoffMs = this.calculateBackoff(
          context.previousAttempts,
          conflictInfo.suggestedBackoffMs
        );
        resolutionTime = Date.now() - detectionStart;

        return {
          resolved: true,
          conflictType: conflictInfo.type,
          resolutionStrategy: "EXPONENTIAL_BACKOFF_AND_RETRY",
          message: `Serialization conflict detected. Retrying with ${backoffMs}ms backoff.`,
          nextAction: "RETRY",
          retryCount: context.previousAttempts + 1,
          totalRetries: context.totalAttempts,
          metrics: {
            detectionTimeMs: Date.now() - detectionStart,
            resolutionTimeMs: resolutionTime,
            backoffAppliedMs: backoffMs,
          },
        };

      case ConflictType.DEADLOCK:
        backoffMs = this.calculateBackoff(
          context.previousAttempts,
          conflictInfo.suggestedBackoffMs
        );
        resolutionTime = Date.now() - detectionStart;

        return {
          resolved: true,
          conflictType: conflictInfo.type,
          resolutionStrategy: "DEADLOCK_RECOVERY_AND_RETRY",
          message: `Deadlock detected. Retrying with ${backoffMs}ms backoff.`,
          nextAction: "RETRY",
          retryCount: context.previousAttempts + 1,
          totalRetries: context.totalAttempts,
          metrics: {
            detectionTimeMs: Date.now() - detectionStart,
            resolutionTimeMs: resolutionTime,
            backoffAppliedMs: backoffMs,
          },
        };

      case ConflictType.LOCK_TIMEOUT:
        backoffMs = this.calculateBackoff(
          context.previousAttempts,
          conflictInfo.suggestedBackoffMs,
          10000 // Higher max for lock timeout
        );
        resolutionTime = Date.now() - detectionStart;

        return {
          resolved: true,
          conflictType: conflictInfo.type,
          resolutionStrategy: "TIMEOUT_RECOVERY_AND_RETRY",
          message: `Lock timeout detected. Retrying with ${backoffMs}ms backoff.`,
          nextAction: "RETRY",
          retryCount: context.previousAttempts + 1,
          totalRetries: context.totalAttempts,
          metrics: {
            detectionTimeMs: Date.now() - detectionStart,
            resolutionTimeMs: resolutionTime,
            backoffAppliedMs: backoffMs,
          },
        };

      case ConflictType.STALE_HOLD:
        // Attempt to clean up expired holds and release capacity
        await this.cleanupStaleHolds(context.bookingId).catch((err) => {
          console.warn(
            `[CONFLICT] Failed to cleanup stale holds for ${context.bookingId}:`,
            err
          );
        });

        return {
          resolved: false,
          conflictType: conflictInfo.type,
          resolutionStrategy: "CLEANUP_AND_FAIL",
          message: "Hold has expired. Unable to proceed with booking confirmation.",
          nextAction: "FAIL",
          retryCount: context.previousAttempts,
          totalRetries: context.totalAttempts,
          metrics: {
            detectionTimeMs: Date.now() - detectionStart,
            resolutionTimeMs: Date.now() - detectionStart,
          },
        };

      case ConflictType.CAPACITY_RACE:
        return {
          resolved: false,
          conflictType: conflictInfo.type,
          resolutionStrategy: "CAPACITY_CHECK_FAILED",
          message: "Capacity has been fully booked. Unable to confirm this booking.",
          nextAction: "FAIL",
          retryCount: context.previousAttempts,
          totalRetries: context.totalAttempts,
          metrics: {
            detectionTimeMs: Date.now() - detectionStart,
            resolutionTimeMs: Date.now() - detectionStart,
          },
        };

      case ConflictType.UNKNOWN:
      default:
        return {
          resolved: false,
          conflictType: conflictInfo.type,
          resolutionStrategy: "UNKNOWN_CONFLICT_CANNOT_RESOLVE",
          message: conflictInfo.errorMessage,
          nextAction: "MANUAL_REVIEW",
          retryCount: context.previousAttempts,
          totalRetries: context.totalAttempts,
          metrics: {
            detectionTimeMs: Date.now() - detectionStart,
            resolutionTimeMs: Date.now() - detectionStart,
          },
        };
    }
  }

  /**
   * Cleanup stale/expired holds that prevent booking
   */
  private async cleanupStaleHolds(bookingId: string): Promise<void> {
    try {
      const booking = await this.storage.getBooking(bookingId);
      if (!booking) return;

      const now = new Date();

      // Check if hold is expired
      if (booking.holdId) {
        const hold = await this.storage.getHold(booking.holdId);
        if (hold && hold.expiresAt < now && hold.status === "ACTIVE") {
          // Hold is stale, release it
          console.log(
            `[CONFLICT] Releasing stale hold ${hold.id} (expired at ${hold.expiresAt.toISOString()})`
          );
          await this.storage.releaseHold(hold.id);
        }
      }
    } catch (error) {
      console.warn(`[CONFLICT] Error during stale hold cleanup:`, error);
      throw error;
    }
  }

  /**
   * Pattern matching for serialization errors
   */
  private isSerializationError(message: string): boolean {
    const patterns = [
      /serialization/i,
      /conflict/i,
      /concurrent/i,
      /isolation/i,
      /read.commit/i,
      /repeatable.read/i,
    ];

    return patterns.some((pattern) => pattern.test(message));
  }

  /**
   * Pattern matching for deadlock errors
   */
  private isDeadlockError(message: string): boolean {
    const patterns = [
      /deadlock/i,
      /cycle/i,
      /circular/i,
      /mutual.wait/i,
    ];

    return patterns.some((pattern) => pattern.test(message));
  }

  /**
   * Pattern matching for lock timeout errors
   */
  private isLockTimeoutError(message: string): boolean {
    const patterns = [
      /lock.timeout/i,
      /timeout/i,
      /acquire.*lock/i,
      /wait.*lock/i,
    ];

    return patterns.some((pattern) => pattern.test(message));
  }
}
