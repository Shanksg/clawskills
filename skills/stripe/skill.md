# Stripe Skill

> **Last validated:** 2026-03-01 | **API version:** `2026-02-25.clover` (latest stable)
> **REST base URL:** `https://api.stripe.com/v1/`
> **Assumed product:** Stripe Payments + Billing. Stripe Connect (multi-account platform) is covered in the Auth and Recipes sections.

---

## What this skill enables

- Collect one-time payments and save cards for future use without handling raw card data (PCI-compliant via Stripe.js / Payment Element).
- Create and manage recurring subscriptions with automatic billing, dunning, and trial periods.
- Issue full or partial refunds and query payment history programmatically.
- Build hosted checkout flows (Checkout Sessions) that Stripe renders — no front-end payment UI required.
- Handle post-payment events reliably via webhooks: fulfil orders, provision access, update CRM records.
- Operate as a platform (Stripe Connect): onboard connected accounts, route payments, split revenue.
- Test the full payment lifecycle with Stripe's sandbox — no real money, no bank involvement.

---

## Best-fit use cases

| Use case | Why it matters | Primary objects | Typical trigger | Success criteria |
|----------|---------------|-----------------|-----------------|-----------------|
| One-time purchase | Charge a customer once for a product or service | PaymentIntent, PaymentMethod, Customer | User submits payment form | `payment_intent.succeeded` webhook received; order fulfilled |
| Save card for future billing | Charge a returning customer without re-entering card | PaymentMethod, Customer | User checks "save card" | PaymentMethod attached to Customer; future charges succeed |
| Recurring subscription | Monthly/annual SaaS or membership billing | Subscription, Price, Invoice, Customer | User selects plan | Subscription `active`; first invoice `paid` |
| Hosted checkout page | Delegate payment UI to Stripe | Checkout Session | User clicks "Buy now" | `checkout.session.completed` webhook; `payment_status: paid` |
| Issue a refund | Reverse a charge (full or partial) | Refund, Charge | Support request or automated policy | Refund `succeeded`; `charge.refunded` webhook received |
| Failed payment recovery | Retry a failed subscription invoice | Invoice, PaymentIntent | `invoice.payment_failed` webhook | Payment retried; subscription back to `active` |
| Multi-vendor marketplace | Route payments between platform and sellers | Connect Account, Transfer, Charge | Order placed on platform | Connected account receives funds; platform fee collected |
| Payout reporting | Pull all payouts and match to bank statement | Payout, BalanceTransaction | Finance reconciliation run | Every payout has matching BalanceTransactions totalling net amount |
| Metered billing | Charge based on usage at end of billing period | SubscriptionItem, UsageRecord, Invoice | Usage event from product | Invoice includes correct usage line items |
| Payment link (no-code) | Generate a shareable URL for one-time or recurring payment | PaymentLink | Sales or support request | Customer completes payment via link; webhook confirms |

---

## Key concepts & data model

### Core objects

| Object | Description | ID prefix |
|--------|-------------|-----------|
| **Customer** | A person or business entity; stores payment methods and billing info | `cus_` |
| **PaymentIntent** | The authoritative record of a payment attempt; tracks state through to success/failure | `pi_` |
| **PaymentMethod** | A reusable token representing a card, bank account, or wallet | `pm_` |
| **Charge** | A legacy object created when a PaymentIntent succeeds; most APIs now return the PaymentIntent directly | `ch_` |
| **Invoice** | A bill sent to a Customer; created automatically for subscriptions | `in_` |
| **Subscription** | A recurring billing agreement linking a Customer to one or more Prices | `sub_` |
| **Price** | Defines the billing amount, currency, and interval for a Product | `price_` |
| **Product** | A good or service offered; Prices are attached to Products | `prod_` |
| **Refund** | A reversal of a Charge, full or partial | `re_` |
| **Checkout Session** | A hosted payment page managed by Stripe | `cs_` |
| **PaymentLink** | A shareable URL backed by a Checkout Session template | `plink_` |
| **Transfer** | Funds moved from platform balance to a connected account | `tr_` |
| **Payout** | Funds sent from Stripe balance to a bank account | `po_` |
| **BalanceTransaction** | Every money movement in Stripe (fee, charge, refund, payout) | `txn_` |
| **Event** | A webhook payload describing a state change | `evt_` |
| **Connected Account** | An account on your platform (Stripe Connect) | `acct_` |

