# Relay UDP da telemetria GT7

A Bridge recebe os pacotes brutos do PS5 em UDP `33740`, decodifica para o aplicativo principal e pode encaminhar os mesmos pacotes para até 10 dispositivos na rede local.

## Consultar o status

`GET http://IP_DO_RASPBERRY:8788/api/relay`

A resposta informa destinos, pacotes recebidos do PS5, pacotes encaminhados, erros e horários da última atividade.

## Configurar um destino

Envie `POST` para `/api/relay` com JSON:

```json
{
  "targets": [
    {
      "name": "Victory",
      "host": "192.168.1.50",
      "port": 33741,
      "enabled": true
    }
  ]
}
```

Para SIM Dashboard ou outro receptor, troque o nome, IP e porta pela configuração usada no dispositivo. O pacote encaminhado é o pacote bruto criptografado recebido do GT7.

## Vários dispositivos

```json
{
  "targets": [
    {"name": "Victory", "host": "192.168.1.50", "port": 33741, "enabled": true},
    {"name": "SIM Dashboard", "host": "192.168.1.51", "port": 33740, "enabled": true}
  ]
}
```

## Desativar ou limpar

Defina `enabled` como `false` para preservar o destino sem encaminhar. Para remover todos os destinos, envie:

```json
{"targets": []}
```

As configurações ficam salvas em `bridge/config.json` e são preservadas após reiniciar o container.

## Segurança contra loops

A Bridge encaminha somente datagramas cujo endereço de origem corresponde ao IP configurado do PS5. Destinos inválidos, duplicados, broadcast e o próprio PS5 são ignorados.
