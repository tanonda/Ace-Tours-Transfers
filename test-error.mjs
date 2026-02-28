import express from 'express';
import * as Sentry from '@sentry/node';

// We just want to see how Sentry formats an ErrorEvent
const obj = new Event("error");
console.log(JSON.stringify(obj));
const errObj = new ErrorEvent("error", { error: null, message: "null" });
console.log(JSON.stringify(errObj));

// Is it possible the object was { type: "Error", value: null }?
const customErr = { type: "Error", value: null };
console.log(JSON.stringify(customErr));