### PaymentIntent lifecycle

```
requires_payment_method → requires_confirmation → requires_action → processing → succeeded
                                                                               ↘ canceled
```

| Status | Meaning |
|--------|---------|
| `requires_payment_method` | No valid payment method attached yet |
| `requires_confirmation` | Payment method attached; awaiting explicit confirm call |
| `requires_action` | 3D Secure or redirect authentication needed from the customer |
| `processing` | Bank processing in progress (instant cards transition through this quickly) |
| `succeeded` | Payment captured; funds reserved or settled |
| `canceled` | Cancelled; a new PaymentIntent must be created |

### Subscription lifecycle

| Status | Meaning |
|--------|---------|
| `trialing` | In free trial; no payment yet |
| `active` | In good standing; latest invoice paid |
| `incomplete` | First payment not yet made; customer has 23 hours |
| `incomplete_expired` | Initial 23-hour window expired without payment |
| `past_due` | Latest renewal invoice failed; automatic retries in progress |
| `unpaid` | Retries exhausted; subscription remains but no more attempts |
| `paused` | Trial ended without a default payment method |
| `canceled` | Terminal; cannot be reactivated |

### Amounts and currencies

All monetary amounts are in the **smallest currency unit** — cents for USD, pence for GBP, yen for JPY (which has no subunit, so `100` = ¥100). Always store and pass amounts as integers.

### Expandable fields

Any field that returns an ID (e.g., `"customer": "cus_xxx"`) can be expanded to the full object by passing `expand[]=customer` in the request. Nest with dots: `expand[]=latest_invoice.payment_intent`.

### Metadata

Every Stripe object has a `metadata` dictionary for storing arbitrary key/value pairs (e.g., your internal IDs). Limits: 50 keys per object, key ≤ 40 chars, value ≤ 500 chars.

---

## Authentication & permissions

### API key types

| Key type | Prefix | Use | Never in |
|----------|--------|-----|----------|
| Secret (live) | `sk_live_` | Server-side; full API access | Client-side code, logs, version control |
| Secret (sandbox) | `sk_test_` | Server-side; test mode only | Production environments |
| Publishable (live) | `pk_live_` | Browser/mobile; only creates tokens | Server-side requests |
| Publishable (sandbox) | `pk_test_` | Browser/mobile; test mode | Production environments |
| Restricted | `rk_live_` / `rk_test_` | Server-side; limited to specific resources | When full access is needed |

Create restricted keys in **Dashboard → Developers → API keys → Create restricted key**. Assign **None / Read / Write** per resource (Customers, PaymentIntents, Subscriptions, etc.).

### Authentication header

Stripe uses HTTP Basic auth with the secret key as the username and an empty password. All major HTTP clients also accept `Authorization: Bearer sk_...`:

```bash
# Basic auth (canonical Stripe style)
curl https://api.stripe.com/v1/customers \
  -u "sk_test_51Abc123...:

# Bearer token (equivalent)
curl https://api.stripe.com/v1/customers \
  -H "Authorization: Bearer sk_test_51Abc123..."
```

### API version pinning

Always pin the API version explicitly to avoid unexpected behaviour when Stripe releases a new default:

```bash
curl https://api.stripe.com/v1/payment_intents \
  -u "sk_test_...:" \
  -H "Stripe-Version: 2026-02-25.clover" \
  -d amount=2000 \
  -d currency=usd
```

Set a default version for your account in **Dashboard → Developers → API version**. The SDK reads your account default unless you override per-request.

