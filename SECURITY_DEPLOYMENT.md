# Segurança de publicação

A fonte operacional atual é LEIA_PRIMEIRO_CORRECOES.md.

- Não disponibilizar a raiz do projeto pelo servidor web. Servir o serviço Node; os arquivos estáticos vêm exclusivamente de public/.
- Manter .env, banco e JSONs operacionais privados. Não colocar AVERON_DATA_DIR nem AVERON_DB_PATH em public/ ou assets/.
- Definir SITE_URL HTTPS e NODE_ENV=production; configurar proxy confiável e volume persistente.
- Proteger conta administrativa, Stripe, Supabase e CJ com credenciais individuais fortes e proteções disponíveis nesses serviços.
- Testar isolamento de contas, webhooks, reembolso, falhas do fornecedor e recuperação antes de vendas reais.
- As tarefas de envio são persistentes; resultados incertos exigem conferência, nunca reenvio cego.
- Fazer backups e testar restauração com a aplicação parada ou mecanismo apropriado ao SQLite/WAL.
