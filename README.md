# GT7 Telemetria 4.0

Sistema de telemetria para Gran Turismo 7 com Raspberry como Bridge principal e Android como painel remoto.

## Versão atual da branch telemetria-4.0

- Interface refeita no visual do arquivo anexado Stitch/Apex Telemetry System.
- Bridge Raspberry incluído em `bridge/server.cjs`.
- APK com tela sempre ativa.
- Android liberado para conexão HTTP local.
- Configuração do IP do PS5 feita pelo app e salva no Raspberry.

## Rodar no Raspberry

```bash
git checkout telemetria-4.0
cp .env.example .env
nano .env
npm install
npm start
```

Teste:

```text
http://IP_DO_RASPBERRY:8787/api/health
```

## Gerar APK

No GitHub, abra **Actions > Build APK Telemetria 4.0 > Run workflow** usando a branch `telemetria-4.0`.
