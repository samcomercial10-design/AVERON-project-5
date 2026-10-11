# Produção AVERON

Consulte LEIA_PRIMEIRO_CORRECOES.md para a configuração atual, migração e limitações.

Este projeto usa backend Node.js >=24, SQLite, Stripe e Supabase. Precisa de processo Node permanente, HTTPS e volume persistente. Hospedagem apenas estática não executa o checkout nem a autenticação.

Instalação: `npm ci`. Inicialização: `npm start` (inclui geração de public/).

Use `NODE_ENV=production`, `AVERON_DEPLOY_MODE=production`, SITE_URL HTTPS e AVERON_DATA_DIR privado/persistente. Preserve o banco e o conteúdo editável em cada deploy. Nunca exponha a raiz do projeto pelo servidor web. O proxy deve encaminhar o tráfego para o serviço Node.

`/readyz` em produção exige configuração de pagamentos, webhook, autenticação e banco. Isso verifica configuração e acesso local ao banco; não confirma credenciais remotamente nem substitui teste de compra.

## Preparação automática adicionada para publicação

- `npm run production:check` valida os itens críticos do ambiente antes de abrir vendas.
- `npm run build` gera `public/robots.txt` e `public/sitemap.xml` automaticamente a partir de `SITE_URL`; não é necessário editar o domínio no código.
- Os dados jurídicos podem ser definidos por `AVERON_LEGAL_NAME`, `AVERON_BUSINESS_ADDRESS`, `AVERON_PRIVACY_EMAIL`, `AVERON_CUSTOMER_SERVICE_EMAIL` e `AVERON_RETURNS_EMAIL`. O build injeta esses valores somente na cópia pública gerada, mantendo os arquivos-fonte reutilizáveis.
- Em `AVERON_DEPLOY_MODE=production`, `AVERON_DATA_DIR` é obrigatório. Em deploys de teste, use `AVERON_DEPLOY_MODE=test` para permitir armazenamento temporário/efêmero. Use um volume privado e persistente, fora de `public/` e fora dos assets, antes de abrir vendas reais.
- Não envie um banco SQLite local/teste junto com uma nova instalação de produção. Preserve/migre apenas o banco do volume persistente quando já houver pedidos reais.
