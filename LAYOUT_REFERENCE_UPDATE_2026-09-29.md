# AVERON — atualização visual de 29/09/2026

Implementação baseada no PDF de layout e nas quatro referências de Search, Wishlist, Bag e Profile.

## Alterações

- cabeçalho desktop reorganizado com **Menu** e **Search** no lado esquerdo;
- hierarquia editorial da homepage refinada, com títulos em caixa alta e divisores dourados;
- categorias com etiquetas brancas, texto em caixa alta e seta;
- drawers de busca, perfil, favoritos e carrinho alinhados às referências;
- login sem repetição do título dentro do formulário;
- estado vazio do carrinho ancorado na parte inferior;
- selo promocional calculado por `((preço anterior - preço atual) / preço anterior) × 100`;
- selo exibido como seta para baixo e porcentagem, sem o texto “OFF”;
- preço anterior riscado exibido ao lado do preço atual nos cards;
- ajustes responsivos para desktop, tablet e celular.
- linhas douradas dimensionadas pela largura de cada título serifado;
- tópicos editoriais ampliados e linhas laterais levemente reforçadas;
- composição da filosofia fixada nas mesmas quatro linhas do PDF;
- cabeçalho refinado com ícones em cinza-escuro e logo central em azul;
- contador da sacola visível inclusive no estado vazio (`0`).

## Validação

- `npm test`: 101 testes aprovados;
- `npm run build`: concluído;
- páginas públicas reconstruídas a partir dos arquivos-fonte.