### Stripe Connect — acting on behalf of a connected account

Pass `Stripe-Account: acct_xxx` to perform an API call in the context of a connected account using your platform key:

```bash
curl https://api.stripe.com/v1/customers \
  -u "sk_live_platform...:" \
  -H "Stripe-Account: acct_1ABCxyzConnected"
```

### Idempotency keys

Use `Idempotency-Key` on every `POST` request to safely retry without double-charging:

```bash
curl https://api.stripe.com/v1/payment_intents \
  -u "sk_test_...:" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d amount=2000 \
  -d currency=usd
```

- Keys are strings up to 255 characters; UUIDs v4 are recommended.
- Results are cached for **24 hours**. Reusing a key after expiry generates a new request.
- Reusing a key with **different parameters** returns a `409 Conflict` `idempotency_error`.
- Only use on `POST` — `GET` and `DELETE` are inherently idempotent.

---

## Common workflows (recipes)

### 1. Create a one-time payment (PaymentIntent flow)

**Server-side — create PaymentIntent:**

```bash
curl https://api.stripe.com/v1/payment_intents \
  -u "sk_test_...:" \
  -H "Idempotency-Key: order-42-$(date +%s)" \
  -d amount=4999 \
  -d currency=usd \
  -d "automatic_payment_methods[enabled]=true" \
  -d "metadata[order_id]=order_42"
```

**Response (key fields):**

```json
{
  "id": "pi_3OxAbc2eZvKYlo2C1hb8mT9k",
  "object": "payment_intent",
  "amount": 4999,
  "currency": "usd",
  "status": "requires_payment_method",
  "client_secret": "pi_3OxAbc...hb8mT9k_secret_Xyz",
  "metadata": { "order_id": "order_42" }
}
```

**Client-side — confirm with Stripe.js:**

```javascript
const { error } = await stripe.confirmPayment({
  elements,                      // Stripe Elements instance
  clientSecret: pi.client_secret,
  confirmParams: {
    return_url: "https://example.com/order/complete"
  }
});
```

**Fulfil on webhook `payment_intent.succeeded`** — see Recipes #7.

---

### 2. Save a card for future use

```bash
# Step 1 — create or retrieve the Customer
curl https://api.stripe.com/v1/customers \
  -u "sk_test_...:" \
  -d email="alice@example.com" \
  -d "metadata[user_id]=usr_99"

# Step 2 — create a SetupIntent (confirm later via Stripe.js)
curl https://api.stripe.com/v1/setup_intents \
  -u "sk_test_...:" \
  -d customer=cus_PAbcXyz \
  -d "automatic_payment_methods[enabled]=true"
```

After the client confirms the SetupIntent, the PaymentMethod is attached to the Customer. To charge it later:

```bash
curl https://api.stripe.com/v1/payment_intents \
  -u "sk_test_...:" \
  -d amount=2000 \
  -d currency=usd \
  -d customer=cus_PAbcXyz \
  -d payment_method=pm_1ABCdefGhIjKlMnO \
  -d confirm=true \
  -d off_session=true
```

`off_session=true` signals that the customer is not present — Stripe will attempt to complete without 3DS if allowed by the card issuer.

---

### 3. Create a subscription

```bash
# Step 1 — ensure Customer has a default PaymentMethod
curl https://api.stripe.com/v1/customers/cus_PAbcXyz \
  -u "sk_test_...:" \
  -X POST \
  -d invoice_settings[default_payment_method]=pm_1ABCdefGhIjKlMnO

# Step 2 — create the Subscription
curl https://api.stripe.com/v1/subscriptions \
  -u "sk_test_...:" \
  -d customer=cus_PAbcXyz \
  -d "items[0][price]=price_1ABCdefGhIjKlMnO" \
  -d payment_behavior=default_incomplete \
  -d "expand[]=latest_invoice.payment_intent"
```

