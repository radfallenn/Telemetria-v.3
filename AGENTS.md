# AGENTS.md — GT7 Telemetria

## Objetivo do projeto
Aplicativo Android/Capacitor para exibir telemetria do Gran Turismo 7 recebida por uma Bridge HTTP rodando em Raspberry Pi.

## Repositório
- Projeto: `radfallenn/Telemetria-v.3`
- Branch principal: `main`

## Configuração atual obrigatória
- Bridge: `http://192.168.1.70:8788`
- PS5: `192.168.1.81`
- Heartbeat GT7: enviar byte ASCII `A` para UDP `33739`
- Recepção da telemetria: UDP `33740`
- O app deve conectar automaticamente enquanto estiver aberto.
- Não adicionar serviço em segundo plano, wake lock, boot receiver ou notificação permanente.

## Arquivos críticos
- `www/index.html`: interface principal.
- `www/bridge-v408.js`: único controlador permitido para conexão, leitura, adaptação e diagnóstico.
- `www/telemetry-attributes.json`: banco interno de atributos.
- `scripts/install-bridge-from-v408-apk.js`: instala a Bridge no HTML final.
- `scripts/patch-v4-remove-attributes-and-marked-cards.js`: limpeza final da interface.
- `.github/workflows/build-apk.yml`: build do APK no GitHub Actions.
- `raspberry/gt7_udp_diagnostic.py`: diagnóstico UDP do Raspberry.

## Regras de arquitetura
1. Deve existir somente um polling de telemetria.
2. Não criar outro controlador concorrente para a Bridge.
3. Não considerar resposta HTTP como prova de que pacotes do PS5 estão chegando.
4. Separar os estados:
   - `OFF`: Bridge inacessível.
   - `BRIDGE`: HTTP funciona, mas sem pacotes GT7 recentes.
   - `OK`: Bridge acessível e pacotes GT7 recentes.
5. Não sobrescrever o IP do PS5 salvo pelo usuário, exceto quando não existir valor válido.
6. O valor padrão do PS5 é `192.168.1.81`.
7. Preservar suporte a `/api/live`, `/api/fields` e `/api/status`.
8. Manter o adaptador compatível com estruturas `live`, `fields`, `data`, `telemetry`, `car`, `input`, `fuel`, `lap`, `session` e `legacy`.

## Interface removida
Não recriar estes elementos:
- página `ATRIB`;
- botão `ATRIB` na navegação;
- card fixo `RPM + Tempo Total` (`data-field="rpmtotal"`);
- bloco `Temperatura dos pneus` (`data-field="tyres"`);
- cards `Última volta` (`data-field="last"`) e `Tempo total` (`data-field="total"`).

## Ordem obrigatória do workflow
A limpeza da interface deve executar depois de todos os patches que possam criar cards e depois da instalação da Bridge. A validação deve verificar o HTML final, não apenas strings presentes em scripts.

## Comandos de validação
```bash
npm install --no-audit --no-fund
node --check www/bridge-v408.js
node scripts/install-bridge-from-v408-apk.js
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
- Dashboard mostra dados quando chegam pacotes UDP reais.
- Sem pacotes do PS5, o status mostra `BRIDGE`, não `OK`.
- Nenhum elemento removido volta a aparecer.

## Forma de trabalho
Antes de alterar a conexão, rastrear o fluxo completo: PS5 → heartbeat UDP 33739 → pacotes UDP 33740 → Raspberry → endpoint HTTP → `adapt()` → `render()`.
Evitar patches por texto frágeis quando uma alteração estrutural direta for possível. Sempre executar validações de sintaxe e verificar o HTML final após todos os patches.
