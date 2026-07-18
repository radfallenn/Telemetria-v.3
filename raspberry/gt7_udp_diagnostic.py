#!/usr/bin/env python3
"""Teste rápido e independente da telemetria UDP do Gran Turismo 7.

Envia o heartbeat ao PS5 na porta UDP 33739, escuta a telemetria localmente
na porta UDP 33740, descriptografa os pacotes e exibe campos básicos.

Uso rápido:
    python3 gt7_udp_diagnostic.py 192.168.1.81

O teste deve ser executado no Raspberry/PC que receberá a telemetria, na mesma
rede do PS5. A porta 33740 é uma porta UDP local de recepção, não uma URL HTTP.
"""

from __future__ import annotations

import argparse
import collections
import errno
import socket
import struct
import sys
import time
from dataclasses import dataclass
from typing import Optional

DEFAULT_PS5_IP = "192.168.1.81"
HEARTBEAT_PORT = 33739
RECEIVE_PORT = 33740
GT7_MAGIC = 0x47375330
GT7_KEY = b"Simulator Interface Packet GT7 ver 0.0"[:32]
NONCE_CONSTANTS = (0xDEADBEEF, 0xDEADBEAF, 0x55FABB4F)


def _rotl32(value: int, count: int) -> int:
    value &= 0xFFFFFFFF
    return ((value << count) | (value >> (32 - count))) & 0xFFFFFFFF


def _quarter_round(state: list[int], a: int, b: int, c: int, d: int) -> None:
    state[b] ^= _rotl32((state[a] + state[d]) & 0xFFFFFFFF, 7)
    state[c] ^= _rotl32((state[b] + state[a]) & 0xFFFFFFFF, 9)
    state[d] ^= _rotl32((state[c] + state[b]) & 0xFFFFFFFF, 13)
    state[a] ^= _rotl32((state[d] + state[c]) & 0xFFFFFFFF, 18)


def _salsa20_block(key: bytes, nonce: bytes, counter: int) -> bytes:
    if len(key) != 32 or len(nonce) != 8:
        raise ValueError("Chave Salsa20 deve ter 32 bytes e nonce 8 bytes")

    sigma = b"expand 32-byte k"
    state = [0] * 16
    state[0], state[5], state[10], state[15] = struct.unpack("<4I", sigma)
    state[1:5] = struct.unpack("<4I", key[:16])
    state[11:15] = struct.unpack("<4I", key[16:])
    state[6], state[7] = struct.unpack("<2I", nonce)
    state[8] = counter & 0xFFFFFFFF
    state[9] = (counter >> 32) & 0xFFFFFFFF

    working = state.copy()
    for _ in range(10):
        _quarter_round(working, 0, 4, 8, 12)
        _quarter_round(working, 5, 9, 13, 1)
        _quarter_round(working, 10, 14, 2, 6)
        _quarter_round(working, 15, 3, 7, 11)
        _quarter_round(working, 0, 1, 2, 3)
        _quarter_round(working, 5, 6, 7, 4)
        _quarter_round(working, 10, 11, 8, 9)
        _quarter_round(working, 15, 12, 13, 14)

    return struct.pack(
        "<16I",
        *[((working[index] + state[index]) & 0xFFFFFFFF) for index in range(16)],
    )


