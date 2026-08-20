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

export interface WebhookEvent {
  type: string;
  paymentIntentId: string;
  status: PaymentIntent["status"];
}

export interface PaymentProvider {
  readonly kind: "mock" | "stripe";
  create(params: CreateIntentParams): Promise<PaymentIntent>;
  verifyWebhook(
    payload: string,
    signature: string | null,
  ): Promise<WebhookEvent | null>;
}
