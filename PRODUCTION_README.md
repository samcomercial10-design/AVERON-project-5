# Produção AVERON

Consulte LEIA_PRIMEIRO_CORRECOES.md para a configuração atual, migração e limitações.

Este projeto usa backend Node.js >=24, SQLite, Stripe e Supabase. Precisa de processo Node permanente, HTTPS e volume persistente. Hospedagem apenas estática não executa o checkout nem a autenticação.

Instalação: `npm ci`. Inicialização: `npm start` (inclui geração de public/).

Use `NODE_ENV=production`, SITE_URL HTTPS e AVERON_DATA_DIR privado/persistente. Preserve o banco e o conteúdo editável em cada deploy. Nunca exponha a raiz do projeto pelo servidor web. O proxy deve encaminhar o tráfego para o serviço Node.

`/readyz` em produção exige configuração de pagamentos, webhook, autenticação e banco. Isso verifica configuração e acesso local ao banco; não confirma credenciais remotamente nem substitui teste de compra.
