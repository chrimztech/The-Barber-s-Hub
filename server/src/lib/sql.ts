/**
 * Shared SQL fragments. Joined rows are returned as nested objects named after the
 * related table (e.g. `services: { name }`) so the storefront can render them directly.
 */
export const nestedName = (alias: string) =>
  `CASE WHEN ${alias}.id IS NULL THEN NULL ELSE json_build_object('name', ${alias}.name) END`;

export const bookingSelect = `
  SELECT b.*,
         CASE WHEN s.id IS NULL THEN NULL
              ELSE json_build_object('name', s.name, 'price', s.price, 'duration', s.duration) END AS services,
         ${nestedName("br")} AS barbers
    FROM bookings b
    LEFT JOIN services s ON s.id = b.service_id
    LEFT JOIN barbers br ON br.id = b.barber_id
`;

export const reviewSelect = `
  SELECT r.*,
         ${nestedName("p")} AS products,
         ${nestedName("s")} AS services
    FROM reviews r
    LEFT JOIN products p ON p.id = r.product_id
    LEFT JOIN services s ON s.id = r.service_id
`;

/** Builds "col = $n" assignments for a partial update. Keys must be trusted column names. */
export function buildUpdate(fields: Record<string, unknown>, startIndex = 1) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  const assignments = entries.map(([column], index) => `${column} = $${index + startIndex}`);
  return { assignments, values: entries.map(([, value]) => value) };
}