`payment_behavior=default_incomplete` starts the subscription in `incomplete` status — confirm payment client-side using the `latest_invoice.payment_intent.client_secret` before it expires (23 hours).

**Response (key fields):**

```json
{
  "id": "sub_1ABCdef...",
  "status": "incomplete",
  "current_period_end": 1740000000,
  "latest_invoice": {
    "id": "in_1ABCdef...",
    "payment_intent": {
      "id": "pi_1ABCdef...",
      "client_secret": "pi_...secret_..."
    }
  }
}
```

---

### 4. Create a hosted Checkout Session

No front-end payment form — Stripe hosts and renders it:

```bash
curl https://api.stripe.com/v1/checkout/sessions \
  -u "sk_test_...:" \
  -d mode=payment \
  -d "line_items[0][price]=price_1ABCdefGhIjKlMnO" \
  -d "line_items[0][quantity]=1" \
  -d success_url="https://example.com/success?session_id={CHECKOUT_SESSION_ID}" \
  -d cancel_url="https://example.com/cancel" \
  -d customer_email="alice@example.com"
```

Redirect the browser to `session.url`. Stripe handles the payment UI and redirects to `success_url` on completion. Confirm fulfilment via `checkout.session.completed` webhook — do not trust the redirect URL alone.

For a subscription Checkout Session, change `mode=subscription` and pass a recurring Price.

---

### 5. Issue a full refund

```bash
curl https://api.stripe.com/v1/refunds \
  -u "sk_test_...:" \
  -H "Idempotency-Key: refund-ch_1ABC-$(date +%s)" \
  -d charge=ch_1ABCdefGhIjKlMnO
```

**Partial refund** — add `amount` in cents:

```bash
curl https://api.stripe.com/v1/refunds \
  -u "sk_test_...:" \
  -d charge=ch_1ABCdefGhIjKlMnO \
  -d amount=500
```

**Response (key fields):**

```json
{
  "id": "re_1ABCdef...",
  "object": "refund",
  "amount": 500,
  "status": "succeeded",
  "charge": "ch_1ABCdef..."
}
```

Watch for `charge.refunded` webhook for async confirmation.

---

### 6. Handle a failed subscription payment

```python
import stripe

stripe.api_key = "sk_live_..."

# Called from your webhook handler when invoice.payment_failed fires
def handle_payment_failed(invoice_id: str) -> None:
    invoice = stripe.Invoice.retrieve(invoice_id, expand=["subscription"])
    sub = invoice.subscription

    if sub.status == "past_due":
        # Notify the customer to update their payment method
        send_dunning_email(sub.customer, invoice.hosted_invoice_url)

    # Stripe will automatically retry according to your retry schedule
    # (Dashboard → Settings → Billing → Retry schedule)
    # To trigger an immediate retry:
    # stripe.Invoice.pay(invoice_id)
```

When the customer updates their payment method:

```bash
# Attach the new PaymentMethod to the Customer
curl https://api.stripe.com/v1/payment_methods/pm_NEW.../attach \
  -u "sk_live_...:" \
  -d customer=cus_PAbcXyz

# Attempt to pay the open invoice immediately
curl https://api.stripe.com/v1/invoices/in_OPEN.../pay \
  -u "sk_live_...:" \
  -X POST
```

---

### 7. Webhook receiver — verify and dispatch

```python
import stripe
from flask import Flask, request, jsonify

app = Flask(__name__)
stripe.api_key = "sk_live_..."
WEBHOOK_SECRET = "whsec_..."

@app.post("/stripe/webhook")
def webhook():
    sig = request.headers.get("Stripe-Signature")
    try:
        event = stripe.Webhook.construct_event(
            payload=request.data,      # raw bytes — do NOT parse JSON first
            sig_header=sig,
            secret=WEBHOOK_SECRET,
        )
    except stripe.error.SignatureVerificationError:
        return jsonify(error="invalid signature"), 400

    match event["type"]:
        case "payment_intent.succeeded":
            handle_payment_succeeded(event["data"]["object"])
        case "invoice.paid":
            handle_invoice_paid(event["data"]["object"])
        case "customer.subscription.deleted":
            handle_subscription_cancelled(event["data"]["object"])
        case "checkout.session.completed":
            handle_checkout_complete(event["data"]["object"])

    # Must return 2xx within ~30 seconds or Stripe retries
    return jsonify(ok=True), 200
```

