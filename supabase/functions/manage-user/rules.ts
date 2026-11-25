export type UserAction = "deactivate" | "reactivate" | "delete";

export function validateUserAction(callerId: string, targetId: string, action: unknown, administrator: boolean) {
  if (!administrator) throw new Error("Somente administradores podem gerenciar usuários.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) throw new Error("Usuário inválido.");
  if (!["deactivate", "reactivate", "delete"].includes(String(action))) throw new Error("Ação inválida.");
  if (callerId === targetId) throw new Error("Você não pode desativar ou excluir a própria conta.");
}