DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('ALTER TABLE %I."Customer" ADD COLUMN "profileResetAt" TIMESTAMP(3)',target);
  EXECUTE format('ALTER TABLE %I."Customer" ADD COLUMN "registeredAt" TIMESTAMP(3)',target);
  EXECUTE format('UPDATE %I."Customer" SET "registeredAt"="createdAt" WHERE "portalRegistrationPending"=false AND "portalProfileIncomplete"=false',target);
 END LOOP;
END $$;
