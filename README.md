# GT7 Telemetria V4 Clean

Sistema de telemetria para Gran Turismo 7 com Raspberry como Bridge principal e Android como painel remoto.

## Separação correta das versões

- **V3**: referência antiga. Não usar para build novo.
- **V4 Clean**: versão oficial atual da telemetria GT7.
- **Servidor de teste**: não faz parte da V4 Clean e deve ficar parado/removido.
- **Meu Dia Pro**: continua usando a porta `8787`.
- **GT7 Telemetria V4 Clean**: usa a porta `8788`.

## Portas oficiais

- Meu Dia Pro HTTP: `8787`
- GT7 Telemetria HTTP: `8788`
- GT7 UDP recebido do PS5: `33740`
- Heartbeat enviado ao PS5: `33739`

## Regra principal

O fluxo correto é:

```text
PS5 / GT7 -> UDP 33740 -> Raspberry Bridge V4 -> HTTP 8788 -> APK Android
```

O Android não calcula corrida e não registra volta como fonte principal.

## Limpar mistura V3/V4/teste no Raspberry

Na pasta do projeto, rode:

```bash
cd ~/telemetria-v3
bash scripts/reset-telemetria-v4-clean.sh
```

Opcional, informando IP real do PS5:

```bash
cd ~/telemetria-v3
PS5_IP=192.168.1.71 PORT=8788 bash scripts/reset-telemetria-v4-clean.sh
```

Esse script para servidor de teste, remove serviço antigo, grava `.env` limpo, instala dependências e sobe `gt7-telemetria-v4.service` na porta `8788`.

## Testes

```bash
curl http://localhost:8788/api/health
curl http://localhost:8788/api/live
curl http://localhost:8788/api/fields
```

No celular/APK:

```text
http://IP_DO_RASPBERRY:8788
```

## APK

No GitHub, abra:

```text
Actions -> Build APK Telemetria 4.0 -> Run workflow
```

Branch:

```text
telemetria-4.0
```

Artefato:

```text
GT7-Telemetria-V4-8788-debug-apk
```
