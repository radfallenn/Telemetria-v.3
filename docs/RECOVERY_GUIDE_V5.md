# Guia de recuperação — Telemetria V5

Use este arquivo quando o APK deixar de conectar, o layout quebrar ou o build falhar.

## 1. Confirmar a versão correta

A referência funcional é:

- Commit: `e96583aa1be1b31300f95cfd2c9249571c00e8b0`
- Branch: `restore/telemetria-v5-perfect-2026-07-30`

Antes de corrigir qualquer erro, compare a branch atual com esse ponto.

```bash
git fetch origin
git diff origin/restore/telemetria-v5-perfect-2026-07-30...origin/telemetria-v5
```

## 2. Verificar a Bridge no Raspberry

Abra no navegador:

```text
http://IP_DO_RASPBERRY:8790/api/health
```

A resposta correta deve informar:

- `ok: true`
- `udpBound: true`
- IP correto do PS5
- porta HTTP `8790`

Durante o GT7 em pista, `telemetryReceiving` deve ficar `true` e `packetRate` deve ser maior que zero.

## 3. Verificar as portas

- HTTP da Bridge: `8790`
- Heartbeat enviado ao PS5: `33739`
- Pacotes UDP recebidos do GT7: `33740`

Não trocar as portas `33739` e `33740`; elas fazem parte do protocolo do GT7.

## 4. Verificar a configuração no APK

Na aba `SET`:

1. Informe a URL completa da Bridge, por exemplo `http://192.168.1.70:8790`.
2. Informe o IP real do PS5.
3. Toque em `TESTAR BRIDGE`.
4. Toque em `SALVAR E CONECTAR`.
5. Caso a Bridge esteja online sem dados, toque em `REINICIAR RECEPÇÃO UDP`.

## 5. Limpar somente configurações locais quebradas

No Android, limpe os dados do aplicativo apenas quando URL, IP ou posições dos cartões ficarem corrompidos.

Chaves locais usadas pelo app:

- `gt7_telemetria_next_network_v1`
- `gt7_v5_valid_laps_v2`
- `gt7_v5_card_layout_v1`

A limpeza remove preferências locais, mas não altera a Bridge no Raspberry.

## 6. Verificar o Tempo Total

A regra obrigatória é:

```text
Tempo Total = soma dos tempos de todas as voltas válidas concluídas
```

Não entram no cálculo:

- volta atual;
- voltas inválidas;
- tempo parado;
- tempo desde a abertura do APK;
- tempos duplicados.

## 7. Verificar o layout

Todos os cartões das páginas com `.data-card` devem receber quatro botões:

- cima;
- esquerda;
- direita;
- baixo.

A ordem deve ser persistida em `gt7_v5_card_layout_v1`.

## 8. Validar os arquivos antes do build

Na raiz do projeto:

```bash
node scripts/verify-v5-restore-point.js
```

Depois, para validar a Bridge:

```bash
cd telemetria-next/bridge
node --check src/protocol.js
node --check src/server.js
```

Para validar o app:

```bash
cd telemetria-next/app
node --check www/app.js
node --check www/v5-lap-total.js
node --check www/card-layout.js
node --check www/fuel-heatmap.js
```

## 9. Recuperação total

Quando não for possível localizar o erro:

```bash
git fetch origin
git checkout telemetria-v5
git reset --hard origin/restore/telemetria-v5-perfect-2026-07-30
git push --force-with-lease origin telemetria-v5
```

Depois execute novamente o workflow `Build V5 Next Funcional`.

## 10. Regra para novas alterações

Antes de cada nova função:

1. criar uma branch de trabalho;
2. alterar apenas um conjunto pequeno de arquivos;
3. executar o verificador;
4. gerar o APK;
5. testar a conexão real;
6. somente depois atualizar a `telemetria-v5`.
