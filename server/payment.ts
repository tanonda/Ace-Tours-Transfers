
import { Request, Response } from "express";
import { storage } from "./storage.js";

export const processPayment = async (req: Request, res: Response) => {
  const { paymentId } = req.params;

  if (!paymentId) {
    return res.status(400).send("Payment ID is required");
  }

  const payment = await storage.getPayment(paymentId);

  if (!payment) {
    return res.status(404).send("Payment not found");
  }

  // Simulate a payment form
  res.send(`
    <html>
      <head>
        <title>Simulated Bank Payment</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 40px; }
          .container { max-width: 400px; margin: auto; border: 1px solid #ccc; padding: 20px; border-radius: 5px; }
          .button { padding: 10px 20px; border: none; border-radius: 5px; color: white; cursor: pointer; }
          .success { background-color: #28a745; }
          .fail { background-color: #dc3545; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Simulated Bank Payment</h2>
          <p><strong>Amount:</strong> ${payment.amount} ${payment.currency}</p>
          <p>Click below to simulate a successful or failed payment.</p>
          <form action="/api/payments/callback/${paymentId}" method="post" style="display: inline-block;">
            <input type="hidden" name="status" value="completed" />
            <button type="submit" class="button success">Simulate Success</button>
          </form>
          <form action="/api/payments/callback/${paymentId}" method="post" style="display: inline-block;">
            <input type="hidden" name="status" value="failed" />
            <button type="submit" class="button fail">Simulate Failure</button>
          </form>
        </div>
      </body>
    </html>
  `);
};
