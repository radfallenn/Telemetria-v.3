# GT7 Telemetria Next

Projeto novo de telemetria para Gran Turismo 7 e PlayStation 5.

## Regra principal

Este diretório não importa, executa ou modifica arquivos do projeto antigo. O conteúdo existente na raiz do repositório permanece preservado apenas para pesquisa. O novo APK e a nova Bridge têm configurações, identificadores, portas, código e workflows próprios.

## Arquitetura

```text
PS5 / Gran Turismo 7
        |
        | UDP do protocolo GT7
        v
Raspberry Pi - Bridge Next
  - heartbeat para o PS5
  - recepção e decodificação dos pacotes
  - estado da sessão em memória
  - API HTTP e transmissão WebSocket
        |
        | rede local
        v
APK Android - Telemetria Next
  - somente a tela principal do cockpit
  - conexão WebSocket com fallback HTTP
  - configuração e diagnóstico em janela sobreposta
```

O APK sozinho não abre sockets UDP do GT7. A Bridge Next precisa estar instalada e ativa no Raspberry Pi. O GitHub Actions gera dois artefatos separados e ambos fazem parte da instalação:

- `GT7-Telemetria-Next-v0.2`: APK Android.
- `GT7-Bridge-Next-v0.2-CasaOS`: Bridge pronta para CasaOS, Docker e Portainer.

## Instalação no CasaOS ou Portainer

1. Baixe e extraia o artefato `GT7-Bridge-Next-v0.2-CasaOS` no Raspberry.
2. Entre na pasta extraída.
3. Execute `bash install-casaos.sh`.
4. Confirme no navegador: `http://IP_DO_RASPBERRY:8790/api/health`.
5. No APK, configure a mesma URL e o IP real do PS5.

O container usa `network_mode: host`, necessário para o heartbeat e a recepção UDP do GT7 funcionarem corretamente na rede local.

## Diagnóstico da v0.2

O APK separa três estados:

- `OFF`: o APK não alcança a Bridge pela porta 8790.
- `BRIDGE`: a Bridge está conectada, mas o GT7 ainda não envia pacotes.
- `Recebendo GT7`: os pacotes estão chegando e sendo decodificados.

A janela de configurações testa HTTP, porta UDP, pacotes brutos, pacotes decodificados e o IP do PS5. Também permite reiniciar somente a recepção UDP.

## Diretórios

- `app/`: APK Android novo, usando Capacitor somente como embalagem da tela principal.
- `bridge/`: serviço independente para Raspberry Pi, com instalação systemd e Docker/CasaOS.

## Portas padrão do projeto novo

- API e WebSocket da Bridge Next: `8790`
- heartbeat do protocolo GT7 no PS5: `33739`
- recepção UDP no Raspberry Pi: `33740`

As portas `33739` e `33740` pertencem ao protocolo do GT7. A porta `8790` pertence somente à nossa nova Bridge.

## Identidade Android

- App ID: `com.studiorad.gt7telemetrynext`
- Nome: `GT7 Telemetria Next`

## Princípios

1. Nenhum patch sobre HTML antigo.
2. Nenhum script que altere arquivos durante o build.
3. Uma única tela principal, com configurações em modal.
4. Bridge independente do celular; a corrida continua sendo processada no Raspberry.
5. Contrato de telemetria versionado.
6. Dados ausentes são exibidos como indisponíveis, nunca inventados.
