/**
 * BookingConfirmationWithRetries - PHASE 4: RESILIENT CONFIRMATION
 * 
 * Combines atomic confirmation with intelligent retry logic.
 * Handles transient failures transparently while protecting against
 * permanent failures.
 * 
 * Key features:
 * ✅ Exponential backoff for transient failures
 * ✅ Automatic conflict detection and recovery
 * ✅ Idempotency support for safe retries
 * ✅ Detailed metrics for monitoring
 * ✅ Clear error reporting
 */

import { IStorage } from "../../storage.js";
import {
  AtomicBookingConfirmationService,
  AtomicConfirmationRequest,
  AtomicConfirmationResult,
  ConfirmationErrorCode,
} from "./AtomicBookingConfirmationService.js";
import {
  ConcurrencyConflictHandler,
  ConflictType,
} from "./ConcurrencyConflictHandler.js";
import { metricsService } from "../../infrastructure/metrics/metrics.service.js";

export interface BookingConfirmationWithRetriesRequest
  extends AtomicConfirmationRequest {
  maxRetries?: number;
  initialBackoffMs?: number;
  idempotencyKey?: string;
}

export interface BookingConfirmationWithRetriesResult
  extends AtomicConfirmationResult {
  retryAttempts?: number;
  totalAttempts?: number;
  conflictHandling?: {
    conflictDetected: boolean;
    conflictType?: ConflictType;
    resolutionStrategy?: string;
    backoffAppliedMs?: number;
  };
}

export class BookingConfirmationWithRetries {
  private atomicService: AtomicBookingConfirmationService;
  private conflictHandler: ConcurrencyConflictHandler;
  private storage: IStorage;

