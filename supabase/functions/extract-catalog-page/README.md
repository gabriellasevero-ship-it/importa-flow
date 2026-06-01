# extract-catalog-page

Edge Function que extrai os produtos de uma página de catálogo usando IA de visão
(Google Gemini, família Flash). Por padrão tenta `gemini-2.5-flash` e, se indisponível
para a chave (404), cai para `gemini-flash-latest` e depois `gemini-2.0-flash`. Para
forçar um modelo específico, defina o segredo `GEMINI_MODEL`. Recebe a imagem
renderizada da página + o texto nativo do
PDF e devolve, por produto, os campos estruturados (código/REF, título, detalhes,
preço, quantidade por caixa, dimensões, material, categoria) e a bounding box da foto
(em frações 0–1 da página) usada para recortar a imagem no cliente.

## Pré-requisitos

1. Criar uma chave de API no Google AI Studio: https://aistudio.google.com/app/apikey
2. Definir o segredo no projeto Supabase:

   ```bash
   supabase secrets set GEMINI_API_KEY=sua_chave_aqui
   ```

   `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente no
   runtime das Edge Functions.

3. (Opcional) Forçar um modelo específico:

   ```bash
   supabase secrets set GEMINI_MODEL=gemini-2.5-flash
   ```

   Para listar os modelos que sua chave acessa:

   ```bash
   curl "https://generativelanguage.googleapis.com/v1beta/models?key=SUA_CHAVE" \
     | grep -o '"name": "models/[^"]*"'
   ```

## Deploy

```bash
supabase functions deploy extract-catalog-page
```

## Acesso

- A função exige um JWT de usuário com `role` `admin` ou `backoffice` (validado via
  tabela `profiles`), igual à função `invite-representative`.
- O front-end chama via proxy same-origin `/api/extract-catalog-page`
  (Vercel em produção, proxy do Vite em desenvolvimento) para evitar problemas de
  CORS/bloqueadores ao acessar `*.supabase.co` diretamente.

## Fallback

Se a função estiver indisponível (sem `GEMINI_API_KEY`, sem sessão ou erro de rede),
o cliente cai automaticamente no método heurístico anterior (texto do PDF/OCR +
geometria), de modo que o upload de catálogo continua funcionando.
