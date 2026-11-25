# Configurações — criação de usuários
- [x] Adicionar Configurações e centralizar o formulário de criação.
- [x] Preservar a sessão atual e os acessos existentes.
- [x] Testar regras e verificar a tela autenticada em computador e celular com conta temporária; envio de conta existente validado, sem criar conta permanente.

# Selected security findings
- [x] Restrict clients, monthly data, and profile reads to approved internal accounts while preserving existing staff access.
- [x] Ensure administrator creation and promotion explicitly grant internal approval.
- [x] Test approved and unapproved access and recheck the three selected findings; live reads, writes, self-approval denial, and operational restrictions verified; temporary data removed.
- [x] Mark only the three selected findings fixed; one unrelated password warning left unchanged.

# Gerenciamento de usuários
- [x] Adicionar desativação, reativação e exclusão confirmadas para administradores.
- [x] Bloquear acessos de contas desativadas e preservar dados vinculados ao excluir.
- [x] Testar permissões e o fluxo autenticado na tela de Usuários; desativação, reativação, exclusão, bloqueio de histórico, operacional e celular verificados com contas descartáveis.

# Organização de Configurações
- [x] Agrupar Usuários e Clientes em Configurações, preservando rotas e permissões.
- [x] Verificar navegação autenticada entre as três telas e apresentação no celular.

# Erro ao criar usuários
- [x] Identificar recusa de senha fraca nos registros e explicar o motivo no cadastro, login/cadastro e recuperação.
- [x] Verificar a mensagem com cadastro autenticado e testar sem desativar a proteção; senha recusada corretamente e sessão do administrador preservada.