# AGENTS.md — GT7 Telemetria

## Objetivo do projeto
Aplicativo Android/Capacitor para exibir telemetria do Gran Turismo 7 recebida por uma Bridge HTTP rodando em Raspberry Pi.

## Repositório
- Projeto: `radfallenn/Telemetria-v.3`
- Branch principal: `main`

## Configuração atual obrigatória
- Bridge Raspberry: `http://192.168.1.70:8788`
- PS5: `192.168.1.81`
- Heartbeat GT7: enviar exclusivamente o byte ASCII `A` para UDP `33739`
- Recepção da telemetria: UDP `33740`
- Heartbeat e recepção devem usar o mesmo socket UDP vinculado à porta `33740`.
- O app deve conectar automaticamente enquanto estiver aberto.
- Não adicionar serviço Android em segundo plano, wake lock, boot receiver ou notificação permanente.

## Arquivos críticos
- `bridge/server.js`: Bridge V5 completa; HTTP, socket UDP único, heartbeat, decodificação e sessões.
- `bridge/install.sh`: instalação/recriação do container da Bridge no Raspberry.
- `www/index.html`: interface principal.
- `www/bridge-v408.js`: único controlador permitido no app para conexão, leitura, adaptação e diagnóstico.
- `www/telemetry-attributes.json`: banco interno de atributos.
- `scripts/install-bridge-from-v408-apk.js`: instala o controlador da Bridge no HTML final.
- `scripts/patch-v4-editable-network-settings.js`: integra o SET com a Bridge V5.
- `scripts/patch-v4-remove-attributes-and-marked-cards.js`: limpeza final da interface.
- `.github/workflows/build-apk.yml`: valida a Bridge e gera o APK.

## Regras da Bridge V5
1. Deve existir exatamente um `dgram.createSocket` no servidor.
2. O socket deve ser vinculado a `0.0.0.0:33740` antes do primeiro heartbeat.
3. O mesmo socket vinculado deve enviar `A` para `192.168.1.81:33739` a cada segundo.
4. Não usar `C`, tipo de pacote ou valor configurável como heartbeat.
5. Não executar patches que reescrevam `server.js` durante a inicialização.
6. Não executar relay UDP concorrente no mesmo processo.
7. `GET /api/health` deve separar Bridge HTTP, socket vinculado e telemetria recebida.
8. `POST /api/restart` deve recriar somente o socket UDP, sem derrubar o servidor HTTP.
9. A Bridge deve aceitar atualização do IP do PS5 por `POST /api/config`.
10. O container deve usar `network_mode: host`.

## Regras do aplicativo
1. Deve existir somente um polling de telemetria.
2. Não criar outro controlador concorrente para a Bridge.
3. Não considerar resposta HTTP como prova de que pacotes do PS5 estão chegando.
4. Separar os estados:
   - `OFF`: Bridge inacessível.
   - `BRIDGE`: HTTP funciona, mas sem pacotes GT7 decodificados recentes.
   - `OK`: Bridge acessível e pacotes GT7 decodificados recentes.
5. Não sobrescrever o IP do PS5 salvo pelo usuário, exceto quando não existir valor válido.
6. O valor padrão do PS5 é `192.168.1.81`.
7. Preservar suporte a `/api/live`, `/api/fields`, `/api/status` e `/api/health`.
8. O botão de reinício no SET deve chamar `POST /api/restart`.
9. Manter o adaptador compatível com estruturas `live`, `fields`, `data`, `telemetry`, `car`, `input`, `fuel`, `lap`, `session` e `legacy`.

## Interface removida
Não recriar estes elementos:
- página `ATRIB`;
- botão `ATRIB` na navegação;
- card fixo `RPM + Tempo Total` (`data-field="rpmtotal"`);
- bloco `Temperatura dos pneus` (`data-field="tyres"`);
- cards `Última volta` (`data-field="last"`) e `Tempo total` (`data-field="total").

## Ordem obrigatória do workflow
A limpeza da interface deve executar depois de todos os patches que possam criar cards e depois da instalação do controlador da Bridge. A validação deve verificar o HTML final, não apenas strings presentes em scripts.

## Comandos de validação
```bash
node --check bridge/server.js
sh -n bridge/install.sh
npm install --no-audit --no-fund
node --check www/bridge-v408.js
node scripts/install-bridge-from-v408-apk.js
node scripts/patch-v4-editable-network-settings.js
node scripts/patch-v4-remove-attributes-and-marked-cards.js
npx cap add android
npx cap sync android
node scripts/patch-android-network.js
cd android && ./gradlew assembleDebug --stacktrace
```

## Critérios de aceitação
- GitHub Actions conclui sem erro.
- APK é gerado como artifact.
- App abre sem crash.
- Bridge é consultada automaticamente em `192.168.1.70:8788`.
- PS5 padrão é `192.168.1.81` e permanece editável.
- `GET /api/health` retorna `udpBound: true`, `heartbeatByte: "A"` e `sameSocket: true`.
- Dashboard mostra dados quando chegam pacotes UDP reais e decodificados.
- Sem pacotes do PS5, o status mostra `BRIDGE`, não `OK`.
- Nenhum elemento removido volta a aparecer.

## Forma de trabalho
Antes de alterar a conexão, rastrear o fluxo completo: PS5 → heartbeat `A` enviado pelo socket `33740` para UDP `33739` → retorno UDP no mesmo socket `33740` → decodificação → endpoint HTTP → `adapt()` → `render()`.
