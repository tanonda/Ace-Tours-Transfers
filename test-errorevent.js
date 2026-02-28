const e = new globalThis.ErrorEvent("error");
console.log("Empty ErrorEvent:", e.message, "typeof message:", typeof e.message);

const e2 = new globalThis.ErrorEvent("error", { message: null });
console.log("Null message ErrorEvent:", e2.message, "typeof message:", typeof e2.message);

try {
  e2.message = "Hello";
} catch (err) {
  console.log("Error when setting message:", err.message);
}

// simulate what sentry does => Object.prototype.toString
console.log(Object.prototype.toString.call(e2));

// In Sentry, if error is an ErrorEvent, it extracts message