def _salsa20_xor(data: bytes, key: bytes, nonce: bytes) -> bytes:
    output = bytearray(len(data))
    for offset in range(0, len(data), 64):
        block = _salsa20_block(key, nonce, offset // 64)
        chunk_size = min(64, len(data) - offset)
        for index in range(chunk_size):
            output[offset + index] = data[offset + index] ^ block[index]
    return bytes(output)


def decrypt_gt7_packet(packet: bytes) -> Optional[bytes]:
    if len(packet) < 0x44:
        return None

    seed = struct.unpack_from("<I", packet, 0x40)[0]
    for constant in NONCE_CONSTANTS:
        nonce = struct.pack("<II", (seed ^ constant) & 0xFFFFFFFF, seed)
        decrypted = _salsa20_xor(packet, GT7_KEY, nonce)
        if len(decrypted) >= 4 and struct.unpack_from("<I", decrypted, 0)[0] == GT7_MAGIC:
            return decrypted
    return None


def _float32(data: bytes, offset: int) -> float:
    return struct.unpack_from("<f", data, offset)[0]


def _int16(data: bytes, offset: int) -> int:
    return struct.unpack_from("<h", data, offset)[0]


def _int32(data: bytes, offset: int) -> int:
    return struct.unpack_from("<i", data, offset)[0]


def packet_type(size: int) -> str:
    return {296: "A", 316: "B", 344: "~", 368: "C"}.get(size, "?")


@dataclass
class TelemetrySample:
    packet_id: int
    packet_size: int
    speed_kmh: float
    rpm: float
    gear: str
    throttle_pct: float
    brake_pct: float
    lap: int
    total_laps: int
    fuel: float
    fuel_capacity: float

    @classmethod
    def from_packet(cls, data: bytes) -> "TelemetrySample":
        if len(data) < 0x93:
            raise ValueError(f"Pacote descriptografado curto: {len(data)} bytes")

        gears = data[0x90]
        current_gear = gears & 0x0F
        return cls(
            packet_id=_int32(data, 0x70),
            packet_size=len(data),
            speed_kmh=max(0.0, _float32(data, 0x4C) * 3.6),
            rpm=max(0.0, _float32(data, 0x3C)),
            gear="N" if current_gear == 0 else str(current_gear),
            throttle_pct=max(0.0, min(100.0, data[0x91] / 2.55)),
            brake_pct=max(0.0, min(100.0, data[0x92] / 2.55)),
            lap=_int16(data, 0x74),
            total_laps=_int16(data, 0x76),
            fuel=_float32(data, 0x44),
            fuel_capacity=_float32(data, 0x48),
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Testa a recepção e a leitura da telemetria UDP do GT7.",
    )
    parser.add_argument(
        "ps5_ip",
        nargs="?",
        default=DEFAULT_PS5_IP,
        help=f"IP do PS5 (padrão: {DEFAULT_PS5_IP})",
    )
    parser.add_argument(
        "--seconds",
        type=float,
        default=15.0,
        help="Duração do teste em segundos (padrão: 15)",
    )
    parser.add_argument(
        "--listen-ip",
        default="0.0.0.0",
        help="Interface local para escutar (padrão: 0.0.0.0)",
    )
    parser.add_argument(
        "--receive-port",
        type=int,
        default=RECEIVE_PORT,
        help=f"Porta UDP local de recepção (padrão: {RECEIVE_PORT})",
    )
    parser.add_argument(
        "--heartbeat-port",
        type=int,
        default=HEARTBEAT_PORT,
        help=f"Porta UDP de heartbeat no PS5 (padrão: {HEARTBEAT_PORT})",
    )
    parser.add_argument(
        "--packet-type",
        choices=("A", "B", "C", "~"),
        default="A",
        help="Tipo de pacote solicitado no heartbeat (padrão: A)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.seconds <= 0:
        print("ERRO: --seconds deve ser maior que zero.", file=sys.stderr)
        return 5

    try:
        socket.inet_aton(args.ps5_ip)
    except OSError:
        print(f"ERRO: IP do PS5 inválido: {args.ps5_ip}", file=sys.stderr)
        return 5

    receive_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    send_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    receive_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    receive_socket.settimeout(0.25)

    try:
        receive_socket.bind((args.listen_ip, args.receive_port))
    except OSError as exc:
        if exc.errno == errno.EADDRINUSE:
            print(
                f"FALHOU: a porta UDP {args.receive_port} já está em uso.\n"
                "Pare temporariamente a Bridge que está usando essa porta e execute o teste novamente.",
                file=sys.stderr,
            )
            return 4
        print(f"FALHOU ao abrir UDP {args.listen_ip}:{args.receive_port}: {exc}", file=sys.stderr)
        return 5

    print("=" * 62)
    print("TESTE RÁPIDO — GT7 TELEMETRIA UDP")
    print(f"PS5................: {args.ps5_ip}")
    print(f"Heartbeat..........: {args.packet_type!r} -> {args.ps5_ip}:{args.heartbeat_port}/UDP")
    print(f"Recepção local.....: {args.listen_ip}:{args.receive_port}/UDP")
    print(f"Duração............: {args.seconds:g} segundos")
    print("Abra o GT7, entre na pista e deixe o carro no circuito.")
    print("=" * 62)

    started_at = time.monotonic()
    deadline = started_at + args.seconds
    next_heartbeat = started_at
    next_report = started_at + 1.0
    heartbeats_sent = 0
    packets_received = 0
    packets_from_ps5 = 0
    decoded_packets = 0
    decode_errors = 0
    foreign_packets = 0
    total_bytes = 0
    sizes: collections.Counter[int] = collections.Counter()
    latest_sample: Optional[TelemetrySample] = None
    heartbeat_payload = args.packet_type.encode("ascii")

    try:
        while time.monotonic() < deadline:
            now = time.monotonic()
            if now >= next_heartbeat:
                try:
                    send_socket.sendto(
                        heartbeat_payload,
                        (args.ps5_ip, args.heartbeat_port),
                    )
                    heartbeats_sent += 1
                except OSError as exc:
                    print(f"AVISO: falha ao enviar heartbeat: {exc}")
                next_heartbeat = now + 1.0

            try:
                packet, sender = receive_socket.recvfrom(4096)
            except socket.timeout:
                packet = b""
                sender = ("", 0)
            except OSError as exc:
                print(f"FALHOU durante a recepção: {exc}", file=sys.stderr)
                return 5

            if packet:
                packets_received += 1
                total_bytes += len(packet)
                sizes[len(packet)] += 1

                if sender[0] != args.ps5_ip:
                    foreign_packets += 1
                else:
                    packets_from_ps5 += 1
                    decrypted = decrypt_gt7_packet(packet)
                    if decrypted is None:
                        decode_errors += 1
                    else:
                        try:
                            latest_sample = TelemetrySample.from_packet(decrypted)
                            decoded_packets += 1
                        except (ValueError, struct.error):
                            decode_errors += 1

            now = time.monotonic()
            if now >= next_report:
                elapsed = max(0.001, now - started_at)
                if latest_sample:
                    sample = latest_sample
                    fuel_text = (
                        f"{sample.fuel:.1f}/{sample.fuel_capacity:.1f} L"
                        if sample.fuel_capacity > 0
                        else f"{sample.fuel:.1f} L"
                    )
                    print(
                        f"[{elapsed:5.1f}s] OK {decoded_packets:5d} pacotes | "
                        f"{decoded_packets / elapsed:5.1f} p/s | "
                        f"{sample.speed_kmh:6.1f} km/h | {sample.rpm:6.0f} RPM | "
                        f"marcha {sample.gear} | acel {sample.throttle_pct:5.1f}% | "
                        f"freio {sample.brake_pct:5.1f}% | volta {sample.lap}/{sample.total_laps} | "
                        f"comb. {fuel_text}"
                    )
                else:
                    print(
                        f"[{elapsed:5.1f}s] aguardando | heartbeat={heartbeats_sent} | "
                        f"UDP={packets_received} | do PS5={packets_from_ps5} | "
                        f"decodificados={decoded_packets}"
                    )
                next_report = now + 1.0
    except KeyboardInterrupt:
        print("\nTeste interrompido pelo usuário.")
    finally:
        receive_socket.close()
        send_socket.close()

    elapsed = max(0.001, time.monotonic() - started_at)
    print("\n" + "=" * 62)
    print("RESULTADO")
    print(f"Heartbeats enviados.: {heartbeats_sent}")
    print(f"Pacotes UDP recebidos: {packets_received}")
    print(f"Pacotes vindos do PS5: {packets_from_ps5}")
    print(f"Pacotes decodificados: {decoded_packets}")
    print(f"Falhas de decode......: {decode_errors}")
    print(f"Pacotes de outros IPs.: {foreign_packets}")
    print(f"Taxa média............: {decoded_packets / elapsed:.1f} pacotes/s")
    print(f"Bytes recebidos.......: {total_bytes}")
    if sizes:
        summary = ", ".join(
            f"{size} bytes ({packet_type(size)}): {count}"
            for size, count in sorted(sizes.items())
        )
        print(f"Tamanhos..............: {summary}")

    if decoded_packets > 0 and latest_sample is not None:
        print("STATUS: APROVADO — telemetria GT7 recebida e lida corretamente.")
        print("=" * 62)
        return 0

    if packets_from_ps5 > 0:
        print("STATUS: FALHOU — o UDP chegou do PS5, mas não foi possível descriptografar a telemetria.")
        print("Verifique o tipo de pacote; tente novamente com --packet-type C.")
        print("=" * 62)
        return 3

    print("STATUS: FALHOU — nenhum pacote de telemetria foi recebido do PS5.")
    print("Confirme: GT7 aberto e carro na pista, mesma rede, firewall liberado e IP correto.")
    print("=" * 62)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
