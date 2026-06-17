# Telemetria v3

Projeto novo do GT7 Telemetria.

## Objetivo

- App Android/Web com tela para configurar IP do Raspberry e IP do PS5.
- Bridge no Raspberry com API para alterar o IP do PS5 sem usar console.
- Botões no app: salvar IPs, testar conexão, aplicar IP do PS5 no Bridge, iniciar/parar sessão, zerar dados.

## Raspberry

Instalação rápida no Raspberry:

```bash
cd ~
git clone https://github.com/radfallenn/Telemetria-v.3.git telemetria-v3
cd telemetria-v3/bridge
docker compose up -d
```

API do Bridge:

- `GET /api/fields`
- `GET /api/config`
- `POST /api/config` com `{ "ps5Ip": "192.168.1.68" }`
- `POST /api/reset`

## App

No app, em Configurações:

- IP do Raspberry
- IP do PS5
- Salvar
- Testar conexão
- Enviar IP do PS5 para Bridge
