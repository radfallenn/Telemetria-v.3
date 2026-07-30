# GT7 Telemetria V5 Next

Base funcional da V5 criada a partir das partes estáveis de `agent/telemetria-next-zero`.

## Arquitetura

```text
PS5 / Gran Turismo 7
        |
        | UDP GT7: heartbeat 33739 e recepção 33740
        v
Raspberry Pi — GT7 Bridge Next
        |
        | HTTP na rede local: 8790
        v
APK Android — GT7 Telemetria Next
```

O APK não abre o UDP do GT7. A Bridge permanece no Raspberry, recebe e decodifica a telemetria e continua funcionando independentemente do celular.

## Configuração no aplicativo

Abra **SET** e informe:

- URL da Bridge, por exemplo `http://192.168.1.70:8790`;
- IP atual do PS5;
- **Testar Bridge** para conferir HTTP, UDP e pacotes;
- **Salvar e conectar** para gravar os dados no celular e enviar o IP do PS5 à Bridge;
- **Reiniciar recepção UDP** quando necessário.

Os dois campos são editáveis e ficam salvos no aparelho.

## Regra oficial do Tempo Total

O campo **Tempo Total** é exclusivamente a soma dos tempos das voltas válidas:

```text
Tempo Total = soma dos tempos de todas as voltas válidas
```

Uma volta entra no cálculo somente quando:

- foi concluída;
- possui tempo numérico positivo entre 30 segundos e 15 minutos;
- não está marcada como inválida pela fonte de telemetria;
- ainda não foi registrada, evitando duplicação do mesmo tempo.

Não entram no cálculo:

- volta inválida;
- volta ainda em andamento;
- tempo desde que o aplicativo abriu;
- tempo parado;
- relógio da conexão com a Bridge.

A lista de voltas válidas fica preservada no celular durante a sessão e é zerada quando uma nova sessão é detectada.

## Instalação da Bridge no CasaOS

1. Baixe o artefato `GT7-Bridge-V5.2-CasaOS`.
2. Extraia no Raspberry.
3. Execute `bash install-casaos.sh`.
4. Abra `http://IP_DO_RASPBERRY:8790/api/health`.
5. Instale o APK `GT7-Telemetria-V5.2-Tempo-Total-Voltas-Validas`.

O container usa `network_mode: host`, necessário para o protocolo UDP do GT7.

## Artefatos

O workflow da branch `telemetria-v5` gera:

- `GT7-Telemetria-V5.2-Tempo-Total-Voltas-Validas`;
- `GT7-Bridge-V5.2-CasaOS`.

## Identidade Android

- App ID: `com.studiorad.gt7telemetrynext`
- Nome: `GT7 Telemetria Next`
