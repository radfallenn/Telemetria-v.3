# Ponto de restauração — Telemetria V5.3

Data: 30/07/2026

## Estado confirmado como funcional

- Branch de desenvolvimento: `telemetria-v5`
- Commit funcional confirmado: `e96583aa1be1b31300f95cfd2c9249571c00e8b0`
- Branch protegida de restauração: `restore/telemetria-v5-perfect-2026-07-30`
- APK esperado: `GT7-Telemetria-V5.3-Layout-Movel-Heatmap`
- Bridge esperada: `GT7-Bridge-V5.3-CasaOS`

## Funções preservadas neste ponto

- Dashboard conectado à Bridge Next.
- URL da Bridge editável e salva no celular.
- IP do PS5 editável e enviado para a Bridge.
- API HTTP padrão na porta `8790`.
- Heartbeat GT7 na porta `33739`.
- Recepção UDP GT7 na porta `33740`.
- Tempo Total calculado pela soma das voltas válidas.
- Conta-giros com heatmap progressivo.
- Elementos centrais removidos conforme aprovado.
- Cartões móveis com controles para cima, baixo, esquerda e direita em todas as abas.
- Ordem dos cartões salva no dispositivo.
- Build Android via Capacitor e GitHub Actions.

## Regra de segurança

Não alterar nem mover a branch `restore/telemetria-v5-perfect-2026-07-30`.
Ela representa exatamente o estado aprovado pelo usuário.

## Restaurar a branch de desenvolvimento pelo GitHub

```bash
git fetch origin
git checkout telemetria-v5
git reset --hard origin/restore/telemetria-v5-perfect-2026-07-30
git push --force-with-lease origin telemetria-v5
```

## Criar uma nova branch a partir do ponto funcional

```bash
git fetch origin
git checkout -b telemetria-v5-recuperada origin/restore/telemetria-v5-perfect-2026-07-30
git push -u origin telemetria-v5-recuperada
```

## Arquivos principais do app

- `telemetria-next/app/www/index.html`
- `telemetria-next/app/www/styles.css`
- `telemetria-next/app/www/app.js`
- `telemetria-next/app/www/v5-lap-total.js`
- `telemetria-next/app/www/rpm-heatmap.css`
- `telemetria-next/app/www/card-layout.css`
- `telemetria-next/app/www/card-layout.js`
- `telemetria-next/app/www/fuel-heatmap.css`
- `telemetria-next/app/www/fuel-heatmap.js`

## Arquivos principais da Bridge

- `telemetria-next/bridge/src/server.js`
- `telemetria-next/bridge/src/protocol.js`
- `telemetria-next/bridge/docker-compose.yml`
- `telemetria-next/bridge/install-casaos.sh`

## Verificação rápida

Execute na raiz do repositório:

```bash
node scripts/verify-v5-restore-point.js
```

O script deve terminar com `V5 RESTORE POINT OK`.
