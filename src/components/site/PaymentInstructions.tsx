import { useSiteSettings } from "@/hooks/useSiteSettings";

/** How to pay for mobile money and bank transfer orders (from Admin → Settings). */
export function PaymentInstructions({
  method,
  reference,
}: {
  method: string;
  /** Order number to quote as the payment reference, once the order exists. */
  reference?: string;
}) {
  const { payments } = useSiteSettings();
  const quote = reference ? (
    <>
      Use <span className="font-medium text-foreground">{reference}</span> as the reference.
    </>
  ) : (
    "Use your order number (shown after you place the order) as the reference."
  );

  if (method === "mobile_money" && payments.mobile_money_number) {
    return (
      <div className="rounded-md border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
        <div className="text-xs uppercase tracking-wider text-primary">Mobile money</div>
        <p className="mt-1">
          Send the total to{" "}
          <span className="font-medium text-foreground">{payments.mobile_money_number}</span>
          {payments.mobile_money_name && <> ({payments.mobile_money_name})</>}. {quote}
        </p>
      </div>
    );
  }
  if (method === "bank_transfer" && payments.bank_details) {
    return (
      <div className="rounded-md border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
        <div className="text-xs uppercase tracking-wider text-primary">Bank transfer</div>
        <p className="mt-1 whitespace-pre-line text-foreground">{payments.bank_details}</p>
        <p className="mt-2">{quote}</p>
      </div>
    );
  }
  if (method === "mobile_money" || method === "bank_transfer") {
    return (
      <p className="text-sm text-muted-foreground">
        We'll contact you with payment details after you place the order.
      </p>
    );
  }
  return null;
}
