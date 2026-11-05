# OnCred — simulação e encaminhamento

Projeto preparado a pedido do responsável, que informou contratação pela própria OnCred. Razão social e CNPJ conferidos em https://oncred.com.br/doc/privacy. Endereço fornecido pelo responsável. Taxa de referência e limites da calculadora solicitados iguais aos do SANTS: não são validação de oferta ou CET de um produto OnCred.

## Arquitetura

- React/Vite/Tailwind. Simulador PF/PJ com o layout do SANTS e limites de prazo por prestação mínima.
- `/atendente` cria uma chave por novo clique e obtém a atribuição da API. Uma recarga repete a chave, sem avançar novamente a fila. A mensagem fica em sessionStorage por até 30 minutos e é preparada para o WhatsApp; não é armazenada na tabela de encaminhamentos.
- `/painel` usa senha no servidor, sessão de 30 minutos, D1 e contadores compartilhados. Não há atendentes de exemplo nem telefone de fallback inventado.
- Políticas estáticas e modais derivam do mesmo conteúdo em `src/config/legalContent.ts`. O build gera os HTMLs.
- Não há análises fictícias, pré-aprovações, ofertas bancárias fabricadas, coleta de chave Pix ou depoimentos inventados.

## Publicação gratuita com atualização automática

Usar **Cloudflare Pages com integração Git**, não criar primeiro um projeto Direct Upload se o objetivo é a integração nativa. Criar na conta Cloudflare indicada pelo proprietário um projeto ligado a `forteracacambas-cmyk/-OnCred`.

- Branch de produção: `main`, depois de integrar a alteração revisada.
- Comando de build: `npm run build`.
- Diretório de saída: `dist`.
- Node.js: 22.
- Nome sugerido: `oncred-captacao`; domínio gratuito final depende da disponibilidade e do nome confirmado no Pages. Nenhum domínio foi reservado por estes arquivos.
- Cada push na branch de produção dispara o deploy automático na Cloudflare quando a integração estiver conectada.

No AI Studio, usar a conexão GitHub do mesmo repositório. Ao terminar a edição, enviar as alterações pelo painel GitHub. Salvar o projeto ou usar Publish do AI Studio não equivale, por si só, a enviar um commit para a Cloudflare. Antes de alternar de editor, puxar mudanças remotas e resolver diferenças.

Referências: https://developers.cloudflare.com/pages/configuration/git-integration/ e https://aistudio.google.com/docs/aistudio-build-mode.

## Banco e painel independentes

1. Criar um D1 novo, por exemplo `oncred-atendimento`, na conta correta. Não reutilizar o banco nem o segredo do SANTS.
2. Aplicar `migrations/0001_atendimento.sql` uma única vez no banco novo e vazio.
3. Configurar o binding `DB` no Pages para esse banco. O arquivo wrangler não contém ID de banco antigo. Se os bindings forem mantidos por Wrangler, adicionar ao arquivo o ID retornado pela criação do banco antes de publicar e validar esse binding no ambiente de produção.
4. Configurar o segredo `ADMIN_PASSWORD` no servidor; nunca usar prefixo VITE_, colocar no código ou publicar no GitHub.
5. Publicar, entrar em `/painel`, cadastrar os nomes e WhatsApps reais autorizados e definir o lote. Usar 1 para alternar a cada novo clique. As configurações ficam no D1, não no navegador.
6. Evitar vincular previews públicos ao banco de produção. Sem binding DB, a API informa serviço não configurado. O preview Vite/AI Studio não executa Cloudflare D1 automaticamente.

## Medição e campanhas

`VITE_TIKTOK_PIXEL_ID` é opcional e deve ser o pixel correto deste projeto. O pixel do SANTS foi removido. Deixar vazio mantém o atendimento funcionando sem publicidade. Um ID configurado só carrega o pixel depois da escolha explícita de medição; o painel não carrega pixel.

Lead significa entrada válida no atendimento, não mensagem enviada, aprovação ou venda. O evento não recebe explicitamente nome, telefone, valores, parcelas, perfil ou texto. Falhas de rede e bloqueadores podem impedir a recepção; verificar no Test Events antes de usar como conversão de campanha.

A estrutura do site não garante aprovação de anúncios. As condições reais do produto, licenciamento, criativo, público 18+ e configuração da campanha precisam corresponder ao material publicado. A taxa informativa da calculadora não deve substituir o CET real de uma oferta nem ocultar condições de um produto incompatível com a política. Referência: https://ads.tiktok.com/resources/help/article/tiktok-ads-policy-financial-services?lang=pt.

## Verificação e desenvolvimento

`npm install`, `npm test`, `npm run lint`, `npm run build`.

Os testes usam D1 local via Miniflare e dados de teste. Não fazem operações de crédito, enviam WhatsApp ou eventos reais. Para teste completo do servidor, usar Wrangler Pages local com banco de teste e senha de teste em `.dev.vars` (ignorado pelo Git).

As exclusões de atendentes são lógicas. Limpar histórico remove registros e contadores e reinicia o cursor; é uma ação destrutiva protegida pelo login e confirmação na interface. Definir backups e retenção antes de operar com dados reais.

## Estado de entrega

Os arquivos locais não comprovam publicação. É necessário verificar a conta Cloudflare correta, a integração Git, migração/binding, segredo e atendentes antes de considerar o fluxo online concluído.
