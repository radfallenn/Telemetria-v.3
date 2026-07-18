# Relay UDP da telemetria GT7

A Bridge recebe os pacotes brutos do PS5 em UDP `33740`, decodifica para o aplicativo principal e pode encaminhar os mesmos pacotes para até 10 dispositivos na rede local.

## Configurar diretamente pelo aplicativo

Abra a página **SET / Configurações** e localize o card:

`RELAY UDP · VICTORY / SIM DASHBOARD`

No card é possível:

- selecionar um destino já configurado;
- criar um novo destino;
- definir nome, IP e porta UDP;
- ativar ou desativar o destino sem removê-lo;
- salvar ou remover destinos;
- testar o relay e atualizar os contadores;
- acompanhar pacotes recebidos do PS5, pacotes encaminhados e erros.

Para o Victory, use normalmente uma porta alternativa, como `33741`, e configure a mesma porta no aplicativo receptor. Para o SIM Dashboard ou outro receptor, informe o IP do dispositivo e a porta configurada nele.

## Consultar o status pela API

`GET http://IP_DO_RASPBERRY:8788/api/relay`

A resposta informa destinos, pacotes recebidos do PS5, pacotes encaminhados, erros e horários da última atividade.

## Configurar um destino pela API

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