**Critical rules:**
- Always verify the `Stripe-Signature` header before processing.
- Read raw request body — any JSON parsing before `construct_event` may corrupt the signature.
- Return `200` before triggering long-running work (enqueue a job instead).
- Make handlers **idempotent** — Stripe may deliver the same event more than once. Use `event.id` to deduplicate.

---

### 8. Stripe Connect — charge on a connected account (destination charge)

```bash
# Create a PaymentIntent where funds go to the connected account
# Platform retains application_fee_amount
curl https://api.stripe.com/v1/payment_intents \
  -u "sk_live_platform...:" \
  -d amount=5000 \
  -d currency=usd \
  -d "automatic_payment_methods[enabled]=true" \
  -d transfer_data[destination]=acct_1ConnectedAcct \
  -d application_fee_amount=500
```

**Direct charge** (create on the connected account itself):

```bash
curl https://api.stripe.com/v1/payment_intents \
  -u "sk_live_platform...:" \
  -H "Stripe-Account: acct_1ConnectedAcct" \
  -d amount=5000 \
  -d currency=usd \
  -d "automatic_payment_methods[enabled]=true"
```

**Create a connected account (Express onboarding):**

```bash
# Step 1 — create the account
curl https://api.stripe.com/v1/accounts \
  -u "sk_live_platform...:" \
  -d type=express \
  -d country=US \
  -d email="seller@example.com"
# → { "id": "acct_1ABCdef...", ... }

# Step 2 — generate onboarding link
curl https://api.stripe.com/v1/account_links \
  -u "sk_live_platform...:" \
  -d account=acct_1ABCdef \
  -d "refresh_url=https://example.com/reauth" \
  -d "return_url=https://example.com/onboarded" \
  -d type=account_onboarding
# → { "url": "https://connect.stripe.com/setup/e/..." }
```

---

### 9. Retrieve customer payment history (list charges)

```python
import stripe

stripe.api_key = "sk_live_..."

def get_customer_charges(customer_id: str, limit: int = 100) -> list:
    charges = []
    params = {
        "customer": customer_id,
        "limit": 100,
    }
    while True:
        page = stripe.Charge.list(**params)
        charges.extend(page.data)
        if not page.has_more:
            break
        params["starting_after"] = page.data[-1].id
    return charges
```

---

### 10. Cancel a subscription (at period end)

```bash
# Cancel at the end of the current billing period (no proration)
curl https://api.stripe.com/v1/subscriptions/sub_1ABCdef... \
  -u "sk_live_...:" \
  -X POST \
  -d cancel_at_period_end=true

# Cancel immediately
curl https://api.stripe.com/v1/subscriptions/sub_1ABCdef... \
  -u "sk_live_...:" \
  -X DELETE
```

Listen for `customer.subscription.deleted` webhook to revoke access.

---

## Query patterns & filtering

### Cursor-based pagination

All list endpoints return a consistent envelope:

```json
{
  "object": "list",
  "data": [ ... ],
  "has_more": true,
  "url": "/v1/charges"
}
```

Parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 10 | 100 | Items per page |
| `starting_after` | string | — | — | ID of last item on previous page (forward pagination) |
| `ending_before` | string | — | — | ID of first item on next page (backward pagination) |

`starting_after` and `ending_before` are mutually exclusive.

### Date range filters

All list endpoints support `created[gte]` / `created[lte]` (Unix timestamps):

```bash
# All charges from the last 7 days
curl "https://api.stripe.com/v1/charges?limit=100&created[gte]=$(date -v-7d +%s)" \
  -u "sk_live_...:"
```

