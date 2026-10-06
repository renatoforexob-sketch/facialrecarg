# Recarga Fácil — Vercel com layout original

Este pacote preserva as páginas HTML originais, incluindo textos, estilos, scripts, imagens, banners e links. A adaptação feita foi somente de infraestrutura:

- As páginas originais ficam em `public/legacy/` e são entregues sem redesenho.
- As imagens continuam em `public/assets/images/` com os mesmos nomes.
- A Vercel redireciona cada URL para o HTML original correspondente.
- `api_pix.php` foi substituído por `api/pix.js`.
- A consulta de status do pagamento foi movida para `api/status.js`, para não expor a chave no navegador.

## Rotas preservadas

`/`, `/recarga-algar.html`, `/recarga-claro.html`, `/recarga-correios.html`, `/recarga-surf.html`, `/recarga-tim.html`, `/recarga-vivo.html`, `/pagamento.html`, `/app.html`, `/app1.html` e `/app2.html`. As versões sem `.html` também funcionam.

## Deploy na Vercel

Configure estas variáveis no projeto Vercel:

```env
BLACKCAT_API_KEY=sua_chave_privada
BLACKCAT_API_URL=https://api.blackcatoficial.com/api/sales/create-sale
BLACKCAT_STATUS_URL=https://api.blackcatpay.com.br/api/sales
BLACKCAT_CLIENT_NAME=Recarga Fácil
BLACKCAT_CLIENT_EMAIL=contato@recargatodahora.online
BLACKCAT_CLIENT_DOCUMENT=seu_documento
BLACKCAT_POSTBACK_URL=https://seu-dominio.com/webhook.php
```

A chave não está no HTML, no JavaScript público nem no ZIP distribuível. A chave que estava no arquivo original deve ser revogada e substituída, pois foi exposta no upload inicial.

## Validação

```bash
npm install
npm run build
```
