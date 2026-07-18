# Relay UDP da telemetria GT7

A Bridge recebe os pacotes brutos do PS5 em UDP `33740`, decodifica para o aplicativo principal e pode encaminhar os mesmos pacotes para aplicativos de telemetria na rede local.

## Configuração automática pelo aplicativo

Abra **SET / Configurações** e localize o card **APLICATIVOS DE TELEMETRIA**.

Não é necessário preencher IP, endereço da Bridge ou portas. Use apenas um dos botões:

- **ATIVAR VICTORY**
- **ATIVAR SIM DASHBOARD**
- **DESATIVAR RELAY**
- **TESTAR CONEXÃO**

Ao tocar em Victory ou SIM Dashboard, a Bridge identifica automaticamente o IP do celular que fez a solicitação e configura a porta padrão de telemetria GT7 `33740`.

A tela principal mostra somente o estado, o IP detectado, os pacotes recebidos do PS5, os pacotes encaminhados e os erros. Os campos técnicos continuam disponíveis, mas ficam recolhidos em **Configuração avançada**.

## Conexão principal automática

O aplicativo principal também já utiliza automaticamente:

- Bridge HTTP: `http://192.168.1.70:8788`
- PS5: `192.168.1.81`
- UDP: `33740`
- heartbeat: `33739`

Esses valores só precisam ser alterados caso a rede doméstica mude. A edição manual fica recolhida em **Configuração avançada**.

## Consultar o status pela API

`GET http://IP_DO_RASPBERRY:8788/api/relay`

A resposta informa o IP do cliente detectado, destinos, pacotes recebidos do PS5, pacotes encaminhados, erros e horários da última atividade.

## Configuração automática pela API

O valor especial `__CLIENT__` faz a Bridge usar o IP do dispositivo que enviou a solicitação:

```json
{
  "targets": [
    {
      "name": "Victory",
      "host": "__CLIENT__",
      "port": 33740,
      "enabled": true
    }
  ]
}
```

Também é possível usar `auto` ou omitir o host. A Bridge substituirá pelo IP do cliente antes de salvar.

## Configuração avançada

Para encaminhar a outro dispositivo, abra **Configuração avançada** e informe manualmente nome, IP e porta. A Bridge aceita até 10 destinos.

As configurações ficam salvas em `bridge/config.json` e são preservadas após reiniciar o container.

## Segurança contra loops

A Bridge encaminha somente datagramas cujo endereço de origem corresponde ao IP configurado do PS5. Destinos inválidos, duplicados, broadcast e o próprio PS5 são ignorados.
