# AVERON — atualização de segurança

25/09/2026. Base: AVERON - Copia.zip.

## O que foi corrigido

- O servidor entrega apenas os arquivos da pasta `public/`, criada por uma lista explícita. Backend, dependências, banco, configuração e testes ficam fora da área pública. URLs codificadas também foram testadas.
- Consultas de compra, rastreamento e solicitação de reembolso exigem login e conferem o ID do dono do pedido. Saber o ID Stripe e o email não autoriza o acesso.
- Reembolsos deixam de acontecer automaticamente na solicitação: entram para aprovação no Content Studio → Orders. O painel pede confirmação de resolução com o fornecedor. Processamento CJ em andamento/interrompido bloqueia aprovação até reconciliação.
- Uma fila SQLite persistente agenda a CJ. Eventos Stripe repetidos não recriam a tarefa. Uma alteração atômica permite somente um processamento por tarefa.
- Respostas incertas da CJ não são repetidas automaticamente: ficam para conferência. Pendências ainda não iniciadas sobrevivem ao reinício e voltam a ser processadas quando as integrações correspondentes estiverem habilitadas.
- Tamanho e cor precisam corresponder exatamente a uma opção habilitada. SKU/VID/logística são gravados nos metadados criados pelo servidor na Stripe e recuperados no pedido; mudanças posteriores no catálogo não trocam o produto vendido.
- API pública não entrega PID, VID, SKU ou configuração logística. O painel continua usando um endpoint autenticado com os dados completos. Nomes de cores/tamanhos permanecem públicos para montar os seletores.
- Checkout usa preço do servidor e chave de idempotência por tentativa para proteger reenvios.
- Limite de corpo pequeno nas rotas comuns, autenticação antes de aceitar imagens grandes do administrador, limite de requisições, CSP HTTP, origem fixa e respostas privadas sem cache.
- Eventos de atualização/falha de reembolso atualizam o pedido. Reembolsos parciais são distinguidos do total.
- Dados editáveis podem ficar em `AVERON_DATA_DIR`, fora dos arquivos substituídos a cada deploy.

## Duas mudanças visíveis

1. **Quick Add** abre a página do produto para escolher tamanho e cor. Antes adicionava sempre Navy / M, mesmo em produtos sem essa combinação.
2. **Request refund** registra a solicitação; você aprova no painel depois de verificar o fornecedor. O botão não devolve dinheiro sozinho.

## Como atualizar sem perder dados

1. Faça uma cópia de segurança da pasta atual e pare o servidor.
2. Preserve seu `.env` real, o banco `averon-orders.db` e os arquivos `averon-orders.db-wal` / `averon-orders.db-shm`, se existirem. Este ZIP NÃO inclui credenciais nem sessões/banco anteriores.
3. Extraia a pasta AVERON inteira. Não copie apenas os HTMLs. Se o catálogo ou os banners foram alterados depois do ZIP analisado, preserve também seus JSONs mais recentes antes de substituir a pasta.
4. Use Node.js 24 ou superior. Dentro da pasta execute:

```sh
npm ci
npm start
```

O `npm start` monta `public/` antes de iniciar o backend. O ZIP inclui uma cópia pronta dessa pasta, mas a fonte continua nos arquivos da raiz. Após editar um HTML/JS/CSS, execute `npm run build` ou reinicie com `npm start`.

5. Para testar localmente, mantenha `NODE_ENV=development` e `SITE_URL=http://localhost:4242` (ou sua porta). Acesse o site pelo servidor, não por duplo clique no HTML.
6. Para publicar, use hospedagem que execute Node, HTTPS e armazenamento persistente. O endereço público deve apontar para o serviço Node; nunca exponha a raiz do projeto como uma pasta estática.

## Configuração de produção

