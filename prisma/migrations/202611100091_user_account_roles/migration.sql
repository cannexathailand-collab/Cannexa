ALTER TABLE "UserAccount"
  DROP CONSTRAINT "UserAccount_role_check",
  DROP CONSTRAINT "UserAccount_check",
  ADD CONSTRAINT "UserAccount_role_check"
    CHECK ("role" IN ('owner', 'admin', 'manager', 'viewer', 'employee', 'sales', 'store')),
  ADD CONSTRAINT "UserAccount_check"
    CHECK (("role" IN ('employee', 'sales')) = ("affiliateId" IS NOT NULL));
