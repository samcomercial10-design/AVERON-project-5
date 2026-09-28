# Reembolsos — fluxo atual

O cliente autenticado solicita reembolso apenas do próprio pedido. A solicitação retém novas tarefas de envio e não chama Stripe automaticamente.

Em Content Studio → Orders, o administrador revisa e escolhe Approve Refund. Quando há pedido CJ ou resultado incerto, a API exige confirmação explícita da resolução com o fornecedor. Tarefas em processamento ou interrompidas precisam ser reconciliadas antes da aprovação.

A aprovação envia o reembolso integral à Stripe com chave de idempotência. Eventos refund.created/refund.updated/refund.failed sincronizam a situação. Falhas exigem conferência no Stripe; reembolsos parciais são feitos no painel Stripe. Não há cancelamento automático do fornecedor nesta versão.

Consulte LEIA_PRIMEIRO_CORRECOES.md para reconciliação CJ, configuração de webhook e migração.