  // Default parameters
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly DEFAULT_INITIAL_BACKOFF_MS = 50;
  private readonly MAX_BACKOFF_MS = 5000;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.atomicService = new AtomicBookingConfirmationService(storage);
    this.conflictHandler = new ConcurrencyConflictHandler(storage);
  }

  /**
   * Main entry point: Confirm booking with intelligent retries
   * 
   * This method provides a production-ready confirmation flow:
   * 1. Attempt atomic confirmation
   * 2. On failure, analyze conflict type
   * 3. If retryable, wait with exponential backoff
   * 4. Retry up to max attempts
   * 5. Return detailed result with telemetry
   */
  async confirmWithRetries(
    request: BookingConfirmationWithRetriesRequest
  ): Promise<BookingConfirmationWithRetriesResult> {
    const startTime = Date.now();
    const maxRetries = request.maxRetries ?? this.DEFAULT_MAX_RETRIES;
    const initialBackoffMs =
      request.initialBackoffMs ?? this.DEFAULT_INITIAL_BACKOFF_MS;

    const { bookingId } = request;
    let lastResult: AtomicConfirmationResult | null = null;
    let lastError: Error | null = null;
    let totalAttempts = 0;

    console.log(
      `[CONFIRM_RETRY] Starting confirmation for booking ${bookingId} (max ${maxRetries} retries)`
    );

    for (let attemptNumber = 0; attemptNumber <= maxRetries; attemptNumber++) {
      totalAttempts++;

      console.log(
        `[CONFIRM_RETRY] Attempt ${attemptNumber + 1}/${maxRetries + 1} for booking ${bookingId}`
      );

      try {
        // Attempt atomic confirmation
        const result = await this.atomicService.confirmBookingAtomically(
          request
        );

        if (result.success) {
          // SUCCESS!
          const elapsedMs = Date.now() - startTime;

          const successResult: BookingConfirmationWithRetriesResult = {
            ...result,
            retryAttempts: attemptNumber,
            totalAttempts,
            conflictHandling: {
              conflictDetected: false,
            },
            metrics: {
              ...result.metrics,
              timeMs: elapsedMs,
            },
          };

          console.log(
            `[CONFIRM_RETRY] ✅ Booking ${bookingId} confirmed on attempt ${attemptNumber + 1} in ${elapsedMs}ms`
          );

          metricsService.recordRetryableConfirmationAttempts(
            attemptNumber + 1
          );

          return successResult;
        }

        // Confirmation failed but might be retryable
        lastResult = result;

        // Check if we should retry
        if (!result.error?.isRetryable) {
          // Not retryable - return immediately
          console.log(
            `[CONFIRM_RETRY] ⚠️ Non-retryable error: ${result.error?.code}`
          );

          const elapsedMs = Date.now() - startTime;
          const failResult: BookingConfirmationWithRetriesResult = {
            ...result,
            retryAttempts: attemptNumber,
            totalAttempts,
            conflictHandling: {
              conflictDetected: false,
            },
            metrics: {
              ...result.metrics,
              timeMs: elapsedMs,
            },
          };

          metricsService.incrementNonRetryableConfirmationFailure(
            result.error?.code || ConfirmationErrorCode.UNKNOWN_ERROR
          );

          return failResult;
        }

        // Error is retryable - analyze conflict
        const conflictInfo = this.conflictHandler.analyzeConflict(
          result.message,
          result.error?.code
        );

        const conflict = await this.conflictHandler.resolveConflict(
          conflictInfo,
          {
            bookingId,
            previousAttempts: attemptNumber,
            totalAttempts,
          }
        );

        if (!conflict.resolved || conflict.nextAction !== "RETRY") {
          // Cannot retry further
          console.log(
            `[CONFIRM_RETRY] Cannot retry: ${conflict.resolutionStrategy}`
          );

          const elapsedMs = Date.now() - startTime;
          const conflictFailResult: BookingConfirmationWithRetriesResult = {
            ...result,
            retryAttempts: attemptNumber,
            totalAttempts,
            conflictHandling: {
              conflictDetected: true,
              conflictType: conflict.conflictType,
              resolutionStrategy: conflict.resolutionStrategy,
            },
            metrics: {
              ...result.metrics,
              timeMs: elapsedMs,
            },
          };

          metricsService.incrementConflictDetectedFailure(
            conflict.conflictType
          );

          return conflictFailResult;
        }

        // Retry with backoff
        const backoffMs = conflict.metrics?.backoffAppliedMs || 0;

        if (backoffMs > 0 && attemptNumber < maxRetries) {
          console.log(
            `[CONFIRM_RETRY] Conflict detected (${conflict.conflictType}). Waiting ${backoffMs}ms before retry...`
          );

          await this.sleep(backoffMs);
        }

        // Continue to next iteration
      } catch (error) {
        // Unexpected error during attempt
        lastError = error instanceof Error ? error : new Error(String(error));

        console.error(
          `[CONFIRM_RETRY] Unexpected error on attempt ${attemptNumber + 1}:`,
          error
        );

        // Analyze if the error is retryable
        const conflictInfo = this.conflictHandler.analyzeConflict(
          error instanceof Error ? error.message : String(error),
          ConfirmationErrorCode.UNKNOWN_ERROR
        );

        if (!conflictInfo.isRetryable) {
          // Not retryable
          const elapsedMs = Date.now() - startTime;
          const errorResult: BookingConfirmationWithRetriesResult = {
            success: false,
            bookingId,
            message: "Booking confirmation failed with non-retryable error",
            retryAttempts: attemptNumber,
            totalAttempts,
            conflictHandling: {
              conflictDetected: true,
              conflictType: conflictInfo.type,
            },
            error: {
              code: conflictInfo.errorCode,
              reason: "Unexpected error",
              details:
                lastError instanceof Error ? lastError.message : String(error),
              isRetryable: false,
            },
            metrics: {
              lockedRows: 0,
              verificationsPerformed: 0,
              timeMs: elapsedMs,
            },
          };

          metricsService.incrementNonRetryableConfirmationFailure(
            conflictInfo.errorCode
          );

          return errorResult;
        }

        // Error is retryable - continue loop
        if (attemptNumber < maxRetries) {
          const backoffMs = this.conflictHandler.calculateBackoff(
            attemptNumber,
            this.DEFAULT_INITIAL_BACKOFF_MS,
            this.MAX_BACKOFF_MS
          );

          console.log(
            `[CONFIRM_RETRY] Retryable error. Waiting ${backoffMs}ms before retry...`
          );

          await this.sleep(backoffMs);
        }
      }
    }

    // Exhausted all retries
    const elapsedMs = Date.now() - startTime;

    if (lastResult) {
      // Return last result with exhausted retries indicator
      const exhaustedResult: BookingConfirmationWithRetriesResult = {
        ...lastResult,
        message: `Booking confirmation failed after ${maxRetries + 1} attempts`,
        retryAttempts: maxRetries,
        totalAttempts,
        conflictHandling: {
          conflictDetected: true,
        },
        metrics: {
          ...lastResult.metrics,
          timeMs: elapsedMs,
        },
      };

      console.log(
        `[CONFIRM_RETRY] ❌ Booking ${bookingId} confirmation failed after ${maxRetries + 1} attempts`
      );

      metricsService.incrementRetryExhausted();

      return exhaustedResult;
    }

    // Should not reach here, but handle gracefully
    const unknownFailure: BookingConfirmationWithRetriesResult = {
      success: false,
      bookingId,
      message: "Booking confirmation failed - unknown error after retries",
      retryAttempts: maxRetries,
      totalAttempts,
      conflictHandling: {
        conflictDetected: false,
      },
      error: {
        code: ConfirmationErrorCode.UNKNOWN_ERROR,
        reason: "Unexpected failure state",
        isRetryable: false,
      },
      metrics: {
        lockedRows: 0,
        verificationsPerformed: 0,
        timeMs: elapsedMs,
      },
    };

    metricsService.incrementNonRetryableConfirmationFailure(
      ConfirmationErrorCode.UNKNOWN_ERROR
    );

    return unknownFailure;
  }

  /**
   * Sleep utility for backoff delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if a booking is already confirmed (idempotency check)
   */
  async isBookingConfirmed(bookingId: string): Promise<boolean> {
    const booking = await this.storage.getBooking(bookingId);
    return booking?.status === "confirmed";
  }

  /**
   * Cancel a booking with retry logic
   */
  async cancelWithRetries(
    bookingId: string,
    reason: string,
    maxRetries: number = 3
  ): Promise<{
    success: boolean;
    message: string;
    attempts: number;
    error?: string;
  }> {
    let attempts = 0;

    for (let attemptNumber = 0; attemptNumber <= maxRetries; attemptNumber++) {
      attempts++;

      try {
        const result = await this.atomicService.cancelBookingAtomically(
          bookingId,
          reason
        );

        if (result.success) {
          return {
            success: true,
            message: result.message,
            attempts,
          };
        }

        // Non-fatal cancel error
        if (attemptNumber < maxRetries) {
          const backoffMs = this.conflictHandler.calculateBackoff(
            attemptNumber,
            this.DEFAULT_INITIAL_BACKOFF_MS
          );

          await this.sleep(backoffMs);
        }
      } catch (error) {
        if (attemptNumber < maxRetries) {
          const backoffMs = this.conflictHandler.calculateBackoff(
            attemptNumber,
            this.DEFAULT_INITIAL_BACKOFF_MS
          );

          await this.sleep(backoffMs);
        } else {
          return {
            success: false,
            message: "Failed to cancel booking after retries",
            attempts,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }

    return {
      success: false,
      message: "Failed to cancel booking - exhausted retries",
      attempts,
    };
  }
}
