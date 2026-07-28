# Nova Bridge GT7 — HTTP 8789

Esta Bridge foi criada do zero e usa um container próprio:

- HTTP do aplicativo: `http://192.168.1.70:8789`
- Container: `telemetria-bridge-8789`
- PS5 padrão: `192.168.1.81`

## Instalação limpa no Raspberry

```bash
cd bridge-8789
chmod +x install.sh
./install.sh
```

O instalador remove containers antigos conhecidos, verifica conflito de porta, cria o container novo e testa `GET /api/health`.

## Verificação

Abra no navegador:

```text
http://192.168.1.70:8789/api/health
```

Antes da corrida, a resposta deve mostrar `udpBound: true`. Durante a corrida, `telemetryReceiving` deve mudar para `true`.

## Portas do GT7

A porta HTTP da nossa Bridge é nova: `8789`. As portas UDP `33739` e `33740` pertencem ao protocolo do próprio GT7 e ficam isoladas dentro deste serviço. Elas não são portas do painel Android e não podem ser substituídas por portas arbitrárias sem interromper a telemetria.
