#!/usr/bin/env python3
"""Diagnóstico independente da comunicação GT7 no Raspberry.

Envia heartbeat 'A' ao PS5 na porta 33739 e aguarda pacotes UDP na porta 33740.
Uso: python3 gt7_udp_diagnostic.py 192.168.1.81
"""
import socket
import sys
import time

PS5_IP = sys.argv[1] if len(sys.argv) > 1 else "192.168.1.81"
HEARTBEAT_PORT = 33739
RECEIVE_PORT = 33740
HEARTBEAT = b"A"

recv_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
recv_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
recv_sock.bind(("0.0.0.0", RECEIVE_PORT))
recv_sock.settimeout(1.0)

send_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

print(f"PS5: {PS5_IP}")
print(f"Heartbeat: {HEARTBEAT!r} -> UDP {HEARTBEAT_PORT}")
print(f"Escutando: 0.0.0.0:{RECEIVE_PORT}")
print("Abra o GT7 e entre na pista. Ctrl+C para sair.\n")

last_heartbeat = 0.0
packets = 0
last_packet = 0.0

try:
    while True:
        now = time.monotonic()
        if now - last_heartbeat >= 1.0:
            send_sock.sendto(HEARTBEAT, (PS5_IP, HEARTBEAT_PORT))
            last_heartbeat = now
        try:
            data, addr = recv_sock.recvfrom(4096)
            packets += 1
            last_packet = time.monotonic()
            print(f"PACOTE #{packets}: {len(data)} bytes de {addr[0]}:{addr[1]}")
        except socket.timeout:
            age = time.monotonic() - last_packet if last_packet else None
            if age is None or age > 3:
                print("AGUARDANDO: heartbeat enviado, nenhum pacote GT7 recebido na 33740")
except KeyboardInterrupt:
    print(f"\nEncerrado. Pacotes recebidos: {packets}")
finally:
    recv_sock.close()
    send_sock.close()
