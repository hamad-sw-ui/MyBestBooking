export interface PaymentIntent {
  id: string;
  clientSecret: string | null; // null en mode Mock
  status: "requires_payment_method" | "succeeded" | "pending" | "failed";
  amount: number; // cents
  currency: string;
}

export interface CreateIntentParams {
  amount: number; // cents
  currency: string;
  bookingReference: string;
  guestEmail: string;
}

export type WebhookEvent =
  | {
      kind: "payment";
      providerEventId: string;
      type: string;
      paymentIntentId: string;
      status: PaymentIntent["status"];
    }
  | {
      kind: "refund";
      providerEventId: string;
      type: string;
      refundId: string;
      paymentIntentId: string;
      status: RefundResult["status"];
    };

export interface RefundResult {
  id: string;
  status: "succeeded" | "pending" | "failed";
  amount: number; // cents
}

export interface PaymentProvider {
  readonly kind: "mock" | "stripe";
  create(params: CreateIntentParams): Promise<PaymentIntent>;
  /** Annule un intent encore en attente afin qu'il ne soit pas capturé plus tard. */
  cancel(paymentIntentId: string): Promise<"succeeded" | "pending" | "failed">;
  /** Rembourse un PaymentIntent, sans jamais accepter de montant navigateur. */
  refund(paymentIntentId: string, amount: number): Promise<RefundResult>;
  verifyWebhook(
    payload: string,
    signature: string | null,
  ): Promise<WebhookEvent | null>;
}