- `NODE_ENV=production`
- `SITE_URL=https://seu-dominio` (origem canônica, sem caminho)
- Chaves Stripe, Supabase e administrador válidas no ambiente privado, conforme `.env.example`.
- `AVERON_DATA_DIR`: pasta privada em volume persistente, fora de `public/` e `assets/`. É recomendada em produção. Na primeira inicialização, os JSONs são copiados do pacote somente se ainda não existirem nessa pasta.
- `AVERON_DB_PATH`: opcional; quando vazio, o banco fica dentro de `AVERON_DATA_DIR`. Se mover uma instalação existente para outro diretório, transfira o banco e seus arquivos WAL/SHM com o servidor parado, além dos quatro JSONs editáveis: products.server.json, cj-sandbox-map.json, site-content.server.json e site-layout.server.json.
- `TRUST_PROXY_HOPS`: padrão 0. Ajuste SOMENTE para o número exato de proxies confiáveis da hospedagem. A porta Node não deve aceitar acesso público que contorne esses proxies. Isso evita que todos os visitantes compartilhem indevidamente o mesmo limite de requisições.
- `CJ_LIVE_AUTOMATION` e `CJ_AUTO_PAY_BALANCE` continuam desativados por padrão. Não ativam sozinhos neste pacote. Pagamento do fornecedor continua separado do recebimento Stripe.

## Stripe: eventos do webhook

Use `/webhook`, com o segredo correspondente ao endpoint e ao modo teste/real. Configure:

- checkout.session.completed
- checkout.session.async_payment_succeeded
- checkout.session.async_payment_failed
- refund.created
- refund.updated
- refund.failed

A assinatura continua sendo validada sobre o corpo bruto. Não use as chaves de teste dos arquivos de testes: são fixtures sem validade e só funcionam no processo isolado da suíte.

## Se aparecer “Reconcile CJ” no painel

1. Confira no painel CJ o número do pedido AVERON e se houve cobrança/criação. Um timeout NÃO prova que a CJ não criou o pedido.
2. Se existir, informe o ID do pedido CJ para vinculá-lo, evitando uma segunda criação.
3. Digite `NONE` somente se tiver confirmado que nenhum pedido existe. Isso permite retomar a tarefa quando ela não está retida por reembolso/cancelamento.
4. Uma tarefa interrompida em “running” só pode ser reconciliada após 15 minutos. Uma tarefa em “review” pode ser conferida imediatamente.
5. Para reembolsar um pedido já enviado à CJ, resolva cancelamento/devolução com o fornecedor e só então confirme a aprovação Stripe. Essa confirmação é operacional; o site não cancela automaticamente um pedido na CJ.

Pedidos antigos sem a variante congelada são retidos para conferência; o sistema não escolhe uma variante qualquer como substituta. Reembolso falho deve ser conferido no Stripe antes de nova tentativa. O fluxo de aprovação é de reembolso integral; para reembolso parcial, use o painel Stripe e confira a sincronização do evento.

## Testes e limites

Resultado nesta entrega: 97 testes aprovados, mais verificações HTTP com NODE_ENV=production.

A suíte inclui testes HTTP de URLs codificadas, autenticação, separação entre duas contas, preço e variante, idempotência, repetição de eventos, retomada após reinício, falha incerta do fornecedor, reconciliação e reembolsos. Stripe, CJ e Supabase foram simulados em processo isolado; nenhuma cobrança, reembolso ou encomenda real foi realizada.

Execute `npm test` para repetir os testes. Uma aprovação local não substitui validar no ambiente de hospedagem: HTTPS, proxy, persistência, URLs Supabase, entrega de webhooks, pagamento de teste/3DS, rejeição de cartão, logística CJ e backup/restauração.

Ainda precisam de definição operacional: dados empresariais das políticas, domínio definitivo, fretes/prazos reais (a opção Express no checkout não muda automaticamente a logística CJ), configuração fiscal, sitemap e alertas de operação. O pacote não certifica segurança absoluta nem valida a conta de recebimento bancário.

As instruções deste arquivo substituem notas antigas do pacote sobre publicação estática, admin apenas local e reembolso automático.
