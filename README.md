# Cocamar — Operação com Produtos

Portal interno de ferramentas para arquivos. A primeira versão inclui compressão de PDF e conversão entre PDF e Word.

## Funcionalidades

- Compressão de PDF em três níveis de qualidade
- Conversão de Word (`.docx`) para PDF com LibreOffice
- Conversão editável de PDF para Word (`.docx`)
- Limite configurável de upload (100 MB por padrão)
- Arquivos temporários removidos ao final de cada solicitação

> A conversão de PDF para Word prioriza conteúdo editável. PDFs com diagramação complexa podem exigir pequenos ajustes de layout no Word.

## Executar localmente com Docker

```bash
docker build -t cocamar-operacao-produtos .
docker run --rm -p 3000:3000 cocamar-operacao-produtos
```
 
Acesse `http://localhost:3000`.

## Executar localmente sem Docker

Requisitos:

- Node.js 18 ou superior
- Ghostscript
- LibreOffice
- Python 3 com `pdf2docx` (`py -m pip install pdf2docx`)

```bash
npm install
npm start
```

No Windows, se necessário, defina o caminho do Ghostscript:

```powershell
$env:GS_COMMAND = "C:\Program Files\gs\gs10.08.0\bin\gswin64c.exe"
npm start
```

## Publicar gratuitamente no Render

O arquivo `render.yaml` já configura o projeto como **Web Service**, usando Docker, plano **Free** e o health check `/api/health`.

1. Crie um repositório no GitHub e envie estes arquivos.
2. No Render, clique em **New → Blueprint** e conecte o repositório.
3. Confirme o serviço `cocamar-operacao-produtos` no plano **Free**.
4. Clique em **Apply** e aguarde o deploy.

O plano gratuito entra em repouso após um período sem acessos, portanto o primeiro uso posterior pode demorar alguns segundos. Não adicione cartão se a exigência for não haver cobrança: ao atingir limites, o Render desativa o serviço em vez de cobrar.

## Configurações

- `PORT`: porta HTTP, padrão `3000`.
- `MAX_FILE_SIZE_MB`: limite de upload, padrão `100`.
- `GS_COMMAND`: comando ou caminho completo para o Ghostscript.
- `LIBREOFFICE_COMMAND`: comando ou caminho completo para o LibreOffice.

## Testes

```bash
npm test
```

## Licença do Ghostscript

Ghostscript usa AGPL ou licença comercial. Antes de disponibilizar o serviço para terceiros ou como SaaS, valide a licença aplicável com a Cocamar e a Artifex.
