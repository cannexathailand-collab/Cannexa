import {test} from "node:test";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {deleteEmployee} from "../src/lib/delete-employee";

test("employee deletion only removes employee login and audits once across retries", async t => {
 const original = db.$transaction;
 t.after(() => { db.$transaction = original; });
 let exists = true;
 const audits: unknown[] = [];
 db.$transaction = (async (fn: (tx: unknown) => unknown) => fn({
  userAccount: {deleteMany: async ({where}: {where: unknown}) => {
   assert.deepEqual(where, {username: "staff", role: "employee"});
   const count = Number(exists);
   exists = false;
   return {count};
  }},
  auditLog: {create: async (entry: unknown) => { audits.push(entry); }},
 })) as typeof original;
 await deleteEmployee("staff", "owner");
 await deleteEmployee("staff", "owner");
 assert.equal(audits.length, 1);
 assert.equal(exists, false);
});

test("employee deletion rejects owner, self, and invalid identifiers before database writes", async () => {
 for (const username of ["owner", "invalid name", "x", "admin"]) {
  await assert.rejects(deleteEmployee(username, username === "admin" ? "admin" : "owner"));
 }
});
