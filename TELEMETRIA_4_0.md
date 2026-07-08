# GT7 Telemetria 4.0 — Cockpit Modular

Esta branch contém a versão **Telemetria 4.0** preparada para gerar APK via GitHub Actions.

## O que está nesta branch

- App Android/Web em `www/index.html`.
- Configuração Capacitor em `capacitor.config.ts`.
- Workflow de APK em `.github/workflows/build-apk.yml`.
- Patch Android em `scripts/patch-android-v4.js` para permitir conexão HTTP local com o Raspberry.

## Como gerar o APK

1. Abra o repositório `radfallenn/Telemetria-v.3` no GitHub.
2. Troque para a branch `telemetria-4.0`.
3. Vá em **Actions**.
4. Abra **Build APK Telemetria 4.0**.
5. Clique em **Run workflow**.
6. Escolha a branch `telemetria-4.0`.
7. Quando terminar, baixe o artefato **GT7-Telemetria-V4-debug-apk**.

## Como usar no celular

1. Instale o APK.
2. Abra o app.
3. Em **Bridge URL**, coloque o endereço do Raspberry, por exemplo:

```text
http://192.168.1.50:8787
```

4. Toque em **Conectar**.

## Arquitetura

- O Raspberry continua sendo o servidor principal.
- O Android é apenas painel remoto.
- O app não deve ser a fonte principal das voltas.
- O app mostra dados, controla sessão, salva layout e monitora conexão.

## Observação importante

Esta branch prepara o APK do painel. Para registrar corrida sem depender do celular, o backend V4 precisa estar rodando no Raspberry na porta `8787`.
