# Bridge V5 da telemetria GT7

A Bridge foi refeita para eliminar sockets, patches e relays concorrentes.

## Rede padrão

- Raspberry/Bridge HTTP: `http://192.168.1.70:8788`
- PS5: `192.168.1.81`
- Heartbeat: byte ASCII `A` enviado para UDP `33739`
- Recepção: UDP `33740`
- Heartbeat e recepção usam exatamente o mesmo socket vinculado à porta `33740`.

## Instalação no Raspberry

Dentro do repositório:

```bash
cd bridge
chmod +x install.sh
./install.sh
```

O instalador recria somente o container `telemetria-v3-bridge`, usa rede `host`, verifica a API e confirma que o socket UDP está vinculado.

## Estados

- `udp_desligado`: a porta `33740` não pôde ser vinculada. Normalmente existe outro processo usando a porta.
- `aguardando_pacotes`: Bridge HTTP e socket UDP estão ativos, mas o PS5 ainda não respondeu.
- `recebendo_udp_sem_decode`: chegaram datagramas, porém eles não foram reconhecidos como telemetria GT7 válida.
- `recebendo_udp_decodificado`: telemetria real recebida e decodificada.

## Diagnóstico

```text
GET http://192.168.1.70:8788/api/health
GET http://192.168.1.70:8788/api/diagnostic
GET http://192.168.1.70:8788/api/status
```

A resposta saudável, antes de abrir uma corrida, deve conter:

```json
{
  "ok": true,
  "udpBound": true,
  "heartbeatByte": "A",
  "sameSocket": true,
  "ps5Ip": "192.168.1.81"
}
```

Quando o GT7 estiver enviando dados, `telemetryReceiving` passa para `true`.

## Reiniciar apenas o UDP

```text
POST http://192.168.1.70:8788/api/restart
```

Esse endpoint fecha e recria o socket UDP sem derrubar a API HTTP nem apagar sessões.

## Alterar o IP do PS5

```text
POST http://192.168.1.70:8788/api/config
Content-Type: application/json

{"ps5Ip":"192.168.1.81"}
```

O IP é salvo em `bridge/config.json` e reaplicado ao heartbeat imediatamente.

## Regra importante

Não executar `patch-single-socket.js`, `patch-udp-relay.js` ou qualquer outro script que reescreva `server.js`. Esses arquivos foram removidos. O serviço correto inicia diretamente com `node server.js`.
