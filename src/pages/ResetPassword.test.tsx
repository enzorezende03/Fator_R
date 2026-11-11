import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import ResetPassword from "./ResetPassword";

const auth = vi.hoisted(() => ({
  getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); window.location.hash = ""; });

it("does not allow an ordinary signed-in session to reset a password", async () => {
  auth.getUser.mockResolvedValue({ data: { user: { id: "existing-user" } }, error: null });
  render(<MemoryRouter><ResetPassword /></MemoryRouter>);
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
  expect(auth.updateUser).not.toHaveBeenCalled();
});

it("updates the password from a verified recovery link without current_password", async () => {
  window.location.hash = "type=recovery";
  auth.getUser.mockResolvedValue({ data: { user: { id: "recovery-user" } }, error: null });
  auth.updateUser.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
  render(<MemoryRouter><ResetPassword /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText("Nova senha"), { target: { value: "New-test-password-123" } });
  fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "New-test-password-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
  await waitFor(() => expect(auth.updateUser).toHaveBeenCalledWith({ password: "New-test-password-123" }));
  expect(auth.signOut).toHaveBeenCalled();
});