import { expect, it } from "vitest";
import { validateUserAction } from "../../supabase/functions/manage-user/rules";

const admin = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
it("blocks operational users from deleting accounts", () => {
  expect(() => validateUserAction(admin, other, "delete", false)).toThrow("Somente administradores");
});
it("blocks operational users from disabling accounts", () => {
  expect(() => validateUserAction(admin, other, "deactivate", false)).toThrow("Somente administradores");
});
it("blocks self deletion and self deactivation", () => {
  for (const action of ["delete", "deactivate"]) expect(() => validateUserAction(admin, admin, action, true)).toThrow("própria conta");
});
it("allows administrators to manage other users", () => {
  for (const action of ["delete", "deactivate", "reactivate"]) expect(() => validateUserAction(admin, other, action, true)).not.toThrow();
});
it("rejects unknown actions", () => {
  expect(() => validateUserAction(admin, other, "promote", true)).toThrow("Ação inválida");
});