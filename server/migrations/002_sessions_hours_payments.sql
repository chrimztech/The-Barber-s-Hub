-- Session revocation: tokens carry the user's token_version; bumping it signs out
-- every existing session (password change, password reset, suspension).
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

-- Google sign-in: accounts created through Google have no password until they set one.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;

-- Customers can record the mobile money / bank transfer reference for an order.
ALTER TABLE orders ADD COLUMN payment_reference TEXT;

-- Structured opening hours used to validate bookings (times are studio-local).
INSERT INTO settings (key, value) VALUES
  (
    'booking',
    '{"slot_minutes":60,"hours":{"mon":null,"tue":{"open":"09:00","close":"20:00"},"wed":{"open":"09:00","close":"20:00"},"thu":{"open":"09:00","close":"20:00"},"fri":{"open":"09:00","close":"20:00"},"sat":{"open":"09:00","close":"20:00"},"sun":{"open":"10:00","close":"16:00"}}}'::jsonb
  ),
  (
    'payments',
    '{"mobile_money_number":"+260979011711","mobile_money_name":"Deepcuts Hair Studio","bank_details":""}'::jsonb
  )
ON CONFLICT (key) DO NOTHING;