Other common filter parameters:

| Endpoint | Filter | Example |
|----------|--------|---------|
| `/v1/charges` | `customer`, `payment_intent`, `created[gte/lte]` | `customer=cus_xxx` |
| `/v1/subscriptions` | `customer`, `status`, `price`, `current_period_end[gte]` | `status=past_due` |
| `/v1/invoices` | `customer`, `subscription`, `status`, `due_date[gte]` | `status=open` |
| `/v1/payment_intents` | `customer`, `created[gte/lte]` | `customer=cus_xxx` |
| `/v1/refunds` | `charge`, `payment_intent`, `created[gte/lte]` | `charge=ch_xxx` |

### Auto-pagination (Python SDK)

```python
# Iterates all pages automatically
for charge in stripe.Charge.list(customer="cus_xxx", limit=100).auto_paging_iter():
    process(charge)
```

### Search API

Stripe has a structured Search API for Customers, PaymentIntents, Charges, Subscriptions, and Invoices:

```bash
curl "https://api.stripe.com/v1/customers/search?query=email:'alice@example.com'" \
  -u "sk_live_...:"
```

Search is rate-limited to **20 read operations per second** (stricter than list endpoints).

---

## Reliability: rate limits, retries, idempotency

### Rate limits

| Mode | Global limit | Notes |
|------|-------------|-------|
| Live | **100 req/sec** | Per account; some endpoints are stricter (see below) |
| Sandbox | **25 req/sec** | Intentionally lower to surface rate-limit bugs early |

**Endpoint-specific limits (stricter):**

| Endpoint | Limit |
|----------|-------|
| Search API | 20 read ops/sec |
| Files API | 20 reads/sec, 20 writes/sec |
| Meter Events (`/v1/billing/meter_events`) | 1,000/sec live |
| PaymentIntent updates | 1,000 updates/PaymentIntent/hr |
| Create Payout | 15/sec, 30 concurrent |
| Connect — create account | 5/sec sandbox, 30/sec live |

### Rate limit response

HTTP `429` with header:

```
Stripe-Rate-Limited-Reason: global-rate
```

Possible values: `global-concurrency`, `global-rate`, `endpoint-concurrency`, `endpoint-rate`, `resource-specific`.

### Retry with exponential backoff + jitter

```python
import time, random, stripe

def stripe_call_with_retry(fn, *args, max_retries=5, **kwargs):
    for attempt in range(max_retries):
        try:
            return fn(*args, **kwargs)
        except stripe.error.RateLimitError:
            if attempt == max_retries - 1:
                raise
            wait = (2 ** attempt) + random.uniform(0, 1)
            time.sleep(wait)
        except stripe.error.APIConnectionError:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)
```

**Python SDK auto-retry:** `stripe.max_network_retries = 3` enables built-in retry for network errors and `429`s.

### Idempotency

- Include `Idempotency-Key` on every `POST` (charge, refund, subscription creation).
- Use a stable key derived from your internal operation ID, e.g., `f"order-{order_id}-payment"`.
- Results cached **24 hours**; same key = same response (including `5xx` errors).
- Different params + same key = `409 idempotency_error`.

```python
stripe.PaymentIntent.create(
    amount=4999,
    currency="usd",
    idempotency_key=f"order-{order_id}-payment-intent",
)
```

---

## Error handling & troubleshooting

### Error object

```json
{
  "error": {
    "type": "card_error",
    "code": "card_declined",
    "decline_code": "insufficient_funds",
    "message": "Your card has insufficient funds.",
    "param": null,
    "charge": "ch_1ABCdef...",
    "doc_url": "https://stripe.com/docs/error-codes/card-declined"
  }
}
```

### HTTP status → action

