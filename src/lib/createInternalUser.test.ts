import { beforeEach, expect, it, vi } from "vitest";
import { createInternalUser } from "./createInternalUser";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), rpc: vi.fn(), signUp: vi.fn(), createClient: vi.fn(),
  from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: mocks.getUser }, rpc: mocks.rpc, from: mocks.from,
} }));
const values = { displayName: "Pessoa de Teste", email: "test@example.com", password: "test-password", role: "user" as const };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "administrator" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.createClient.mockReturnValue({ auth: { signUp: mocks.signUp } });
  mocks.signUp.mockResolvedValue({ data: { user: { id: "new-user", identities: [{}] }, session: null }, error: null });
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ single: mocks.single });
  mocks.single.mockResolvedValue({ data: { role: "user" }, error: null });
});

it("prevents operational users from initiating account creation", async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  await expect(createInternalUser(values)).rejects.toThrow("Somente administradores");
  expect(mocks.signUp).not.toHaveBeenCalled();
});

it("preserves the administrator session with an isolated non-persistent client", async () => {
  await createInternalUser(values);
  expect(mocks.createClient).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  expect(mocks.signUp).toHaveBeenCalledTimes(1);
});

it("stores operational access as the existing protected user role", async () => {
  const result = await createInternalUser(values);
  expect(mocks.update).toHaveBeenCalledWith({ role: "user" });
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "new-user");
  expect(result.needsConfirmation).toBe(true);
});

it("stores administrator access only in user_roles, not user metadata", async () => {
  await createInternalUser({ ...values, role: "admin" });
  expect(mocks.from).toHaveBeenCalledWith("user_roles");
  expect(mocks.update).toHaveBeenCalledWith({ role: "admin" });
  expect(mocks.signUp.mock.calls[0][0].options.data).toEqual({ display_name: "Pessoa de Teste" });
});

it("does not claim success when role assignment fails", async () => {
  mocks.single.mockResolvedValue({ data: null, error: { message: "permission denied" } });
  await expect(createInternalUser(values)).rejects.toThrow("o acesso não foi definido");
});