-- has_role() is called inside "status = 'active' OR has_role(...)" USING clauses
-- on every public-read policy (services, products, categories, barbers). Postgres
-- requires EXECUTE on every function referenced in a policy expression regardless
-- of short-circuiting, so anon needs this grant too or public browsing 401s outright.
-- Safe to grant: has_role() only returns a boolean and auth.uid() is NULL for anon,
-- so it just evaluates to false for anonymous callers.
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO anon;