| Status | Type | Action |
|--------|------|--------|
| `400` | `invalid_request_error` | Fix the request — missing or malformed parameter. Check `error.param`. |
| `401` | `api_error` | Invalid API key. Verify `sk_live_`/`sk_test_` prefix matches environment. |
| `402` | `card_error` | Card declined or transaction failed. Show `error.message` to the user. |
| `403` | `api_error` | Insufficient permissions — use a secret key or check restricted key scopes. |
| `404` | `invalid_request_error` | Object not found. Verify the ID prefix matches the endpoint. |
| `409` | `idempotency_error` | Same idempotency key reused with different params. Generate a new key. |
| `429` | — | Rate limited. Retry with exponential backoff; see `Stripe-Rate-Limited-Reason`. |
| `5xx` | `api_error` | Stripe infrastructure issue. Retry with backoff; check https://status.stripe.com. |

### Error type → handler

| `error.type` | Meaning | What to do |
|--------------|---------|------------|
| `card_error` | Card issue (decline, insufficient funds, expired) | Show `error.message` to the end user; do not retry without user action |
| `invalid_request_error` | Bad API request | Fix the code; do not retry unchanged |
| `api_error` | Stripe-side problem | Retry with exponential backoff |
| `idempotency_error` | Key reused with different params | Generate a new idempotency key |

### Common `decline_code` values

| `decline_code` | Meaning | User-facing message |
|----------------|---------|---------------------|
| `card_declined` | Generic decline from issuer | "Your card was declined. Please try a different card." |
| `insufficient_funds` | Not enough balance | "Your card has insufficient funds." |
| `expired_card` | Card expired | "Your card is expired. Please update your payment method." |
| `incorrect_cvc` | Wrong CVC | "Incorrect security code. Please check and try again." |
| `stolen_card` / `lost_card` | Flagged by issuer | "Your card was declined. Please contact your bank." |
| `do_not_honor` | Issuer catch-all decline | "Your card was declined. Please try a different card or contact your bank." |
| `fraudulent` | Stripe Radar blocked | Log internally; do not tell user it was flagged as fraud |

### Troubleshooting checklist

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `401 Unauthorized` | Wrong key or test key in prod | Confirm key prefix: `sk_live_` for production |
| `404` on a valid-looking ID | Wrong mode (test ID in live mode) | `pi_test_...` IDs only work with `sk_test_...` |
| Webhook `400` signature failure | Raw body was parsed/modified | Use `request.data` (raw bytes) before passing to `construct_event` |
| `409 idempotency_error` | Same key, different params | Generate a fresh UUID for the new request |
| Subscription stuck `incomplete` | Customer never confirmed payment | Send them the `latest_invoice.hosted_invoice_url`; confirm within 23 hours |
| `402` on off-session charge | 3DS required | Handle `requires_action` — send `payment_intent.client_secret` to customer |
| Webhook events arriving twice | Stripe retry after timeout | Make handlers idempotent; deduplicate on `event.id` |

---

## Security & compliance

### PCI compliance

Stripe handles PCI scope when you use Stripe.js / Stripe Elements / Payment Element or Checkout Sessions — you never touch raw card numbers. Maintain **SAQ A** compliance:

- Never log, store, or transmit raw card numbers (`number`, `cvc`, full `exp_month`/`exp_year` combination).
- Never accept card data in your own API endpoint — only accept PaymentMethod IDs (`pm_...`) or tokens.
- Serve your payment page over HTTPS.
- If you find card data in logs, rotate the API keys immediately and notify Stripe.

### API key security

- Store keys in environment variables or a secrets manager (AWS Secrets Manager, HashiCorp Vault), never in source code.
- Use **restricted keys** for operations that don't need full access (e.g., a reporting service needs only `Read` on `Charges` and `Invoices`).
- Rotate keys immediately on suspected exposure: Dashboard → API keys → Roll key.
- Use `sk_test_` in all non-production environments — a test key can never trigger live charges.

### Webhook security

