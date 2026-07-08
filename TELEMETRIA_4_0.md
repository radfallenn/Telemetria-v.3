# GT7 Telemetria 4.0 — Correção Stitch / Raspberry / PS5

Esta branch contém a versão **Telemetria 4.0** preparada para gerar APK e para rodar o Bridge no Raspberry.

## Correções desta revisão

- Interface refeita seguindo o arquivo anexado `stitch_gt7_telemetry_modular_cockpit.zip` e o `DESIGN.md` Apex Telemetry System.
- Visual preto/grafite, dados mono, cyan para aceleração/estado, vermelho para freio/erro e amarelo para RPM/UDM.
- APK mantém a tela do celular sempre ativa usando Wake Lock no WebView e `FLAG_KEEP_SCREEN_ON` no Android nativo.
- Android liberado para HTTP local, necessário para `http://IP_DO_RASPBERRY:8787`.
- App agora tem tela SET com Bridge URL, IP do PS5, salvar configuração no Raspberry, iniciar seção, salvar seção e zerar tudo.
- Repositório agora inclui Bridge real do Raspberry em `bridge/server.cjs`.
- Bridge envia heartbeat para o PS5 na porta `33739` e escuta UDP do GT7 na porta `33740`.

## Como gerar o APK

1. Abra o repositório `radfallenn/Telemetria-v.3` no GitHub.
2. Troque para a branch `telemetria-4.0`.
3. Vá em **Actions**.
4. Abra **Build APK Telemetria 4.0**.
5. Clique em **Run workflow**.
6. Escolha a branch `telemetria-4.0`.
7. Baixe o artefato **GT7-Telemetria-V4-debug-apk**.

## Como rodar o Bridge no Raspberry

```bash
cd ~/Telemetria-v.3
git fetch
git checkout telemetria-4.0
cp .env.example .env
nano .env
npm install
npm start
```

Ou como serviço:

```bash
bash bridge/install-raspberry.sh
```

Teste no navegador ou no celular:

```text
http://IP_DO_RASPBERRY:8787/api/health
```

## Como conectar no app

No app, abra **SET** e preencha:

```text
Bridge URL: http://IP_DO_RASPBERRY:8787
IP do PS5: IP_DO_PS5
```

Toque em **CONECTAR AO RASPBERRY** e depois em **SALVAR CONFIG NO RASPBERRY**.

O PS5 não conecta direto ao Android. Quem conecta ao PS5 é o Raspberry. O Android apenas conversa com o Raspberry.