- Always verify `Stripe-Signature` before processing any webhook payload.
- Use a **separate webhook signing secret** (`whsec_...`) per endpoint — do not reuse across environments.
- Store the signing secret in environment variables.
- Reject webhooks with a timestamp more than **5 minutes** old to prevent replay attacks (the SDK does this by default with a 300-second tolerance).

### Stripe Connect — platform responsibilities

- Use the minimum Connect account type needed (Express > Standard > Custom — lower customisation = lower compliance burden).
- Platforms are responsible for complying with KYC/AML requirements for their connected accounts.
- Never display the connected account's full bank account or SSN to end users.

### Audit trail

Every API action is logged in **Dashboard → Developers → Logs** (7-day retention for all accounts; extended with Sigma). Use `metadata` to attach your internal IDs for easier cross-referencing.

---

## Testing checklist

Use sandbox keys (`sk_test_`, `pk_test_`) and the test card numbers below. No real money moves.

### Test card numbers

| Scenario | Card number | Expiry | CVC |
|----------|-------------|--------|-----|
| Payment succeeds | `4242 4242 4242 4242` | Any future | Any 3 digits |
| Payment declined (generic) | `4000 0000 0000 0002` | Any future | Any 3 digits |
| Insufficient funds | `4000 0000 0000 9995` | Any future | Any 3 digits |
| 3D Secure required | `4000 0025 0000 3155` | Any future | Any 3 digits |
| 3D Secure 2 — frictionless pass | `4000 0000 0000 3220` | Any future | Any 3 digits |
| Card expired | `4000 0000 0000 0069` | Any future | Any 3 digits |
| Incorrect CVC | `4000 0000 0000 0101` | Any future | Any 3 digits |
| Mastercard success | `5555 5555 5555 4444` | Any future | Any 3 digits |

### Trigger test webhook events (Stripe CLI)

```bash
# Install: brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:8000/stripe/webhook

# In a separate terminal:
stripe trigger payment_intent.succeeded
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
stripe trigger checkout.session.completed
```

### QA checklist

- [ ] PaymentIntent created in sandbox; `client_secret` returned
- [ ] Test card `4242...` → PaymentIntent reaches `succeeded`
- [ ] Decline card `4000...0002` → `402` with `card_error`, `decline_code: card_declined`
- [ ] 3DS card `4000...3155` → PaymentIntent reaches `requires_action`; completes after challenge
- [ ] Refund issued on succeeded Charge; `re_...` returned with `status: succeeded`
- [ ] Subscription created with `payment_behavior=default_incomplete`; first invoice payment confirmed
- [ ] `invoice.payment_failed` webhook received and processed without error
- [ ] `cancel_at_period_end=true` sets flag; `customer.subscription.deleted` fires at period end
- [ ] Webhook signature verification passes for valid payload; returns `400` for tampered payload
- [ ] Idempotency key: same request sent twice → identical response, no duplicate charge
- [ ] Pagination loop retrieves all pages (`has_more=false` terminates loop)
- [ ] Rate limit hit in sandbox (25 req/sec); `429` handled with backoff, eventual success

---

## Sources

- [Stripe API Reference](https://docs.stripe.com/api)
- [Authentication & API Keys](https://docs.stripe.com/keys)
- [API Versioning & Changelog](https://docs.stripe.com/changelog)
- [Payment Intents](https://docs.stripe.com/payments/payment-intents)
- [Subscriptions Overview](https://docs.stripe.com/billing/subscriptions/overview)
- [Checkout Sessions](https://docs.stripe.com/payments/checkout)
- [Refunds](https://docs.stripe.com/refunds)
- [Webhook Integration](https://docs.stripe.com/webhooks)
- [Idempotent Requests](https://docs.stripe.com/idempotency)
- [Rate Limits](https://docs.stripe.com/rate-limits)
- [Error Codes](https://docs.stripe.com/error-codes)
- [Stripe Connect](https://docs.stripe.com/connect)
- [Testing](https://docs.stripe.com/testing)
- [Security Best Practices](https://docs.stripe.com/security)
- [API Status](https://status.stripe.com)
